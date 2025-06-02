const fs = require('fs').promises;
const { chains } = require('../config/chain');

async function loadTokenList(chainId) {
  const chainConfig = Object.values(chains).find(c => c.chainId === parseInt(chainId));
  if (!chainConfig || !chainConfig.tokenListPath) {
    console.warn(`No token list path for chainId ${chainId}`);
    return [];
  }
  try {
    const tokenList = JSON.parse(await fs.readFile(chainConfig.tokenListPath, 'utf8')).tokens;
    return tokenList.map(t => ({ address: t.address.toLowerCase(), symbol: t.symbol }));
  } catch (error) {
    console.error(`Error loading token list for chainId ${chainId}: ${error}`);
    return [];
  }
}

function generateTokenPairsWithFees(tokenList, feeTiers) {
  const tokenPairsWithFees = [];
  for (let i = 0; i < tokenList.length; i++) {
    for (let j = i + 1; j < tokenList.length; j++) {
      for (const fee of feeTiers) {
        tokenPairsWithFees.push({
          tokenA: tokenList[i].address,
          tokenB: tokenList[j].address,
          fee,
        });
      }
    }
  }
  return tokenPairsWithFees;
}

module.exports = { loadTokenList, generateTokenPairsWithFees };