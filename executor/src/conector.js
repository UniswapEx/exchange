const factory_abi = require('./uniswapFactory.js');
const ierc20_abi = require('./ierc20.js');

const env = require('../env.js');


module.exports = class Conector {
    constructor(w3) {
        this.w3 = w3;
        this.uni_factory = w3.eth.Contract(factory_abi, env.uniswapFactory);
        this.last_monitored = 8414292;
    }

    async isValidOrder(order) {
        // TODO: Check if order is valid
        return true;
    }

    async start(callback) {
        const total = await this.uni_factory.methods.tokenCount().call();
        const lastBlock = await this.w3.eth.lastBlock;
        for (var i = 1; i < total; i++) {
            const token_addr = await this.uni_factory.methods.getTokenWithId(i).call();
            console.log(`Monitoring token ${token_addr}`);
            const token = this.w3.eth.Contract(ierc20_abi, token_addr);
            const events = await token.getPastEvents('Transfer', {
                fromBlock: this.last_monitored,
                toBlock: lastBlock
            });
            for (let i in events) {
                const event = events[i];

                const tx = event.transactionHash;
                const full_tx = await this.w3.eth.getTransaction(tx)
                const tx_data = full_tx.input;

                if (tx_data.startsWith("0xa9059cbb") && tx_data.length == 650) {
                    callback(tx_data);
                }
            }
        }

        setTimeout(() => this.start(callback), 5000);
    }
}
