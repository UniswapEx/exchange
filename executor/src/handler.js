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
    return await this.uniswap_ex.methods.existOrder(
        order.fromToken,
        order.toToken,
        order.minReturn,
        order.fee,
        order.owner,
        order.witness
    ).call();
  }

  async isReady(order) {
    // TODO: Check if order is valid
    return await this.uniswap_ex.methods.canExecuteOrder(
        order.fromToken,
        order.toToken,
        order.minReturn,
        order.fee,
        order.owner,
        order.witness
    ).call();
  }

  async decode(txData) {
    txData = txData.replace('0x', '');
    const data = txData > 448 ? `0x${txData.substr(-448)}` : txData;
    const decoded = await this.uniswap_ex.methods.decodeOrder(`0x${data}`).call();
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

    const witnesses = this.sign(account.address, order.secret);

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

    if (gasPrice * estimatedGas > order.fee) {
      // Fee is too low
      logger.verbose(`Skip, fee is not enought ${order.owner} -> fee: ${order.fee} cost: ${gasPrice * estimatedGas}`);
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
      logger.info('Filled order, txHash: ' + tx.transactionHash);
      return tx.transactionHash;
    } catch (e) {
      logger.warning(`Error filling order: ${e.message}`);
      return undefined;
    }
  }
};
