const { loadTokenList } = require('../utils');

async function getCachedTopUsers(supabase, chainId, period, limit) {
  const key = `top-users:${chainId}:${period}:${limit}`;
  try {
    const { data, error } = await supabase
      .from('cache')
      .select('data')
      .eq('key', key)
      .gte('expires_at', new Date().toISOString())
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null; // No results found
      console.error(`Cache read error: ${error.message}`);
      return null;
    }

    return data ? data.data : null;
  } catch (error) {
    console.error(`Unexpected cache read error: ${error.message}`);
    return null;
  }
}

async function setCachedTopUsers(supabase, chainId, period, limit, data) {
  const key = `top-users:${chainId}:${period}:${limit}`;
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString(); 
  try {
    const { error } = await supabase
      .from('cache')
      .upsert(
        {
          key,
          data: { data }, 
          expires_at: expiresAt,
        },
        { onConflict: ['key'] }
      );

    if (error) {
      console.error(`Cache write error: ${error.message}`);
    }
  } catch (error) {
    console.error(`Unexpected cache write error: ${error.message}`);
  }
}

async function getTopUsersByVolume(supabase, chainId, period, limit = 10) {
  const cached = await getCachedTopUsers(supabase, chainId, period, limit);
  if (cached) {
    console.debug({ event: 'cache_hit', chainId, period, limit });
    return cached;
  }

  const now = new Date();
  const periods = {
    daily: new Date(now - 24 * 60 * 60 * 1000).toISOString(),
    weekly: new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString(),
    monthly: new Date(now - 30 * 24 * 60 * 60 * 1000).toISOString(),
  };

  if (!periods[period]) {
    throw new Error(`Invalid period: ${period}`);
  }

  const tokenList = await loadTokenList(chainId);
  const validTokens = new Set(tokenList.map(t => t.address.toLowerCase()));

  const { data: swaps, error } = await supabase
    .from('swaps')
    .select('user_address, amount0, amount1, token0, token1')
    .eq('chain_id', chainId)
    .gte('timestamp', periods[period]);

  if (error) {
    throw new Error(`Swap query failed: ${error.message}`);
  }

  const userVolumes = new Map();
  for (const swap of swaps) {
    if (!validTokens.has(swap.token0.toLowerCase()) && !validTokens.has(swap.token1.toLowerCase())) {
      continue;
    }
    const volume = BigInt(Math.abs(swap.amount0)) + BigInt(Math.abs(swap.amount1));
    const current = userVolumes.get(swap.user_address) || 0n;
    userVolumes.set(swap.user_address, current + volume);
  }

  const topUsers = Array.from(userVolumes.entries())
    .map(([user, volume]) => ({ user, volume: volume.toString() }))
    .sort((a, b) => BigInt(b.volume) - BigInt(a.volume))
    .slice(0, limit);

  await setCachedTopUsers(supabase, chainId, period, limit, topUsers);
  return topUsers;
}

async function getTopUsersAllChains(supabase, period, limit = 10) {
  const cached = await getCachedTopUsers(supabase, 'all', period, limit);
  if (cached) {
    console.debug({ event: 'cache_hit', chainId: 'all', period, limit });
    return cached;
  }

  const now = new Date();
  const periods = {
    daily: new Date(now - 24 * 60 * 60 * 1000).toISOString(),
    weekly: new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString(),
    monthly: new Date(now - 30 * 24 * 60 * 60 * 1000).toISOString(),
  };

  if (!periods[period]) {
    throw new Error(`Invalid period: ${period}`);
  }

  const allTokens = new Map();
  const { chains } = require('../config/chain');
  for (const chain of Object.values(chains)) {
    const tokens = await loadTokenList(chain.chainId);
    tokens.forEach(t => allTokens.set(`${t.address.toLowerCase()}:${chain.chainId}`, t));
  }

  const { data: swaps, error } = await supabase
    .from('swaps')
    .select('user_address, amount0, amount1, token0, token1, chain_id')
    .gte('timestamp', periods[period]);

  if (error) {
    throw new Error(`Swap query failed: ${error.message}`);
  }

  const userVolumes = new Map();
  for (const swap of swaps) {
    const token0Key = `${swap.token0.toLowerCase()}:${swap.chain_id}`;
    const token1Key = `${swap.token1.toLowerCase()}:${swap.chain_id}`;
    if (!allTokens.has(token0Key) && !allTokens.has(token1Key)) {
      continue;
    }
    const volume = BigInt(Math.abs(swap.amount0)) + BigInt(Math.abs(swap.amount1));
    const key = `${swap.user_address}:${swap.chain_id}`;
    const current = userVolumes.get(key) || 0n;
    userVolumes.set(key, current + volume);
  }

  const topUsers = Array.from(userVolumes.entries())
    .map(([key, volume]) => {
      const [user, chain_id] = key.split(':');
      return { user, chain_id: parseInt(chain_id), volume: volume.toString() };
    })
    .sort((a, b) => BigInt(b.volume) - BigInt(a.volume))
    .slice(0, limit);

  await setCachedTopUsers(supabase, 'all', period, limit, topUsers);
  return topUsers;
}

module.exports = { getTopUsersByVolume, getTopUsersAllChains };