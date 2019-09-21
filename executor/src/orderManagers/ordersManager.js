module.exports = class OrdersManager {
    constructor() {
        this.orders = [];
        this.filledOrders = {};
    }

    async newOrder(order) {
        this.orders.push(order);
    }

    async getPendingOrders() {
        return this.orders.filter(o => this.filledOrders[o] === undefined);
    }

    async isPending(order) {
        return this.filledOrders[order] === undefined;
    }

    async setFilled(order, tx) {
        this.filledOrders[order] = tx;
    }
}
