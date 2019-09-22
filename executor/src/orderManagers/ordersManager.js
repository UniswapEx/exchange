const logger = require('../logger.js');

module.exports = class OrdersManager {
  constructor() {
    this.orders = [];
    this.filledOrders = {};
  }

  async newOrder(order) {
    logger.debug(`Order manager: Pushed order to manager ${order.tx}`);
    this.orders.push(order);
  }

  async getPendingOrders() {
    const result = this.orders.filter((o) => this.filledOrders[o.tx] === undefined);
    logger.debug(`Order manager: Retrieving ${result.length} pending orders`);
    return result;
  }

  async isPending(order) {
    const result = this.filledOrders[order] === undefined;
    logger.debug(`Order manager: Order ${order.tx} is ${result ? '' : 'not'} pending`);
    return result;
  }

  async setFilled(order, executedTx) {
    logger.debug(`Order manager: Order ${order.tx} was filled by ${executedTx}`);
    this.filledOrders[order.tx] = executedTx;
  }
};
