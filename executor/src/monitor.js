const retry = require('./retry.js');

module.exports = class Monitor {
  constructor(w3) {
    this.w3 = w3;
  }

  async onBlock(callback) {
    let lastBlock = 0;
    const w3 = this.w3;
    async function loop() {
      const newBlock = await retry(w3.eth.getBlockNumber());
      if (newBlock > lastBlock) {
        await retry(callback(newBlock));
        lastBlock = newBlock;
      }
      setTimeout(loop, 2000);
    }
    loop();
  }
};
