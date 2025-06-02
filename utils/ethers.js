const { ethers } = require('ethers');

async function withRetry(fn, retries = 5, initialDelayMs = 2000) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (attempt === retries) {
        throw error;
      }
      const delay = initialDelayMs * Math.pow(2, attempt - 1);
      console.warn(`Attempt ${attempt} failed, retrying in ${delay}ms: ${error.message}`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}

async function getTokenDecimals(tokenAddress, provider, tokenList) {
  const token = tokenList.find(t => t.address.toLowerCase() === tokenAddress.toLowerCase());
  if (token && token.decimals) {
    return token.decimals;
  }
  try {
    const tokenContract = new ethers.Contract(
      tokenAddress,
      ['function decimals() view returns (uint8)'],
      provider
    );
    const decimals = await tokenContract.decimals();
    const decimalsNumber = Number(decimals);
    if (isNaN(decimalsNumber) || decimalsNumber < 0 || decimalsNumber > 255) {
      throw new Error(`Invalid decimals value: ${decimals}`);
    }
    return decimalsNumber;
  } catch (error) {
    console.warn(`Failed to fetch decimals for token ${tokenAddress}, defaulting to 18: ${error.message}`);
    return 18;
  }
}

function initProvider(rpcUrl) {
  return new ethers.JsonRpcProvider(rpcUrl);
}

module.exports = { withRetry, getTokenDecimals, initProvider };