const uniswapExAbi = require('./interfaces/uniswapEx.js');
const eutils = require('ethereumjs-util');
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
    const data = txData > 448 ? `0x${txData.substr(-448)}` : txData;
    const decoded = await this.uniswap_ex.methods.decodeOrder(data).call();
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
      console.log('Skip filling order, fee is not enought');
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
      console.log('Filled order, txHash: ' + tx.transactionHash);
      return tx.transactionHash;
    } catch (e) {
      console.log('Error message: ' + e.message);
      return undefined;
    }
  }
};
