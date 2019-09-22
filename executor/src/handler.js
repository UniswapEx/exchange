const uniswapExAbi = require('./interfaces/uniswapEx.js');
const eutils = require('ethereumjs-util');
const logger = require('./logger.js');
const env = require('../env.js');

module.exports = class Handler {
  constructor(w3) {
    this.w3 = w3;
    this.uniswap_ex = new w3.eth.Contract(uniswapExAbi, env.uniswapEx);
    this.orders = [];
  }

  async exists(order) {
    const exists = await this.uniswap_ex.methods.existOrder(
        order.fromToken,
        order.toToken,
        order.minReturn,
        order.fee,
        order.owner,
        order.witness
    ).call();
    logger.debug(`Handler: Order ${order.tx} does${exists ? '' : ' not'} exists`);
    return exists;
  }

  async isReady(order) {
    const ready = await this.uniswap_ex.methods.canExecuteOrder(
        order.fromToken,
        order.toToken,
        order.minReturn,
        order.fee,
        order.owner,
        order.witness
    ).call();
    logger.debug(`Handler: Order ${order.tx} is${ready ? '' : ' not'} ready`);
    return ready;
  }

  async decode(txData, hash) {
    logger.debug(`Handler: Decodeding ${hash}, raw: ${txData}`);
    const data = txData > 448 ? `0x${txData.substr(-448)}` : txData;
    const decoded = await this.uniswap_ex.methods.decodeOrder(`${data}`).call();
    decoded.tx = hash;
    logger.debug(`Handler: Decoded ${hash} fromToken ${decoded.fromToken}`);
    logger.debug(`Handler: Decoded ${hash} toToken   ${decoded.toToken}`);
    logger.debug(`Handler: Decoded ${hash} minReturn ${decoded.minReturn}`);
    logger.debug(`Handler: Decoded ${hash} fee       ${decoded.fee}`);
    logger.debug(`Handler: Decoded ${hash} owner     ${decoded.owner}`);
    logger.debug(`Handler: Decoded ${hash} secret    ${decoded.secret}`);
    logger.debug(`Handler: Decoded ${hash} witness   ${decoded.witness}`);
    return decoded;
  }

  sign(address, priv) {
    const hash = this.w3.utils.soliditySha3(
        {t: 'address', v: address}
    );
    const sig = eutils.ecsign(
        eutils.toBuffer(hash),
        eutils.toBuffer(priv)
    );

    return eutils.bufferToHex(Buffer.concat([sig.r, sig.s, eutils.toBuffer(sig.v)]));
  }

  async fillOrder(order, account) {
    const gasPrice = await this.w3.eth.getGasPrice();

    logger.debug(`Handler: Loaded gas price for ${order.tx} -> ${gasPrice}`);

    const witnesses = this.sign(account.address, order.secret);

    logger.debug(`Handler: Witnesses for ${order.tx} -> ${witnesses}`);

    const estimatedGas = parseInt(await this.uniswap_ex.methods.executeOrder(
        order.fromToken,
        order.toToken,
        order.minReturn,
        order.fee,
        order.owner,
        witnesses
    ).estimateGas(
        {from: account.address}
    ));

    logger.debug(`Handler: Estimated gas for ${order.tx} -> ${estimatedGas}`);

    if (gasPrice * estimatedGas > order.fee) {
      // Fee is too low
      logger.verbose(`Handler: Skip, fee is not enought ${order.tx} cost: ${gasPrice * estimatedGas}`);
      return undefined;
    }

    try {
      const tx = await this.uniswap_ex.methods.executeOrder(
          order.fromToken,
          order.toToken,
          order.minReturn,
          order.fee,
          order.owner,
          witnesses
      ).send(
          {from: account.address, gas: estimatedGas, gasPrice: gasPrice}
      );

      logger.info(`Handler: Filled ${order.tx} order, txHash: ${tx.transactionHash}`);
      return tx.transactionHash;
    } catch (e) {
      logger.warn(`Handler: Error filling order ${order.tx}: ${e.message}`);
      return undefined;
    }
  }
};
