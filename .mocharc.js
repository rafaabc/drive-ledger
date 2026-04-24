'use strict';

module.exports = {
  spec: 'test/api/**/*.test.js',
  file: ['./test/api/hooks/auth.js'],
  timeout: 10000,
  require: ['dotenv/config']
};
