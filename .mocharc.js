'use strict';

module.exports = {
  spec: 'test/api/**/*.test.js',
  file: ['./test/api/base/api-base.js'],
  timeout: 10000,
  require: ['dotenv/config']
};
