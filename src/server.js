const express = require('express');
const cors = require('cors');
const apiRoutes = require('../route/route');

function startServer() {
  const app = express();
  const port = process.env.PORT || 3000;

  app.use(cors({ origin: '*', methods: ['GET', 'POST'], allowedHeaders: ['Content-Type', 'Authorization'] }));
  app.use(express.json());
  app.use('/api', apiRoutes);

  app.listen(port, () => {
    console.log({ event: 'server_start', port });
  });
}

module.exports = { startServer };