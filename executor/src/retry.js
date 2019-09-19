const retry = require('async-retry');

module.exports = function retryAsync(_async, retries = 10) {
  return retry(
      async () => _async,
      {
        retries: retries,
        onRetry: (err) => {
          console.log(`${new Date().getTime()} - Received error ${err.toString().split('\n')[0]}`);
        },
      }
  );
};
