const serverless = require('serverless-http');
const app = require('../src/server');
const { startIndexer } = require('../src/indexer');

startIndexer().catch(error => {
  console.error({ event: 'indexer_failed', error: error.message });
});

module.exports = serverless(app);
