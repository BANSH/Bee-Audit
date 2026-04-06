#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Check if TS runs in dev mode (ts-node) or prod mode (dist)
const distPath = path.join(__dirname, '../dist/cli/index.js');

if (fs.existsSync(distPath)) {
  require(distPath);
} else {
  // Fallback for development if not built
  require('ts-node').register();
  require(path.join(__dirname, '../src/cli/index.ts'));
}
