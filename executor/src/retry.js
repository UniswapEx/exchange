const retry = require('async-retry');
const logger = require('./logger.js');

module.exports = function retryAsync(_async, retries = 10) {
  return retry(
      async () => _async,
      {
        retries: retries,
        onRetry: (err) => {
          logger.warn(`${new Date().getTime()} - Received error ${err.toString().split('\n')[0]}`);
        },
      }
  );
};
