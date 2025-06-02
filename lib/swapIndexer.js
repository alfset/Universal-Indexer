const { ethers } = require('ethers');
const { getTokenDecimals, withRetry } = require('../utils/ethers');
const { updateUserAndTokenVolumes } = require('./volumeUpdater');
const poolAbi = require('./poolsAbi.json');

async function getRealUserAddress(swap, sender, knownRouters, universalRouterInterface, provider) {
  const senderLower = sender.toLowerCase();
  console.debug(`[getRealUserAddress] Processing tx ${swap.transactionHash} at block ${swap.blockNumber}, sender: ${sender}`);

  // If sender is not a known router, assume it's the user address
  if (!knownRouters.has(senderLower)) {
    console.debug(`Sender ${sender} is not a known router, returning as user address`);
    return sender;
  }

  console.debug(`Sender ${sender} is a known router, fetching transaction to find real user`);

  // Fetch the transaction
  let tx;
  try {
    tx = await withRetry(() => provider.getTransaction(swap.transactionHash), 5, 2000);
    if (!tx || !tx.from || !tx.data) {
      console.warn(`Failed to fetch transaction ${swap.transactionHash} at block ${swap.blockNumber}, falling back to sender: ${sender}`);
      return tx?.from || sender;
    }
  } catch (error) {
    console.error(`Error fetching transaction ${swap.transactionHash}: ${error.message}, falling back to sender: ${sender}`);
    return sender;
  }

  // Check if tx.from is an EOA
  let userAddress = tx.from;
  try {
    const code = await provider.getCode(tx.from);
    if (code === '0x' || code === '') {
      console.debug(`Transaction ${swap.transactionHash} from EOA ${tx.from}, using as user address`);
      return tx.from;
    }
    console.debug(`Caller ${tx.from} for tx ${swap.transactionHash} is a contract, attempting to decode or trace`);
  } catch (codeError) {
    console.warn(`Failed to check if ${tx.from} is a contract: ${codeError.message}, proceeding with decoding`);
  }

  // Try decoding the transaction to confirm it's a universal router call
  try {
    const decodedInput = universalRouterInterface.parseTransaction({ data: tx.data });
    if (decodedInput && decodedInput.name === 'execute') {
      console.debug(`Decoded 'execute' call for tx ${swap.transactionHash}, caller: ${tx.from}`);
    } else {
      console.debug(`Transaction ${swap.transactionHash} is not an 'execute' call, using tx.from: ${tx.from}`);
      return tx.from;
    }
  } catch (decodeError) {
    console.warn(`Failed to decode transaction input for ${swap.transactionHash}: ${decodeError.message}, using tx.from: ${tx.from}`);
    return tx.from;
  }

  // If tx.from is a contract, attempt to trace the transaction to find the original EOA
  try {
    const code = await provider.getCode(tx.from);
    if (code !== '0x' && code !== '') {
      console.debug(`Caller ${tx.from} is a contract, attempting transaction trace for ${swap.transactionHash}`);
      try {
        const trace = await withRetry(() => provider.send('debug_traceTransaction', [swap.transactionHash, { tracer: 'callTracer' }]), 3, 2000);
        // Simplified tracing: assume the top-level caller is the EOA
        if (trace && trace.from) {
          const traceFrom = trace.from;
          const traceCode = await provider.getCode(traceFrom);
          if (traceCode === '0x' || traceCode === '') {
            console.debug(`Traced EOA ${traceFrom} for tx ${swap.transactionHash}, using as user address`);
            return traceFrom;
          }
          console.warn(`Traced address ${traceFrom} is a contract, falling back to tx.from: ${tx.from}`);
        } else {
          console.warn(`No valid trace data for tx ${swap.transactionHash}, falling back to tx.from: ${tx.from}`);
        }
      } catch (traceError) {
        console.warn(`Transaction tracing not supported or failed for ${swap.transactionHash}: ${traceError.message}, using tx.from: ${tx.from}`);
      }
    }
  } catch (error) {
    console.warn(`Error checking contract code or tracing for ${swap.transactionHash}: ${error.message}, using tx.from: ${tx.from}`);
  }

  console.debug(`Using tx.from ${tx.from} as user address for tx ${swap.transactionHash}`);
  return tx.from;
}

