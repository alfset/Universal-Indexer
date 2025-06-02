const path = require('path');

const chains = {
/**   eth: {
    chainId: 1,
    name: 'Ethereum',
    rpcUrl: process.env.ETH_RPC_URL,
    factoryAddress: process.env.ETH_FACTORY_ADDRESS || '0x1F98431c8aD98523631AE4a59f267346ea31F984',
    tokenListPath: path.join(__dirname, 'tokens/eth.json'),
    knownRouters: new Set([
      '0x66a9893cc07d91d95644aedd05d03f95e1dba8af'.toLowerCase(),
      '0xE592427A0AEce92De3Edee1F18E0157C05861564'.toLowerCase(),
      '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D'.toLowerCase(),
      '0x7C59A6fbD368e398D2f2A4b31D73C6529529FfE4'.toLowerCase(),
    ]),
    fromBlock: 22605800, 
  },
  base: {
    chainId: 8453,
    name: 'Base',
    rpcUrl: process.env.BASE_RPC_URL,
    factoryAddress: process.env.BASE_FACTORY_ADDRESS || '0x33128a8fC178698f8B394Ec3f3b336d8b996a8f7',
    tokenListPath: path.join(__dirname, 'tokens/base.json'),
    knownRouters: new Set([
      '0x6ff5693b99212da76ad316178a184ab56d299b43'.toLowerCase(),
      '0xE592427A0AEce92De3Edee1F18E0157C05861564'.toLowerCase(),
    ]),
    fromBlock: 30969250, 
  }, **/
  planq: {
    chainId: 7070,
    name: 'Planq',
    rpcUrl: process.env.PLANQ_RPC_URL || 'https://jsonrpc.planq.nodestake.top',
    factoryAddress: process.env.PLANQ_FACTORY_ADDRESS || '0xFF4F8f857fd60142a135aB139C16370da89c76c2',
    tokenListPath: path.join(__dirname, 'tokens/planq.json'),
    knownRouters: [
      '0x7C59A6fbD368e398D2f2A4b31D73C6529529FfE4', // Planq Universal Router
      // Add other known routers if applicable
    ],
    fromBlock: 14859328, 
  }, /** 
  bsc: {
    chainId: 56,
    name: 'BNB Smart Chain',
    rpcUrl: process.env.BSC_RPC_URL || 'https://bsc-dataseed.binance.org',
    factoryAddress: process.env.BSC_FACTORY_ADDRESS || '0xcA143Ce32Fe78f1f7019d7d551a6402fC5350c73',
    tokenListPath: path.join(__dirname, 'tokens/bsc.json'),
    knownRouters: new Set([
      '0x1906c1d672b88cd1b9ac7593301ca990f94eae07'.toLowerCase(),
      '0x10ED43C718714eb63d5aA57B78B54704E256024E'.toLowerCase(),
      '0x3fC91A3afd70395Cd496C647d5a6CC9D4B2b7FAD'.toLowerCase(),
    ]),
    fromBlock: 50659300, 
  },
  polygon: {
    chainId: 137,
    name: 'Polygon',
    rpcUrl: process.env.POLYGON_RPC_URL || 'https://polygon-rpc.com',
    factoryAddress: process.env.POLYGON_FACTORY_ADDRESS || '0x1F98431c8aD98523631AE4a59f267346ea31F984',
    tokenListPath: path.join(__dirname, 'tokens/polygon.json'),
    knownRouters: new Set([
      '0x1095692A6237d83C6a72F3F5eFEdb9A670C49223'.toLowerCase(),

    ]),
    fromBlock: 72207200,
  },
  avalanche: {
    chainId: 43114,
    name: 'Avalanche C-Chain',
    rpcUrl: process.env.AVALANCHE_RPC_URL || 'https://api.avax.network/ext/bc/C/rpc',
    factoryAddress: process.env.AVALANCHE_FACTORY_ADDRESS || '0x740b1c1de25031C31FF4fC9A62f554A55cdC1baD',
    tokenListPath: path.join(__dirname, 'tokens/avalanche.json'),
    knownRouters: new Set([
      '0x94b75331ae8d42c1b61065089b7d48fe14aa73b7'.toLowerCase(),
      '0xE592427A0AEce92De3Edee1F18E0157C05861564'.toLowerCase(),
    ]),
    fromBlock: 1695700, 
  }, */
};

module.exports = { chains };