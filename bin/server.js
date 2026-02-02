#!/usr/bin/env node

// CLI wrapper for the context reporter server
const { startServer } = require('../dist/server.js');

const port = parseInt(process.env.PORT || '9847', 10);
startServer(port);
