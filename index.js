require('dotenv').config();
const express = require('express');
const cors = require('cors');
const apiRoutes = require('./route/route'); 
const { startIndexer } = require('./src/indexer');

const app = express();
const port = process.env.PORT || 3000;

app.use(cors({ origin: '*', methods: ['GET', 'POST'], allowedHeaders: ['Content-Type', 'Authorization'] }));
app.use(express.json());

app.use('/api', apiRoutes);

// Start Express server
app.listen(port, () => {
  console.log({ event: 'server_start', port });
});

// Start indexer
startIndexer().catch(error => {
  console.error({ event: 'indexer_failed', error: error.message });
  process.exit(1);
});
