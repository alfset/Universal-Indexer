require('dotenv').config();
const { startServer } = require('./src/server');
const { startIndexer } = require('./src/indexer');

startServer();
startIndexer().catch(error => {
  console.error({ event: 'indexer_failed', error: error.message });
  process.exit(1);
});
