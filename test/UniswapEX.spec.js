import assertRevert from './helpers/assertRevert'
import { balanceSnap, etherSnap } from './helpers/balanceSnap'

const eutils = require('ethereumjs-util')

const BN = web3.utils.BN
const expect = require('chai').use(require('bn-chai')(BN)).expect

const UniswapEx = artifacts.require('UniswapEX')
const ERC20 = artifacts.require('FakeERC20')
const FakeUniswapFactory = artifacts.require('FakeUniswapFactory')
const UniswapFactory = artifacts.require('UniswapFactory')
const UniswapExchange = artifacts.require('UniswapExchange')
const VaultFactory = artifacts.require('VaultFactory')

function buildCreate2Address(creatorAddress, saltHex, byteCode) {
  return `0x${web3.utils
    .soliditySha3(
      { t: 'bytes1', v: '0xff' },
      { t: 'address', v: creatorAddress },
      { t: 'bytes32', v: saltHex },
      {
        t: 'bytes32',
        v: web3.utils.soliditySha3({ t: 'bytes', v: byteCode })
      }
    )
    .slice(-40)}`.toLowerCase()
}

function toAddress(pk) {
  return eutils.toChecksumAddress(eutils.bufferToHex(eutils.privateToAddress(eutils.toBuffer(pk))))
}

function sign(address, priv) {
  const hash = web3.utils.soliditySha3(
    { t: 'address', v: address }
  )
  const sig = eutils.ecsign(
    eutils.toBuffer(hash),
    eutils.toBuffer(priv)
  )

  return eutils.bufferToHex(Buffer.concat([sig.r, sig.s, eutils.toBuffer(sig.v)]))
}

