#!/usr/bin/env node

const {main} = require('../src/cli');

main().then((code) => {
  process.exitCode = code;
});
