const fs = require('fs').promises;
const path = require('path');

async function ensurePoolBlockFile(chainId, poolAddress) {
  const blockFilePath = path.join(__dirname, `../config/blocks/${chainId}/${poolAddress.toLowerCase()}.json`);
  await fs.mkdir(path.dirname(blockFilePath), { recursive: true });
  try {
    await fs.access(blockFilePath);
  } catch {
    await fs.writeFile(blockFilePath, JSON.stringify({ lastProcessedBlock: 0 }));
  }
  return blockFilePath;
}

async function readPoolBlockData(chainId, poolAddress) {
  const blockFilePath = await ensurePoolBlockFile(chainId, poolAddress);
  const data = await fs.readFile(blockFilePath, 'utf8');
  return JSON.parse(data);
}

async function writePoolBlockData(chainId, poolAddress, data) {
  const blockFilePath = await ensurePoolBlockFile(chainId, poolAddress);
  await fs.writeFile(blockFilePath, JSON.stringify(data, null, 2));
}

module.exports = { ensurePoolBlockFile, readPoolBlockData, writePoolBlockData };