const Web3 = require('web3');

const Monitor = require('./monitor.js');
const Conector = require('./conector.js');
const Handler = require('./handler.js');
const read = require('read');
const util = require('util');

async function main() {
  const web3 = new Web3(process.env.NODE);
  const conector = new Conector(web3);
  const monitor = new Monitor(web3);
  const handler = new Handler(web3);

  let pk;

  if (process.env.PK != undefined) {
    pk = process.env.PK;
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

  console.log(`Using account ${account.address}`);

  let rawOrders = [];
  const decodedOrders = {};
  const filledOrders = [];

  monitor.onBlock(async (newBlock) => {
    const newOrders = await conector.getOrders(newBlock);
    rawOrders = rawOrders.concat(newOrders.filter((o) => rawOrders.indexOf(o) < 0));

    // Decode orders
    for (const i in rawOrders) {
      const rawOrder = rawOrders[i];
      if (decodedOrders[rawOrder] == undefined) {
        decodedOrders[rawOrder] = await handler.decode(rawOrder);
      }
    };

    const openOrders = [];

    // Filter open orders
    for (const i in rawOrders) {
      const rawOrder = rawOrders[i];
      if (await handler.exists(decodedOrders[rawOrder])) {
        openOrders.push(decodedOrders[rawOrder]);
      }
    };

    // Find filleable orders
    for (const i in openOrders) {
      const order = openOrders[i];

      if (filledOrders.indexOf(order) == -1 && await handler.isReady(order)) {
        const result = await handler.fillOrder(order, account);
        if (result != undefined) {
          filledOrders.push(order);
        }
      } else {
        console.log('not ready');
      }
    };
  });
}

main();
