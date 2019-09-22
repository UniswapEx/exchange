const factoryAbi = require('./interfaces/uniswapFactory.js');
const uniswapexAbi = require('./interfaces/uniswapEx.js');
const ierc20Abi = require('./interfaces/ierc20.js');
const logger = require('./logger.js');
const retry = require('./retry.js');
const env = require('../env.js');

module.exports = class Conector {
  constructor(w3) {
    this.w3 = w3;
    this.uni_factory = new w3.eth.Contract(factoryAbi, env.uniswapFactory);
    this.uniswap_ex = new w3.eth.Contract(uniswapexAbi, env.uniswapEx);
    this.last_monitored = 8579313;
    this.uniswap_token_cache = {};
  }

  async getSafePastEvents(contract, name, fromBlock, toBlock) {
    try {
      return await contract.getPastEvents(name, {
        fromBlock: fromBlock,
        toBlock: toBlock,
      });
    } catch (e) {
      if (fromBlock != toBlock && e.toString().includes('more than 10000 results')) {
        const pivot = Math.floor(fromBlock + (toBlock - fromBlock) / 2);
        logger.debug(`Connector: ${contract._address} - Split event query in two ${fromBlock}-${toBlock} -> ${pivot}`);

        const a = await this.getSafePastEvents(
            contract,
            name,
            fromBlock,
            pivot
        );

        const b = await this.getSafePastEvents(
            contract,
            name,
            pivot,
            toBlock
        );

        const result = a.concat(b);

        return result;
      } else {
        throw e;
      }
    }
  }

  async getUniswapAddress(i) {
    if (this.uniswap_token_cache[i] != undefined) {
      return this.uniswap_token_cache[i];
    }

    const tokenAddr = await retry(this.uni_factory.methods.getTokenWithId(i).call());
    this.uniswap_token_cache[i] = tokenAddr;
    return tokenAddr;
  }

  async getOrders(toBlock, onRawOrder) {
    if (toBlock <= this.last_monitored) {
      logger.debug(`Connector: skip getOrders, ${this.last_monitored}-${toBlock}`);
      return;
    }

    logger.debug(`Connector: getOrders, ${this.last_monitored}-${toBlock}`);

    const total = await retry(this.uni_factory.methods.tokenCount().call());

    let tokensChecked = 0;

    // Load ETH orders
    const events = await retry(this.getSafePastEvents(
        this.uniswap_ex,
        'DepositETH',
        this.last_monitored,
        toBlock
    ));

    logger.debug(`Connector: Found ${events.length} ETH orders events`);

    for (const i in events) {
      const event = events[i];
      logger.info(`Connector: Found ETH Order ${event.transactionHash}`);
      await onRawOrder(event.returnValues._data, event.transactionHash);
    }

    // Load events of all Uniswap tokens
    for (let i = 1; i < total; i++) {
      const tokenAddr = await this.getUniswapAddress(i);
      tokensChecked++;

      // Skip USDT
      if (tokenAddr.toLowerCase() == '0xdac17f958d2ee523a2206206994597c13d831ec7') {
        logger.debug(`Connector: Skip token USDT`);
        continue;
      }

      logger.debug(`Connector: ${tokensChecked}/${total} - Monitoring token ${tokenAddr}`);
      const token = new this.w3.eth.Contract(ierc20Abi, tokenAddr);
      const events = await retry(this.getSafePastEvents(
          token,
          'Transfer',
          this.last_monitored,
          toBlock
      ));

      logger.debug(`Connector: Found ${events.length} token transfer events for ${tokenAddr}`);

      const checked = [];
      let checkedCount = 0;

      for (const i in events) {
        const event = events[i];

        const tx = event.transactionHash;
        checkedCount += 1;

        if (checked.includes(tx)) {
          continue;
        }

        const fullTx = await retry(this.w3.eth.getTransaction(tx));
        const txData = fullTx.input;

        logger.debug(`Connector: ${checkedCount}/${events.length} - Check TX ${tx}`);
        if (txData.startsWith('0xa9059cbb') && txData.length == 714) {
          logger.info(`Connector: Found token order ${token._address} ${tx}`);
          await onRawOrder(txData, tx);
        }

        checked.push(tx);
      }
    }

    logger.info(`Connector: Finished getOrders for range ${this.last_monitored}-${toBlock}`);
    this.last_monitored = toBlock;
  }
};
