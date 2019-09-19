const uniswapExAbi = require('./interfaces/uniswapEx.js');
// const uniswap_ex_proxy_abi = require('./interfaces/uniswapExProxy.js');

const env = require('../env.js');

module.exports = class Handler {
  constructor(w3) {
    this.w3 = w3;
    this.uniswap_ex = new w3.eth.Contract(uniswapExAbi, env.uniswapEx);
    // this.uniswap_ex_proxy = new w3.eth.Contract(uniswap_ex_proxy_abi, env.uniswapExProxy);
    this.orders = [];
  }

  async exists(order) {
    return await this.uniswap_ex.methods.existOrder(
        order.fromToken,
        order.toToken,
        order.minReturn,
        order.fee,
        order.owner,
        order.salt
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
        order.salt
    ).call();
  }

  async decode(txData) {
    const data = txData > 384 ? `0x${txData.substr(-384)}` : txData;
    const decoded = await this.uniswap_ex.methods.decodeOrder(data).call();
    return decoded;
  }

  async fillOrder(order, account) {
    const gasPrice = await this.w3.eth.getGasPrice();

    // const checksum = await this.uniswap_ex_proxy.methods.getChecksum(
    //     order.owner,
    //     order.salt,
    //     account.address
    // ).call();

    const estimatedGas = parseInt(await this.uniswap_ex.methods.executeOrder(
        order.fromToken,
        order.toToken,
        order.minReturn,
        order.fee,
        order.owner,
        order.salt,
        account.address
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
          order.salt,
          account.address
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
