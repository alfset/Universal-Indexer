const fs = require('fs').promises;
const path = require('path');

async function ensureBlockFile(blockFilePath, fromBlock) {
  try {
    await fs.access(blockFilePath);
  } catch {
    await fs.mkdir(path.dirname(blockFilePath), { recursive: true });
    await fs.writeFile(blockFilePath, JSON.stringify({ fromBlock }));
  }
}

async function readBlockData(blockFilePath) {
  return JSON.parse(await fs.readFile(blockFilePath, 'utf8'));
}

async function writeBlockData(blockFilePath, blockData) {
  await fs.writeFile(blockFilePath, JSON.stringify(blockData, null, 2));
}

module.exports = { ensureBlockFile, readBlockData, writeBlockData };