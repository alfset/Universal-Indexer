const { ethers } = require('ethers');
const fs = require('fs').promises;
const path = require('path');
const { initSupabase } = require('../utils/supabase/server');
const { initProvider } = require('../utils/ethers');
const { fetchPools } = require('../lib/poolIndexer');
const { indexSwapsForPool } = require('../lib/swapIndexer');
const { chains } = require('../config/chain');
const { generateTokenPairsWithFees } = require('../utils/index');
const { ensureBlockFile, readBlockData, writeBlockData } = require('../utils/blocks');
const universalRouterAbi = require('../lib/universalRouterAbi.json');

const BLOCK_BATCH_SIZE = 10;
const CHAIN_DELAY_MS = 1000;

async function initIndexer({
  onPoolFound = (poolAddress, token0, token1, fee) =>
    console.log({ event: 'pool_found', poolAddress, token0, token1, fee }),
  onIndexingSwaps = (poolAddress, startBlock, endBlock) =>
    console.log({ event: 'indexing_swaps', poolAddress, startBlock, endBlock }),
  onFailedUpdateVolumes = (poolAddress, error) =>
    console.error({ event: 'failed_update_volumes', poolAddress, error }),
  onFailedProcessSwap = (poolAddress, error) =>
    console.error({ event: 'failed_process_swap', poolAddress, error }),
} = {}) {
  console.debug({ event: 'initIndexer_start' });
  const supabase = initSupabase();
  const universalRouterInterface = new ethers.Interface(universalRouterAbi);

  for (const [chainKey, chainConfig] of Object.entries(chains)) {
    console.debug({ event: 'validate_chain_config', chainKey, chainId: chainConfig.chainId });
    if (!chainConfig.rpcUrl || chainConfig.factoryAddress === '0x0000000000000000000000000000000000000000') {
      continue;
    }
    const blockFilePath = path.join(__dirname, `../config/blocks/${chainKey}.json`);
    await ensureBlockFile(blockFilePath, chainConfig.fromBlock);
  }

  while (true) {
    for (const [chainKey, chainConfig] of Object.entries(chains)) {
      if (!chainConfig.rpcUrl || chainConfig.factoryAddress === '0x0000000000000000000000000000000000000000') {
        continue;
      }

      let provider;
      try {
        provider = initProvider(chainConfig.rpcUrl);
        await provider.getNetwork();
      } catch (error) {
        console.error({
          event: 'provider_init_failed',
          chainKey,
          chainId: chainConfig.chainId,
          rpcUrl: chainConfig.rpcUrl,
          error: error.message,
        });
        await new Promise(resolve => setTimeout(resolve, CHAIN_DELAY_MS));
        continue;
      }

      try {
        const tokenList = JSON.parse(await fs.readFile(chainConfig.tokenListPath, 'utf8')).tokens;
        const tokenPairsWithFees = generateTokenPairsWithFees(tokenList, [500, 3000, 10000]);
        const tokenSymbols = Object.fromEntries(tokenList.map(token => [token.address.toLowerCase(), token.symbol]));
        const knownRouters = Array.isArray(chainConfig.knownRouters)
          ? new Set(chainConfig.knownRouters.map(r => r.toLowerCase()))
          : new Set();

        const blockFilePath = path.join(__dirname, `../config/blocks/${chainKey}.json`);
        const blockData = await readBlockData(blockFilePath);
        let fromBlock = blockData.fromBlock;

        let latestBlock;
        try {
          latestBlock = await provider.getBlockNumber();
        } catch (error) {
          console.error({
            event: 'get_block_number_failed',
            chainKey,
            chainId: chainConfig.chainId,
            error: error.message,
          });
          await new Promise(resolve => setTimeout(resolve, CHAIN_DELAY_MS));
          continue;
        }

        if (fromBlock < latestBlock - 10000) {
          fromBlock = latestBlock - 1000; // Catch up if too far behind
          await writeBlockData(blockFilePath, { fromBlock });
        }

        const toBlock = Math.min(fromBlock + BLOCK_BATCH_SIZE - 1, latestBlock);

        if (fromBlock > latestBlock) {
          console.debug({ event: 'block_ahead', chainId: chainConfig.chainId, fromBlock, latestBlock });
          await new Promise(resolve => setTimeout(resolve, CHAIN_DELAY_MS));
          continue;
        }

        console.debug({ event: 'fetching_pools', chainId: chainConfig.chainId, fromBlock, toBlock });
        let pools;
        try {
          pools = await fetchPools(
            chainConfig,
            provider,
            supabase,
            tokenList,
            tokenPairsWithFees,
            tokenSymbols,
            { onPoolFound, onFailedUpdateVolumes }
          );
          console.debug({ event: 'pools_fetched', chainId: chainConfig.chainId, poolCount: pools.length });
        } catch (poolError) {
          console.error({
            event: 'pool_fetching_error',
            chainId: chainConfig.chainId,
            fromBlock,
            toBlock,
            error: poolError.message,
            rawError: JSON.stringify(poolError, Object.getOwnPropertyNames(poolError)),
          });
          await new Promise(resolve => setTimeout(resolve, CHAIN_DELAY_MS));
          continue;
        }

        console.debug({ event: 'indexing_swaps_for_pools', chainId: chainConfig.chainId, fromBlock, toBlock, poolCount: pools.length });
        for (const pool of pools) {
          const poolInfo = {
            token0: pool.token0,
            token1: pool.token1,
            fee: pool.fee,
          };
          try {
            await indexSwapsForPool(
              pool.poolAddress,
              poolInfo,
              provider,
              supabase,
              tokenSymbols,
              knownRouters,
              universalRouterInterface,
              chainConfig.chainId,
              tokenList,
              fromBlock,
              toBlock,
              { onIndexingSwaps, onFailedUpdateVolumes, onFailedProcessSwap }
            );
          } catch (swapError) {
            console.error({
              event: 'swap_indexing_error',
              chainId: chainConfig.chainId,
              poolAddress: pool.poolAddress,
              fromBlock,
              toBlock,
              error: swapError.message,
              rawError: JSON.stringify(swapError, Object.getOwnPropertyNames(swapError)),
            });
            onFailedProcessSwap(pool.poolAddress, `Swap indexing failed: ${swapError.message}`);
          }
        }

        fromBlock = toBlock + 1;
        await writeBlockData(blockFilePath, { fromBlock });
        console.debug({ event: 'blocks_processed', chainId: chainConfig.chainId, fromBlock: toBlock + 1, toBlock });
        await new Promise(resolve => setTimeout(resolve, CHAIN_DELAY_MS));
      } catch (error) {
        console.error({
          event: 'index_chain_error',
          chainKey,
          chainId: chainConfig.chainId,
          error: error.message,
          rawError: JSON.stringify(error, Object.getOwnPropertyNames(error)),
        });
        await new Promise(resolve => setTimeout(resolve, CHAIN_DELAY_MS));
      }
    }
  }
}

function startIndexer() {
  return initIndexer();
}

module.exports = { startIndexer, initIndexer };