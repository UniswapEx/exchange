const factoryAbi = require('./interfaces/uniswapFactory.js');
const uniswapexAbi = require('./interfaces/uniswapEx.js');
const ierc20Abi = require('./interfaces/ierc20.js');

const env = require('../env.js');

const MAX_JUMP = 10000000;
module.exports = class Conector {
  constructor(w3) {
    this.w3 = w3;
    this.uni_factory = new w3.eth.Contract(factoryAbi, env.uniswapFactory);
    this.uniswap_ex = new w3.eth.Contract(uniswapexAbi, env.uniswapEx);
    this.last_monitored = 8579313;
    this.uniswap_token_cache = {};
  }

  async isValidOrder(order) {
    // TODO: Check if order is valid
    return true;
  }

  async getUniswapAddress(i) {
    if (this.uniswap_token_cache[i] != undefined) {
      return this.uniswap_token_cache[i];
    }

    const tokenAddr = await this.uni_factory.methods.getTokenWithId(i).call();
    this.uniswap_token_cache[i] = tokenAddr;
    return tokenAddr;
  }

  async getOrders(toBlock) {
    toBlock = Math.min(toBlock, this.last_monitored + MAX_JUMP);

    const total = await this.uni_factory.methods.tokenCount().call();

    const orders = [];
    let tokensChecked = 0;

    // Load ETH orders
    const events = await this.uniswap_ex.getPastEvents('DepositETH', {
      fromBlock: this.last_monitored,
      toBlock: toBlock,
    });


    for (const i in events) {
      const event = events[i];
      console.log('Found ETH Order');
      orders.push(event.returnValues._data);
    }

    // Load events of all Uniswap tokens
    for (let i = 1; i < total; i++) {
      const tokenAddr = await this.getUniswapAddress(i);
      tokensChecked++;

      // Skip USDT
      if (tokenAddr.toLowerCase() == '0xdac17f958d2ee523a2206206994597c13d831ec7') {
        continue;
      }

      console.log(`${tokensChecked}/${total} - Monitoring token ${tokenAddr}`);
      const token = new this.w3.eth.Contract(ierc20Abi, tokenAddr);
      const events = await token.getPastEvents('Transfer', {
        fromBlock: this.last_monitored,
        toBlock: toBlock,
      });

      const checked = [];
      let checkedCount = 0;

      for (const i in events) {
        const event = events[i];

        const tx = event.transactionHash;
        checkedCount += 1;

        if (checked.includes(tx)) {
          continue;
        }

        const fullTx = await this.w3.eth.getTransaction(tx);
        const txData = fullTx.input;

        console.log(`${checkedCount}/${events.length} - Check TX ${tx}`);
        if (txData.startsWith('0xa9059cbb') && txData.length == 714) {
          orders.push(txData);
          console.log(`Found order TX ${tx}`);
        }

        checked.push(tx);
      }
    }

    this.last_monitored = toBlock;
    return orders;
  }
};
