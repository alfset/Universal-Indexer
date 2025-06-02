const express = require('express');
const { ethers } = require('ethers');
const { initSupabase } = require('../utils/supabase/server');
const { loadTokenList } = require('../utils');
const { getTopUsersByVolume, getTopUsersAllChains } = require('../lib/volumeAnalytics');
const { chains } = require('../config/chain');

const router = express.Router();
const supabase = initSupabase();

router.get('/chains', async (req, res) => {
  try {
    const chainList = Object.entries(chains).map(([key, config]) => ({
      chainId: config.chainId,
      name: config.name,
    }));
    res.json(chainList);
  } catch (error) {
    console.error('Error fetching chains:', error.message);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

router.get('/:chainId/swaps', async (req, res) => {
  const { chainId } = req.params;
  const { limit = 100, offset = 0 } = req.query;

  try {
    if (!Number.isInteger(Number(chainId)) || Number(chainId) <= 0) {
      return res.status(400).json({ error: 'Invalid chainId' });
    }
    if (!Number.isInteger(Number(limit)) || Number(limit) <= 0) {
      return res.status(400).json({ error: 'Invalid limit' });
    }
    if (!Number.isInteger(Number(offset)) || Number(offset) < 0) {
      return res.status(400).json({ error: 'Invalid offset' });
    }

    const { data, error } = await supabase
      .from('swaps')
      .select('*')
      .eq('chain_id', chainId)
      .order('block_number', { ascending: false })
      .range(offset, parseInt(offset) + parseInt(limit) - 1);

    if (error) throw new Error(`Supabase query failed: ${error.message}`);
    res.json(data);
  } catch (error) {
    console.error(`Error fetching swaps for chain ${chainId}:`, error.message);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

async function handleTopTokensAllChains(req, res) {
  try {
    const now = new Date();
    const periods = {
      daily: new Date(now - 24 * 60 * 60 * 1000).toISOString(),
      weekly: new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString(),
      monthly: new Date(now - 30 * 24 * 60 * 60 * 1000).toISOString(),
    };

    const results = {};
    const allTokens = new Map();
    for (const chain of Object.values(chains)) {
      const tokens = await loadTokenList(chain.chainId);
      tokens.forEach(t => allTokens.set(`${t.address.toLowerCase()}:${chain.chainId}`, t.symbol));
    }

    for (const [period, since] of Object.entries(periods)) {
      const { data: swaps, error: swapError } = await supabase
        .from('swaps')
        .select('token0, amount0, chain_id') // Changed: Only select token0 and amount0
        .gte('timestamp', since);

      if (swapError) throw new Error(`Supabase query failed: ${swapError.message}`);

      const tokenVolumes = new Map();
      for (const swap of swaps) {
        const token0Key = `${swap.token0.toLowerCase()}:${swap.chain_id}`;
        if (!allTokens.has(token0Key)) continue; // Changed: Only process token0 if in token list

        const absAmount0 = BigInt(Math.abs(swap.amount0)); // Changed: Only use amount0
        tokenVolumes.set(token0Key, (tokenVolumes.get(token0Key) || 0n) + absAmount0); // Changed: Accumulate token0 volume
      }

      const topTokens = Array.from(tokenVolumes.entries())
        .map(([key, volume]) => {
          const [address, chainId] = key.split(':');
          return {
            address, // Changed: Return token address, not user address
            chain_id: parseInt(chainId),
            symbol: allTokens.get(key) || 'UNKNOWN',
            volume: volume.toString(),
          };
        })
        .sort((a, b) => BigInt(b.volume) > BigInt(a.volume) ? -1 : 1)
        .slice(0, 5);

      results[period] = topTokens;
    }

    res.json(results);
  } catch (error) {
    console.error('Error fetching top tokens across all chains:', error.message);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
}

async function handleLatestSwaps(req, res) {
  const { limit = 10 } = req.query;

  try {
    if (!Number.isInteger(Number(limit)) || Number(limit) <= 0) {
      return res.status(400).json({ error: 'Invalid limit' });
    }

    const allTokens = new Map();
    for (const chain of Object.values(chains)) {
      const tokens = await loadTokenList(chain.chainId);
      tokens.forEach(t => allTokens.set(`${t.address.toLowerCase()}:${chain.chainId}`, t.symbol));
    }

    const { data, error } = await supabase
      .from('swaps')
      .select('*, chains(name)')
      .order('timestamp', { ascending: false })
      .limit(Number(limit));

    if (error) throw new Error(`Supabase query failed: ${error.message}`);

    const filteredData = data.filter(swap => {
      const token0Key = `${swap.token0.toLowerCase()}:${swap.chain_id}`;
      const token1Key = `${swap.token1.toLowerCase()}:${swap.chain_id}`;
      return allTokens.has(token0Key) || allTokens.has(token1Key);
    });

    res.json(filteredData);
  } catch (error) {
    console.error('Error fetching latest swaps:', error.message);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
}

async function handleTopUsersByTokenVolume(req, res) {
  const { chainId, tokenAddress } = req.params;

  try {
    if (!Number.isInteger(Number(chainId)) || Number(chainId) <= 0) {
      return res.status(400).json({ error: 'Invalid chainId' });
    }
    if (!ethers.isAddress(tokenAddress)) {
      return res.status(400).json({ error: 'Invalid tokenAddress' });
    }

    const tokenList = await loadTokenList(chainId);
    const token = tokenList.find(t => t.address.toLowerCase() === tokenAddress.toLowerCase());
    if (!token) {
      return res.status(400).json({ error: 'Token not found in token list' });
    }

    const { data: tokenVolumes, error: tvError } = await supabase
      .from('token_volumes')
      .select('user_address, volume, swaps')
      .eq('chain_id', chainId)
      .eq('token_address', tokenAddress);

    if (tvError) throw new Error(`Supabase query failed: ${tvError.message}`);

    const topUsers = tokenVolumes
      .map((tokenVolume) => ({
        user: tokenVolume.user_address, // Returns user address
        volume: tokenVolume.volume.toString(),
        swaps: tokenVolume.swaps,
      }))
      .sort((a, b) => BigInt(b.volume) > BigInt(a.volume) ? -1 : 1)
      .slice(0, 10);

    res.json({
      token_address: tokenAddress,
      symbol: token.symbol || 'UNKNOWN',
      chain_id: parseInt(chainId),
      top_users: topUsers,
    });
  } catch (error) {
    console.error(`Error fetching top users for token ${tokenAddress} on chain ${chainId}:`, error.message);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
}

async function handleTopTokensByChain(req, res) {
  const { chainId } = req.params;

  try {
    if (!Number.isInteger(Number(chainId)) || Number(chainId) <= 0) {
      return res.status(400).json({ error: 'Invalid chainId' });
    }

    const tokenList = await loadTokenList(chainId);
    const validTokens = new Set(tokenList.map(t => t.address.toLowerCase()));

    const now = new Date();
    const periods = {
      daily: new Date(now - 24 * 60 * 60 * 1000).toISOString(),
      weekly: new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString(),
      monthly: new Date(now - 30 * 24 * 60 * 60 * 1000).toISOString(),
    };

    const results = {};
    for (const [period, since] of Object.entries(periods)) {
      const { data: swaps, error: swapError } = await supabase
        .from('swaps')
        .select('token0, amount0') // Changed: Only select token0 and amount0
        .eq('chain_id', chainId)
        .gte('timestamp', since);

      if (swapError) throw new Error(`Supabase query failed: ${swapError.message}`);

      const tokenVolumes = new Map();
      for (const swap of swaps) {
        if (validTokens.has(swap.token0.toLowerCase())) { // Changed: Only process token0
          const absAmount0 = BigInt(Math.abs(swap.amount0)); // Changed: Only use amount0
          tokenVolumes.set(swap.token0.toLowerCase(), (tokenVolumes.get(swap.token0.toLowerCase()) || 0n) + absAmount0); // Changed: Accumulate token0 volume
        }
      }

      const symbolMap = Object.fromEntries(tokenList.map(t => [t.address.toLowerCase(), t.symbol]));
      const topTokens = Array.from(tokenVolumes.entries())
        .map(([address, volume]) => ({
          address, // Changed: Return token address, not user address
          symbol: symbolMap[address] || 'UNKNOWN',
          volume: volume.toString(),
        }))
        .sort((a, b) => BigInt(b.volume) > BigInt(a.volume) ? -1 : 1)
        .slice(0, 3);

      results[period] = topTokens;
    }

    res.json(results);
  } catch (error) {
    console.error(`Error fetching top tokens for chain ${chainId}:`, error.message);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
}

async function handleTopUsers(req, res) {
  const { chainId } = req.params;

  try {
    if (!Number.isInteger(Number(chainId)) || Number(chainId) <= 0) {
      return res.status(400).json({ error: 'Invalid chainId' });
    }

    const { data: users, error: userError } = await supabase
      .from('users')
      .select('address, total_volume')
      .eq('chain_id', chainId)
      .order('total_volume', { ascending: false })
      .limit(10);

    if (userError) throw new Error(`Supabase query failed: ${userError.message}`);

    const topUsers = users.map(u => ({
      user: u.address, // Returns user address
      volume: u.total_volume.toString(),
    }));

    res.json(topUsers);
  } catch (error) {
    console.error(`Error fetching top users for chain ${chainId}:`, error.message);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
}

router.get('/top-tokens-all-chains', handleTopTokensAllChains);
router.get('/latest-swaps', handleLatestSwaps);
router.get('/:chainId/top-users-by-token/:tokenAddress', handleTopUsersByTokenVolume);
router.get('/:chainId/top-tokens', handleTopTokensByChain);
router.get('/:chainId/top-users', handleTopUsers);
router.get('/:chainId/top-users-volume/:period', async (req, res) => {
  const { chainId, period } = req.params;
  const { limit = 10 } = req.query;

  try {
    if (!Number.isInteger(Number(chainId)) || Number(chainId) <= 0) {
      return res.status(400).json({ error: 'Invalid chainId' });
    }
    if (!['daily', 'weekly', 'monthly'].includes(period)) {
      return res.status(400).json({ error: 'Invalid period' });
    }
    if (!Number.isInteger(Number(limit)) || Number(limit) <= 0) {
      return res.status(400).json({ error: 'Invalid limit' });
    }

    const topUsers = await getTopUsersByVolume(supabase, chainId, period, Number(limit));
    res.json({
      chain_id: parseInt(chainId),
      period,
      top_users: topUsers, // Returns user addresses
    });
  } catch (error) {
    console.error(`Error fetching top users for chain ${chainId}, period ${period}:`, error.message);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

router.get('/top-users-volume-all-chains/:period', async (req, res) => {
  const { period } = req.params;
  const { limit = 10 } = req.query;

  try {
    if (!['daily', 'weekly', 'monthly'].includes(period)) {
      return res.status(400).json({ error: 'Invalid period' });
    }
    if (!Number.isInteger(Number(limit)) || Number(limit) <= 0) {
      return res.status(400).json({ error: 'Invalid limit' });
    }

    const topUsers = await getTopUsersAllChains(supabase, period, Number(limit));
    res.json({
      period,
      top_users: topUsers, // Returns user addresses
    });
  } catch (error) {
    console.error(`Error fetching top users across all chains, period ${period}:`, error.message);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

module.exports = router;