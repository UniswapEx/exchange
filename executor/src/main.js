const Web3 = require('web3');

const OrdersManager = require('./orderManagers/ordersManager.js');
const Monitor = require('./monitor.js');
const Conector = require('./conector.js');
const Handler = require('./handler.js');
const read = require('read');
const util = require('util');
const retry = require('./retry.js');
const logger = require('./logger.js');


async function main() {
  const argv = require('yargs')
      .env('UNISWAPEX_')
      .option('n', {
        alias: 'node',
        required: true,
        describe: 'Ethereum node',
        type: 'string',
      })
      .option('pk', {
        alias: 'private-key',
        required: false,
        describe: 'Private key of the relayer',
        type: 'string',
      })
      .argv;

  const web3 = new Web3(argv.node);
  const conector = new Conector(web3);
  const monitor = new Monitor(web3);
  const handler = new Handler(web3);

  let pk;

  if (argv.pk) {
    pk = argv.pk;
  } else {
    pk = await util.promisify(read)({
      prompt: 'Private key: ',
      silent: true,
      replace: '*',
    });
  }

  pk = pk.startsWith('0x') ? pk : `0x${pk}`;

  const account = web3.eth.accounts.privateKeyToAccount(pk);
  web3.eth.accounts.wallet.add(account);

  logger.info(`Using account ${account.address}`);

  const manager = new OrdersManager();

  // Monitor new orders
  monitor.onBlock(async (newBlock) => {
    logger.verbose(`Looking for new orders until block ${newBlock}`);
    await conector.getOrders(newBlock, async (rawOrder) => {
      logger.debug(`Processing raw order ${rawOrder}`);
      const decoded = await retry(handler.decode(rawOrder));
      logger.debug(`Processed order ${decoded.owner} ${decoded.fromToken} -> ${decoded.toToken}`);
      await manager.newOrder(decoded);
    });
  });

  monitor.onBlock(async (newBlock) => {
    logger.verbose(`Handling pending orders for block ${newBlock}`);
    const allOrders = await manager.getPendingOrders();
    for (const i in allOrders) {
      const order = allOrders[i];
      const exists = await retry(handler.exists(order));
      logger.verbose(`Loaded order by ${order.owner}: ${order.fromToken} -> ${order.toToken}`);

      if (exists) {
        // Check if order is ready to be filled and it's still pending
        if (await retry(handler.isReady(order)) && await manager.isPending(order)) {
          // Fill order, retry only 4 times
          const result = await retry(handler.fillOrder(order, account), 4);
          if (result != undefined) {
            manager.setFilled(order, result);
          }
        } else {
          logger.verbose(`Order not ready to be filled, ${order.owner}: ${order.fromToken} -> ${order.toToken}`);
        }
      } else {
        logger.verbose('Order no long exists, removing it from pool');
        // Set order as filled
        await manager.setFilled(order, 'unknown');
      }
    }
  });
}

main();