async function indexSwapsForPool(
  poolAddress,
  poolInfo,
  provider,
  supabase,
  tokenSymbols,
  knownRouters,
  universalRouterInterface,
  chainId,
  tokenList,
  fromBlock,
  toBlock,
  { onIndexingSwaps, onFailedUpdateVolumes, onFailedProcessSwap }
) {
  console.debug(`[Start] Indexing swaps for pool ${poolAddress} from block ${fromBlock} to ${toBlock} on chain ${chainId}`);

  const validTokens = new Set(tokenList.map(t => t.address.toLowerCase()));
  if (!validTokens.has(poolInfo.token0.toLowerCase()) && !validTokens.has(poolInfo.token1.toLowerCase())) {
    console.debug(`Skipping pool ${poolAddress} as tokens ${poolInfo.token0}, ${poolInfo.token1} are not in token list`);
    return;
  }

  let poolContract;
  try {
    poolContract = new ethers.Contract(poolAddress, poolAbi, provider);
  } catch (contractError) {
    console.error({
      event: 'pool_contract_creation_failed',
      poolAddress,
      chainId,
      fromBlock,
      toBlock,
      error: contractError.message,
      rawError: JSON.stringify(contractError, Object.getOwnPropertyNames(contractError)),
    });
    throw new Error(`Failed to create pool contract: ${contractError.message}`);
  }

  try {
    onIndexingSwaps(poolAddress, fromBlock, toBlock);
    const pastSwaps = await withRetry(() => poolContract.queryFilter('Swap', fromBlock, toBlock));
    console.debug(`Found ${pastSwaps.length} Swap events from block ${fromBlock} to ${toBlock}`);

    for (const [i, swap] of pastSwaps.entries()) {
      console.debug(`Processing swap #${i + 1}/${pastSwaps.length} at block ${swap.blockNumber}`);

      if (!swap || !swap.args) {
        console.warn(`Skipping invalid swap event at block ${swap.blockNumber}`);
        continue;
      }

      const { sender, amount0, amount1 } = swap.args;
      if (!sender || amount0 === undefined || amount1 === undefined) {
        console.warn(`Incomplete swap data at block ${swap.blockNumber}`);
        continue;
      }

      let timestamp;
      try {
        const block = await provider.getBlock(swap.blockNumber);
        timestamp = block ? new Date(block.timestamp * 1000).toISOString() : new Date().toISOString();
      } catch (error) {
        console.warn(`Failed to fetch block timestamp for block ${swap.blockNumber}: ${error.message}`);
        timestamp = new Date().toISOString();
      }

      const userAddress = await getRealUserAddress(swap, sender, knownRouters, universalRouterInterface, provider);

      const decimals0 = (await getTokenDecimals(poolInfo.token0, provider, tokenList)) || 18;
      const decimals1 = (await getTokenDecimals(poolInfo.token1, provider, tokenList)) || 18;

      const formattedAmount0 = ethers.formatUnits(amount0, decimals0);
      const formattedAmount1 = ethers.formatUnits(amount1, decimals1);

      console.log('Swap Event:', {
        type: 'swap',
        chainId,
        pool: poolAddress,
        sender,
        user: userAddress,
        token0: `${poolInfo.token0} (${tokenSymbols[poolInfo.token0.toLowerCase()] || 'UNKNOWN'})`,
        token1: `${poolInfo.token1} (${tokenSymbols[poolInfo.token1.toLowerCase()] || 'UNKNOWN'})`,
        amount0: `${formattedAmount0} ${tokenSymbols[poolInfo.token0.toLowerCase()] || 'UNKNOWN'}`,
        amount1: `${formattedAmount1} ${tokenSymbols[poolInfo.token1.toLowerCase()] || 'UNKNOWN'}`,
        block: swap.blockNumber,
        rawAmount0: amount0.toString(),
        rawAmount1: amount1.toString(),
        transactionHash: swap.transactionHash,
        timestamp,
      });

      const swapData = {
        chain_id: chainId,
        pool_address: poolAddress,
        user_address: userAddress,
        token0: poolInfo.token0,
        token1: poolInfo.token1,
        amount0: amount0.toString(),
        amount1: amount1.toString(),
        block_number: swap.blockNumber,
        transaction_hash: swap.transactionHash,
        timestamp,
      };

      try {
        const { error: upsertSwapError } = await supabase
          .from('swaps')
          .upsert(swapData, { onConflict: ['transaction_hash', 'chain_id'] });

        if (upsertSwapError) {
          console.error({
            event: 'swap_upsert_failed',
            poolAddress,
            chainId,
            swapData,
            error: upsertSwapError?.message || JSON.stringify(upsertSwapError, Object.getOwnPropertyNames(upsertSwapError)),
          });
          onFailedProcessSwap(poolAddress, `Swap upsert failed: ${upsertSwapError?.message || 'Unknown error'}`);
          continue;
        }
      } catch (upsertError) {
        console.error({
          event: 'swap_upsert_exception',
          poolAddress,
          chainId,
          swapData,
          error: upsertError.message,
          rawError: JSON.stringify(upsertError, Object.getOwnPropertyNames(upsertError)),
        });
        onFailedProcessSwap(poolAddress, `Swap upsert exception: ${upsertError.message}`);
        continue;
      }

      try {
        await updateUserAndTokenVolumes(
          supabase,
          userAddress,
          poolInfo.token0,
          poolInfo.token1,
          amount0.toString(),
          amount1.toString(),
          poolAddress,
          swap.blockNumber,
          tokenSymbols,
          provider,
          tokenList,
          chainId
        );
      } catch (volumeError) {
        console.error({
          event: 'volume_update_failed',
          poolAddress,
          chainId,
          blockNumber: swap.blockNumber,
          error: volumeError.message,
        });
        onFailedUpdateVolumes(poolAddress, volumeError.message);
      }
    }
  } catch (error) {
    console.error({
      event: 'swap_query_failed',
      poolAddress,
      chainId,
      fromBlock,
      toBlock,
      error: error.message,
      rawError: JSON.stringify(error, Object.getOwnPropertyNames(error)),
    });
    onFailedProcessSwap(poolAddress, `Failed to query swaps: ${error.message}`);
    throw error;
  }
}

module.exports = { indexSwapsForPool, getRealUserAddress };