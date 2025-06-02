const { ethers } = require('ethers');
const { getTokenDecimals } = require('../utils/ethers');

async function updateUserAndTokenVolumes(
  supabase,
  userAddress,
  token0,
  token1,
  amount0,
  amount1,
  poolAddress,
  blockNumber,
  tokenSymbols,
  provider,
  tokenList,
  chainId
) {
  console.debug({
    event: 'updateUserAndTokenVolumes_start',
    chainId,
    userAddress,
    token0,
    token1,
    amount0,
    amount1,
    poolAddress,
    blockNumber,
  });

  try {
    if (!ethers.isAddress(userAddress)) throw new Error(`Invalid userAddress: ${userAddress}`);
    if (!ethers.isAddress(token0) || !ethers.isAddress(token1)) throw new Error(`Invalid token addresses`);
    if (!ethers.isAddress(poolAddress)) throw new Error(`Invalid poolAddress: ${poolAddress}`);
    if (!chainId || typeof chainId !== 'number') throw new Error(`Invalid chainId: ${chainId}`);
    if (!amount0 || !amount1) throw new Error(`Invalid amounts`);

    const validTokens = new Set(tokenList.map(t => t.address.toLowerCase()));
    const processToken0 = validTokens.has(token0.toLowerCase());
    const processToken1 = validTokens.has(token1.toLowerCase());

    let rawAmount0, rawAmount1;
    try {
      rawAmount0 = BigInt(amount0);
      rawAmount1 = BigInt(amount1);
    } catch (err) {
      throw new Error(`Failed to convert amounts: ${err.message}`);
    }
    const absAmount0 = rawAmount0 < 0n ? -rawAmount0 : rawAmount0;
    const absAmount1 = rawAmount1 < 0n ? -rawAmount1 : rawAmount1;

    // Update user
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('total_volume, total_swaps')
      .eq('address', userAddress)
      .eq('chain_id', chainId)
      .single();

    if (userError && userError.code !== 'PGRST116') {
      throw new Error(`User select failed: ${userError.message}`);
    }

    const userVolume = userData ? BigInt(userData.total_volume || '0') + absAmount0 + absAmount1 : absAmount0 + absAmount1;
    const userSwaps = userData ? userData.total_swaps + 1 : 1;

    const { error: upsertUserError } = await supabase
      .from('users')
      .upsert(
        { address: userAddress, total_volume: userVolume.toString(), total_swaps: userSwaps, chain_id: chainId },
        { onConflict: ['address', 'chain_id'] }
      );
    if (upsertUserError) {
      throw new Error(`User upsert failed: ${upsertUserError.message}`);
    }

    // Update pool volume (handled by trigger, but verify)
    const { data: poolData, error: poolError } = await supabase
      .from('pools')
      .select('volume')
      .eq('pool_address', poolAddress)
      .eq('chain_id', chainId)
      .single();

    if (poolError && poolError.code !== 'PGRST116') {
      throw new Error(`Pool select failed: ${poolError.message}`);
    }

    // Update token0
    if (processToken0 && rawAmount0 !== 0n) {
      const { data: token0Data, error: token0Error } = await supabase
        .from('tokens')
        .select('total_volume, total_swaps')
        .eq('address', token0)
        .eq('chain_id', chainId)
        .single();
      if (token0Error && token0Error.code !== 'PGRST116') {
        throw new Error(`Token0 select failed: ${token0Error.message}`);
      }

      const token0Volume = token0Data ? BigInt(token0Data.total_volume || '0') + absAmount0 : absAmount0;
      const token0Swaps = token0Data ? token0Data.total_swaps + 1 : 1;

      const { error: upsertToken0Error } = await supabase
        .from('tokens')
        .upsert(
          {
            address: token0,
            symbol: tokenSymbols[token0.toLowerCase()] || 'UNKNOWN',
            total_volume: token0Volume.toString(),
            total_swaps: token0Swaps,
            chain_id: chainId,
          },
          { onConflict: ['address', 'chain_id'] }
        );
      if (upsertToken0Error) {
        throw new Error(`Token0 upsert failed: ${upsertToken0Error.message}`);
      }

      const { data: tv0Data, error: tv0Error } = await supabase
        .from('token_volumes')
        .select('volume, swaps')
        .eq('user_address', userAddress)
        .eq('token_address', token0)
        .eq('chain_id', chainId)
        .eq('pool_address', poolAddress)
        .single();
      if (tv0Error && tv0Error.code !== 'PGRST116') {
        throw new Error(`Token0 volume select failed: ${tv0Error.message}`);
      }

      const tv0Volume = tv0Data ? BigInt(tv0Data.volume || '0') + absAmount0 : absAmount0;
      const tv0Swaps = tv0Data ? tv0Data.swaps + 1 : 1;

      const { error: upsertTv0Error } = await supabase
        .from('token_volumes')
        .upsert(
          {
            user_address: userAddress,
            token_address: token0,
            pool_address: poolAddress,
            volume: tv0Volume.toString(),
            swaps: tv0Swaps,
            chain_id: chainId,
          },
          { onConflict: ['user_address', 'token_address', 'pool_address', 'chain_id'] }
        );
      if (upsertTv0Error) {
        throw new Error(`Token0 volume upsert failed: ${upsertTv0Error.message}`);
      }
    }

    // Update token1
    if (processToken1 && rawAmount1 !== 0n) {
      const { data: token1Data, error: token1Error } = await supabase
        .from('tokens')
        .select('total_volume, total_swaps')
        .eq('address', token1)
        .eq('chain_id', chainId)
        .single();
      if (token1Error && token1Error.code !== 'PGRST116') {
        throw new Error(`Token1 select failed: ${token1Error.message}`);
      }

      const token1Volume = token1Data ? BigInt(token1Data.total_volume || '0') + absAmount1 : absAmount1;
      const token1Swaps = token1Data ? token1Data.total_swaps + 1 : 1;

      const { error: upsertToken1Error } = await supabase
        .from('tokens')
        .upsert(
          {
            address: token1,
            symbol: tokenSymbols[token1.toLowerCase()] || 'UNKNOWN',
            total_volume: token1Volume.toString(),
            total_swaps: token1Swaps,
            chain_id: chainId,
          },
          { onConflict: ['address', 'chain_id'] }
        );
      if (upsertToken1Error) {
        throw new Error(`Token1 upsert failed: ${upsertToken1Error.message}`);
      }

      const { data: tv1Data, error: tv1Error } = await supabase
        .from('token_volumes')
        .select('volume, swaps')
        .eq('user_address', userAddress)
        .eq('token_address', token1)
        .eq('chain_id', chainId)
        .eq('pool_address', poolAddress)
        .single();
      if (tv1Error && tv1Error.code !== 'PGRST116') {
        throw new Error(`Token1 volume select failed: ${tv1Error.message}`);
      }

      const tv1Volume = tv1Data ? BigInt(tv1Data.volume || '0') + absAmount1 : absAmount1;
      const tv1Swaps = tv1Data ? tv1Data.swaps + 1 : 1;

      const { error: upsertTv1Error } = await supabase
        .from('token_volumes')
        .upsert(
          {
            user_address: userAddress,
            token_address: token1,
            pool_address: poolAddress,
            volume: tv1Volume.toString(),
            swaps: tv1Swaps,
            chain_id: chainId,
          },
          { onConflict: ['user_address', 'token_address', 'pool_address', 'chain_id'] }
        );
      if (upsertTv1Error) {
        throw new Error(`Token1 volume upsert failed: ${upsertTv1Error.message}`);
      }
    }

    console.debug({ event: 'updateUserAndTokenVolumes_success', chainId, userAddress, poolAddress });
  } catch (error) {
    console.error({
      event: 'updateUserAndTokenVolumes_error',
      chainId,
      userAddress,
      poolAddress,
      blockNumber,
      error: error.message,
    });
    throw error;
  }
}

module.exports = { updateUserAndTokenVolumes };