contract('UniswapEx', function ([_, owner, user, anotherUser, hacker]) {
  // globals
  const zeroAddress = '0x0000000000000000000000000000000000000000'
  const ethAddress = '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee'
  const maxBn = new BN(2).pow(new BN(256)).sub(new BN(1))
  const fromOwner = { from: owner }
  const fromUser = { from: user }
  const fromAnotherUser = { from: anotherUser }
  const fromHacker = { from: hacker }

  const never = maxBn

  const creationParams = {
    ...fromOwner,
    gas: 6e6,
    gasPrice: 21e9
  }

  const fakeKey = web3.utils.sha3('0x01')
  const anotherFakeKey = web3.utils.sha3('0x02')
  const ONE_ETH = new BN(1)
  const FIXED_SALT =
    '0xf9fea21bcccd3d13caa0d7f67bc4bd0776a06c420e932ee5add8f3affb3f354b'
  const CRATIONCODE_VAULT =
    '6012600081600A8239F360008060448082803781806038355AF132FF'

  // Contracts
  let token1
  let token2
  let vaultFactory
  let uniswapEx
  let uniswapFactory
  let uniswapToken1
  let uniswapToken2

  beforeEach(async function () {
    // Create tokens
    token1 = await ERC20.new(creationParams)
    token2 = await ERC20.new(creationParams)
    // Deploy Uniswap
    uniswapFactory = await UniswapFactory.at(
      (await FakeUniswapFactory.new()).address
    )
    await uniswapFactory.createExchange(token1.address)
    await uniswapFactory.createExchange(token2.address)
    uniswapToken1 = await UniswapExchange.at(
      await uniswapFactory.getExchange(token1.address)
    )
    uniswapToken2 = await UniswapExchange.at(
      await uniswapFactory.getExchange(token2.address)
    )
    // Deploy exchange
    uniswapEx = await UniswapEx.new(uniswapFactory.address, { from: owner })

    // Deploy vault
    vaultFactory = await VaultFactory.new(creationParams)

    // Add liquidity to Uniswap exchange 1
    await token1.setBalance(new BN(1000000000), owner)
    await token1.approve(uniswapToken1.address, maxBn, { from: owner })
    await uniswapToken1.addLiquidity(0, new BN(1000000000), never, {
      from: owner,
      value: new BN(5000000000)
    })

    // Add liquidity to Uniswap exchange 2
    await token2.setBalance(new BN(1000000000), owner)
    await token2.approve(uniswapToken2.address, maxBn, { from: owner })
    await uniswapToken2.addLiquidity(0, new BN(1000000000), never, {
      from: owner,
      value: new BN(5000000000)
    })
  })

  describe('Constructor', function () {
    it('should be depoyed', async function () {
      const contract = await UniswapEx.new(uniswapFactory.address)

      expect(contract).to.not.be.equal(zeroAddress)
    })
  })
  describe('It should trade on Uniswap', async function () {
    it('should execute buy tokens with ETH', async () => {
      const secret = web3.utils.randomHex(32)
      const witness = toAddress(secret);

      // Create order
      const encodedOrder = await uniswapEx.encodeEthOrder(
        ethAddress,        // ETH Address
        token1.address,    // Buy TOKEN 1
        new BN(300),       // Get at least 300 Tokens
        new BN(10),        // Pay 10 WEI to sender
        user,              // Owner of the order
        secret,            // Witness secret
        witness            // Witness public address
      )

      await uniswapEx.depositEth(
        encodedOrder,
        {
          value: new BN(10000),
          from: user
        }
      )

      // Take balance snapshots
      const exEtherSnap = await etherSnap(uniswapEx.address, 'Uniswap EX')
      const executerEtherSnap = await etherSnap(anotherUser, 'executer')
      const uniswapEtherSnap = await etherSnap(uniswapToken1.address, 'uniswap')
      const userTokenSnap = await balanceSnap(token1, user, 'user')
      const uniswapTokenSnap = await balanceSnap(
        token1,
        uniswapToken1.address,
        'uniswap'
      )

      // Sign witnesses using the secret
      const witnesses = sign(anotherUser, secret)

      // Execute order
      const tx = await uniswapEx.executeOrder(
        ethAddress,     // Sell ETH
        token1.address, // Buy TOKEN 1
        new BN(300),    // Get at least 300 Tokens
        new BN(10),     // Pay 10 WEI to sender
        user,           // Owner of the order
        witnesses,      // Witnesses of the secret
        {
          from: anotherUser,
          gasPrice: 0
        }
      )

      const bought = tx.logs[0].args._bought

      // Validate balances
      await exEtherSnap.requireDecrease(new BN(10000))
      await executerEtherSnap.requireIncrease(new BN(10))
      await uniswapEtherSnap.requireIncrease(new BN(9990))
      await userTokenSnap.requireIncrease(bought)
      await uniswapTokenSnap.requireDecrease(bought)
    })
    it('should execute sell tokens for ETH', async () => {
      const secret = web3.utils.randomHex(32)
      const witness = toAddress(secret);

      // Encode order transfer
      const orderTx = await uniswapEx.encodeTokenOrder(
        token1.address, // Sell token 1
        ethAddress,     // Buy ETH
        new BN(10000),  // Tokens to sell
        new BN(50),     // Get at least 50 ETH Wei
        new BN(15),     // Pay 15 WEI to sender
        user,           // Owner of the order
        secret,         // Witness secret
        witness         // Witness address
      )

      const vaultAddress = await uniswapEx.vaultOfOrder(
        token1.address, // Sell token 1
        ethAddress,     // Buy ETH
        new BN(50),     // Get at least 50 ETH Wei
        new BN(15),     // Pay 15 WEI to sender
        user,           // Owner of the order
        witness         // Witness address
      )

      const vaultSnap = await balanceSnap(token1, vaultAddress, 'token vault')

      await token1.setBalance(new BN(10000), user)

      // Send tokens tx
      await web3.eth.sendTransaction({
        from: user,
        to: token1.address,
        data: orderTx,
        gasPrice: 0
      })

      await vaultSnap.requireIncrease(new BN(10000))

      // Take balance snapshots
      const exTokenSnap = await balanceSnap(
        token1,
        uniswapEx.address,
        'Uniswap EX'
      )
      const exEtherSnap = await balanceSnap(
        token1,
        uniswapEx.address,
        'Uniswap EX'
      )
      const executerEtherSnap = await etherSnap(anotherUser, 'executer')
      const uniswapTokenSnap = await balanceSnap(
        token1,
        uniswapToken1.address,
        'uniswap'
      )
      const uniswapEtherSnap = await etherSnap(uniswapToken1.address, 'uniswap')
      const userTokenSnap = await etherSnap(user, 'user')

      // Sign witnesses using the secret
      const witnesses = sign(anotherUser, secret)

      // Execute order
      const tx = await uniswapEx.executeOrder(
        token1.address, // Sell token 1
        ethAddress,     // Buy ETH
        new BN(50),     // Get at least 50 ETH Wei
        new BN(15),     // Pay 15 WEI to sender
        user,           // Owner of the order
        witnesses,      // Witnesses, sender signed using the secret
        {
          from: anotherUser,
          gasPrice: 0
        }
      )

      const bought = tx.logs[0].args._bought

      // Validate balances
      await exEtherSnap.requireConstant()
      await exTokenSnap.requireConstant()
      await executerEtherSnap.requireIncrease(new BN(15))
      await uniswapTokenSnap.requireIncrease(new BN(10000))
      await uniswapEtherSnap.requireDecrease(bought.add(new BN(15)))
      await userTokenSnap.requireIncrease(bought)
    })
    it('Should exchange tokens for tokens', async function () {
      const secret = web3.utils.randomHex(32)
      const witness = toAddress(secret);

      // Encode order transfer
      const orderTx = await uniswapEx.encodeTokenOrder(
        token1.address, // Sell token 1
        token2.address, // Buy TOKEN 2
        new BN(1000),   // Tokens to sell
        new BN(50),     // Get at least 50 ETH Wei
        new BN(9),      // Pay WEI to sender
        user,           // Owner of the order
        secret,         // Witness secret
        witness         // Witness address
      )

      const vaultAddress = await uniswapEx.vaultOfOrder(
        token1.address, // Sell token 1
        token2.address, // Buy ETH
        new BN(50),     // Get at least 50 ETH Wei
        new BN(9),      // Pay WEI to sender
        user,           // Owner of the order
        witness         // Wirness address
      )

      const vaultSnap = await balanceSnap(token1, vaultAddress, 'token vault')

      await token1.setBalance(new BN(1000), user)

      // Send tokens tx
      await web3.eth.sendTransaction({
        from: user,
        to: token1.address,
        data: orderTx,
        gasPrice: 0
      })

      await vaultSnap.requireIncrease(new BN(1000))

      // Take balance snapshots
      const exToken1Snap = await balanceSnap(
        token1,
        uniswapEx.address,
        'Uniswap EX'
      )
      const exToken2Snap = await balanceSnap(
        token1,
        uniswapEx.address,
        'Uniswap EX'
      )
      const exEtherSnap = await balanceSnap(
        token1,
        uniswapEx.address,
        'Uniswap EX'
      )
      const executerEtherSnap = await etherSnap(anotherUser, 'executer')
      const uniswap1TokenSnap = await balanceSnap(
        token1,
        uniswapToken1.address,
        'uniswap'
      )
      const uniswap2TokenSnap = await balanceSnap(
        token2,
        uniswapToken2.address,
        'uniswap'
      )
      const userToken2Snap = await balanceSnap(token2, user, 'user')

      const witnesses = sign(anotherUser, secret)

      // Execute order
      const tx = await uniswapEx.executeOrder(
        token1.address, // Sell token 1
        token2.address, // Buy ETH
        new BN(50),     // Get at least 50 ETH Wei
        new BN(9),      // Pay 9 WEI to sender
        user,           // Owner of the order
        witnesses,      // Signature of the sender using the secret
        {
          from: anotherUser,
          gasPrice: 0
        }
      )

      const bought = tx.logs[0].args._bought

      // Validate balances
      await exEtherSnap.requireConstant()
      await exToken1Snap.requireConstant()
      await exToken2Snap.requireConstant()
      await vaultSnap.requireConstant()
      await executerEtherSnap.requireIncrease(new BN(9))
      await uniswap1TokenSnap.requireIncrease(new BN(1000))
      await uniswap2TokenSnap.requireDecrease(bought)
      await userToken2Snap.requireIncrease(bought)
    })
  })
  describe('It should work with easter ehh', async function () {
    it('should execute a trade', async function () {
      const randsecret = web3.utils.randomHex(13).replace('0x', '');
      const secret = `0x20756e697377617065782e696f2020d83ddc09${randsecret}`
      const witness = toAddress(secret)

      // Create order
      const encodedOrder = await uniswapEx.encodeEthOrder(
        ethAddress,        // ETH Address
        token1.address,    // Buy TOKEN 1
        new BN(300),       // Get at least 300 Tokens
        new BN(10),        // Pay 10 WEI to sender
        user,              // Owner of the order
        secret,            // Witness secret
        witness            // Witness public address
      )

      await uniswapEx.depositEth(
        encodedOrder,
        {
          value: new BN(10000),
          from: user
        }
      )

      // Take balance snapshots
      const exEtherSnap = await etherSnap(uniswapEx.address, 'Uniswap EX')
      const executerEtherSnap = await etherSnap(anotherUser, 'executer')
      const uniswapEtherSnap = await etherSnap(uniswapToken1.address, 'uniswap')
      const userTokenSnap = await balanceSnap(token1, user, 'user')
      const uniswapTokenSnap = await balanceSnap(
        token1,
        uniswapToken1.address,
        'uniswap'
      )

      // Sign witnesses using the secret
      const witnesses = sign(anotherUser, secret)

      // Execute order
      const tx = await uniswapEx.executeOrder(
        ethAddress,     // Sell ETH
        token1.address, // Buy TOKEN 1
        new BN(300),    // Get at least 300 Tokens
        new BN(10),     // Pay 10 WEI to sender
        user,           // Owner of the order
        witnesses,      // Witnesses of the secret
        {
          from: anotherUser,
          gasPrice: 0
        }
      )

      const bought = tx.logs[0].args._bought

      // Validate balances
      await exEtherSnap.requireDecrease(new BN(10000))
      await executerEtherSnap.requireIncrease(new BN(10))
      await uniswapEtherSnap.requireIncrease(new BN(9990))
      await userTokenSnap.requireIncrease(bought)
      await uniswapTokenSnap.requireDecrease(bought)
    });
  })
  describe('Get vault', function () {
    it('should return correct vault', async function () {
      const address = (await vaultFactory.getVault(fakeKey)).toLowerCase()
      const expectedAddress = buildCreate2Address(
        vaultFactory.address,
        fakeKey,
        CRATIONCODE_VAULT
      )
      expect(address).to.not.be.equal(zeroAddress)
      expect(address).to.be.equal(expectedAddress)
    })
    it('should return same vault for the same key', async function () {
      const address = await vaultFactory.getVault(fakeKey)
      const expectedAddress = await vaultFactory.getVault(fakeKey)
      expect(address).to.be.equal(expectedAddress)
    })
    it('should return a different vault for a different key', async function () {
      const address = await vaultFactory.getVault(fakeKey)
      const expectedAddress = await vaultFactory.getVault(anotherFakeKey)
      expect(address).to.not.be.equal(zeroAddress)
      expect(expectedAddress).to.not.be.equal(zeroAddress)
      expect(address).to.not.be.equal(expectedAddress)
    })
  })
  describe('Create vault', function () {
    it('should return correct vault', async function () {
      const address = await vaultFactory.getVault(fakeKey)
      await token1.setBalance(ONE_ETH, address)
      await vaultFactory.executeVault(fakeKey, token1.address, user)
    })
    it('not revert if vault has no balance', async function () {
      await vaultFactory.executeVault(fakeKey, token1.address, user)
    })
  })
})
