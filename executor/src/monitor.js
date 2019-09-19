module.exports = class Monitor {
  constructor(w3) {
    this.w3 = w3;
  }

  async onBlock(callback) {
    let lastBlock = 0;
    while (true) {
      const newBlock = await this.w3.eth.getBlockNumber();
      if (newBlock != lastBlock) {
        await callback(newBlock);
        lastBlock = newBlock;
      }
    }
  }
};
