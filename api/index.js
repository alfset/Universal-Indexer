const express = require('express');
const { startServer } = require('../src/server');
const { startIndexer } = require('../src/indexer');

const app = express();
startServer(app);

app.get('/start-indexer', async (req, res) => {
  try {
    await startIndexer();
    res.status(200).json({ message: 'Indexer started successfully' });
  } catch (error) {
    console.error({ event: 'indexer_failed', error: error.message });
    res.status(500).json({ error: 'Failed to start indexer', details: error.message });
  }
});

// Export the Express app for Vercel
module.exports = app;