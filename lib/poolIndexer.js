const { ethers } = require('ethers');

async function fetchPools(
  chainConfig,
  provider,
  supabase,
  tokenList,
  tokenPairsWithFees,
  tokenSymbols,
  {
    onPoolFound = () => {},
    onFailedUpdateVolumes = () => {},
  }
) {
  console.debug({
    event: 'fetchPools_start',
    chainId: chainConfig.chainId,
    chainName: chainConfig.name,
    factoryAddress: chainConfig.factoryAddress,
    pairCount: tokenPairsWithFees.length,
  });

  if (chainConfig.factoryAddress === '0x0000000000000000000000000000000000000000') {
    console.log({
      event: 'fetchPools_no_factory',
      chainId: chainConfig.chainId,
      chainName: chainConfig.name,
    });
    return [];
  }

  if (!ethers.isAddress(chainConfig.factoryAddress)) {
    console.error({
      event: 'fetchPools_invalid_factory',
      chainId: chainConfig.chainId,
      factoryAddress: chainConfig.factoryAddress,
    });
    throw new Error(`Invalid factory address: ${chainConfig.factoryAddress}`);
  }

  const factoryContract = new ethers.Contract(
    chainConfig.factoryAddress,
    ['function getPool(address tokenA, address tokenB, uint24 fee) external view returns (address pool)'],
    provider
  );

  const successfulPools = [];
  const validTokens = new Set(tokenList.map(t => t.address.toLowerCase()));

  for (const { tokenA, tokenB, fee } of tokenPairsWithFees) {
    if (!ethers.isAddress(tokenA) || !ethers.isAddress(tokenB)) {
      console.warn({
        event: 'invalid_token_addresses',
        chainId: chainConfig.chainId,
        tokenA,
        tokenB,
        fee,
      });
      continue;
    }

    if (!validTokens.has(tokenA.toLowerCase()) && !validTokens.has(tokenB.toLowerCase())) {
      console.debug({
        event: 'skip_invalid_tokens',
        chainId: chainConfig.chainId,
        tokenA,
        tokenB,
        fee,
      });
      continue;
    }

    try {
      const [token0, token1] = tokenA.toLowerCase() < tokenB.toLowerCase() ? [tokenA, tokenB] : [tokenB, tokenA];

      console.debug({
        event: 'query_pool',
        chainId: chainConfig.chainId,
        token0,
        token1,
        fee,
      });

      const pool = await factoryContract.getPool(token0, token1, fee);
      if (pool === '0x0000000000000000000000000000000000000000') {
        console.debug({
          event: 'pool_not_found',
          chainId: chainConfig.chainId,
          token0,
          token1,
          fee,
        });
        continue;
      }

      if (!ethers.isAddress(pool)) {
        console.warn({
          event: 'invalid_pool_address',
          chainId: chainConfig.chainId,
          pool,
          token0,
          token1,
          fee,
        });
        continue;
      }

      onPoolFound(pool, token0, token1, fee);
      console.log(`Found pool: ${pool} (Token0: ${tokenSymbols[token0.toLowerCase()]}, Token1: ${tokenSymbols[token1.toLowerCase()]}, Fee: ${fee})`);

      let totalVolume = 0n;
      try {
        const { data: swaps, error: swapError } = await supabase
          .from('swaps')
          .select('amount0, amount1')
          .eq('pool_address', pool)
          .eq('chain_id', chainConfig.chainId);

        if (swapError) {
          console.error({
            event: 'swap_query_error',
            chainId: chainConfig.chainId,
            pool,
            error: swapError?.message || JSON.stringify(swapError, Object.getOwnPropertyNames(swapError)),
          });
          throw new Error(`Swap query failed: ${swapError?.message || 'Unknown error'}`);
        }

        totalVolume = swaps.reduce((sum, swap) => {
          return sum + BigInt(swap.amount0 < 0 ? -swap.amount0 : swap.amount0) + BigInt(swap.amount1 < 0 ? -swap.amount1 : swap.amount1);
        }, 0n);
      } catch (error) {
        console.warn({
          event: 'swap_volume_calculation_failed',
          chainId: chainConfig.chainId,
          pool,
          error: error.message,
        });
      }

      console.debug({
        event: 'upsert_pool_start',
        chainId: chainConfig.chainId,
        pool,
        upsertData: {
          chain_id: chainConfig.chainId,
          pool_address: pool,
          token0,
          token1,
          fee: Number(fee),
          volume: totalVolume.toString(),
        },
      });

      try {
        const { error: upsertError } = await supabase
          .from('pools')
          .upsert(
            {
              chain_id: chainConfig.chainId,
              pool_address: pool,
              token0,
              token1,
              fee: Number(fee),
              volume: totalVolume.toString(),
            },
            { onConflict: ['pool_address', 'chain_id'] }
          );

        if (upsertError) {
          console.error({
            event: 'pool_upsert_error',
            chainId: chainConfig.chainId,
            pool,
            error: upsertError?.message || JSON.stringify(upsertError, Object.getOwnPropertyNames(upsertError)),
          });
          throw new Error(`Pool upsert failed: ${upsertError?.message || 'Unknown error'}`);
        }
      } catch (error) {
        console.error({
          event: 'pool_upsert_failed',
          chainId: chainConfig.chainId,
          pool,
          error: error.message,
        });
        throw new Error(`Pool upsert failed: ${error.message}`);
      }

      successfulPools.push({ poolAddress: pool, token0, token1, fee: Number(fee) });
    } catch (error) {
      console.error({
        event: 'process_pool_error',
        chainId: chainConfig.chainId,
        tokenA,
        tokenB,
        fee,
        error: error.message,
        rawError: JSON.stringify(error, Object.getOwnPropertyNames(error)),
      });
      onFailedUpdateVolumes(`${tokenA}-${tokenB}-${fee}`, error.message);
    }
  }

  console.debug({
    event: 'fetchPools_end',
    chainId: chainConfig.chainId,
    successfulPoolCount: successfulPools.length,
  });
  return successfulPools;
}

module.exports = { fetchPools };