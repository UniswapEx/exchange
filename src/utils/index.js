import { ethers } from 'ethers'
import { Contract } from '@ethersproject/contracts'
import { AddressZero } from '@ethersproject/constants'

import FACTORY_ABI from '../constants/abis/factory'
import EXCHANGE_ABI from '../constants/abis/exchange'
import ERC20_ABI from '../constants/abis/erc20'
import ERC20_BYTES32_ABI from '../constants/abis/erc20_bytes32'
import UNISWAPEX_ABI from '../constants/abis/uniswapEX'
import FACTORY_V2_ABI from '../constants/abis/factoryV2.json'
import PAIR_ABI from '../constants/abis/pair.json'
import { FACTORY_ADDRESSES, UNISWAPEX_ADDRESSES, UNISWAPV2_ADDRESSES } from '../constants'
import { formatFixed } from '@uniswap/sdk'

export const ERROR_CODES = ['TOKEN_NAME', 'TOKEN_SYMBOL', 'TOKEN_DECIMALS'].reduce(
  (accumulator, currentValue, currentIndex) => {
    accumulator[currentValue] = currentIndex
    return accumulator
  },
  {}
)

export function safeAccess(object, path) {
  return object
    ? path.reduce(
        (accumulator, currentValue) => (accumulator && accumulator[currentValue] ? accumulator[currentValue] : null),
        object
      )
    : null
}

const ETHERSCAN_PREFIXES = {
  1: '',
  3: 'ropsten.',
  4: 'rinkeby.',
  5: 'goerli.',
  42: 'kovan.'
}
export function getEtherscanLink(chainId, data, type) {
  const prefix = `https://${ETHERSCAN_PREFIXES[chainId] || ETHERSCAN_PREFIXES[1]}etherscan.io`

  switch (type) {
    case 'transaction': {
      return `${prefix}/tx/${data}`
    }
    case 'address':
    default: {
      return `${prefix}/address/${data}`
    }
  }
}

export function getNetworkName(chainId) {
  switch (chainId) {
    case 1: {
      return 'the Main Ethereum Network'
    }
    case 3: {
      return 'the Ropsten Test Network'
    }
    case 4: {
      return 'the Rinkeby Test Network'
    }
    case 5: {
      return 'the Görli Test Network'
    }
    case 42: {
      return 'the Kovan Test Network'
    }
    default: {
      return 'the correct network'
    }
  }
}

export function shortenAddress(address, digits = 4) {
  if (!isAddress(address)) {
    throw Error(`Invalid 'address' parameter '${address}'.`)
  }
  return `${address.substring(0, digits + 2)}...${address.substring(42 - digits)}`
}

export function shortenTransactionHash(hash, digits = 4) {
  return `${hash.substring(0, digits + 2)}...${hash.substring(66 - digits)}`
}

export function isAddress(value) {
  try {
    return ethers.utils.getAddress(value.toLowerCase())
  } catch {
    return false
  }
}

export function calculateGasMargin(value, margin) {
  const offset = value.mul(margin).div(ethers.utils.bigNumberify(10000))
  return value.add(offset)
}

// account is not optional
export function getSigner(library, account) {
  return library.getSigner(account).connectUnchecked()
}

// account is optional
export function getProviderOrSigner(library, account) {
  return account ? getSigner(library, account) : library
}

// account is optional
export function getContract(address, ABI, library, account) {
  if (!isAddress(address) || address === AddressZero) {
    throw Error(`Invalid 'address' parameter '${address}'.`)
  }

  return new Contract(address, ABI, getProviderOrSigner(library, account))
}

// account is optional
export function getUniswapExContract(chainId, library, account) {
  return getContract(UNISWAPEX_ADDRESSES[chainId], UNISWAPEX_ABI, library, account)
}

export function getUniswapV2Contracts(chainId, library, account) {
  return { factoryV2: getContract(UNISWAPV2_ADDRESSES[chainId].FACTORY, FACTORY_V2_ABI, library, account) }
}

export function getPairContract(address, library, account) {
  return getContract(address, PAIR_ABI, library, account)
}

// account is optional
export function getFactoryContract(chainId, library, account) {
  return getContract(FACTORY_ADDRESSES[chainId], FACTORY_ABI, library, account)
}

// account is optional
export function getExchangeContract(exchangeAddress, library, account) {
  return getContract(exchangeAddress, EXCHANGE_ABI, library, account)
}

// get token name
export async function getTokenName(tokenAddress, library) {
  if (!isAddress(tokenAddress)) {
    throw Error(`Invalid 'tokenAddress' parameter '${tokenAddress}'.`)
  }

  return getContract(tokenAddress, ERC20_ABI, library)
    .name()
    .catch(() =>
      getContract(tokenAddress, ERC20_BYTES32_ABI, library)
        .name()
        .then(bytes32 => ethers.utils.parseBytes32String(bytes32))
    )
    .catch(error => {
      error.code = ERROR_CODES.TOKEN_SYMBOL
      throw error
    })
}

// get token symbol
export async function getTokenSymbol(tokenAddress, library) {
  if (!isAddress(tokenAddress)) {
    throw Error(`Invalid 'tokenAddress' parameter '${tokenAddress}'.`)
  }

  return getContract(tokenAddress, ERC20_ABI, library)
    .symbol()
    .catch(() => {
      const contractBytes32 = getContract(tokenAddress, ERC20_BYTES32_ABI, library)
      return contractBytes32.symbol().then(bytes32 => ethers.utils.parseBytes32String(bytes32))
    })
    .catch(error => {
      error.code = ERROR_CODES.TOKEN_SYMBOL
      throw error
    })
}

// get token decimals
export async function getTokenDecimals(tokenAddress, library) {
  if (!isAddress(tokenAddress)) {
    throw Error(`Invalid 'tokenAddress' parameter '${tokenAddress}'.`)
  }

  return getContract(tokenAddress, ERC20_ABI, library)
    .decimals()
    .catch(error => {
      error.code = ERROR_CODES.TOKEN_DECIMALS
      throw error
    })
}

// get the exchange address for a token from the factory
export async function getTokenExchangeAddressFromFactory(tokenAddress, chainId, library) {
  return getFactoryContract(chainId, library).getExchange(tokenAddress)
}

// get the ether balance of an address
export async function getEtherBalance(address, library) {
  if (!isAddress(address)) {
    throw Error(`Invalid 'address' parameter '${address}'`)
  }
  return library.getBalance(address)
}

export function formatEthBalance(balance) {
  return amountFormatter(balance, 18, 6)
}

export function formatTokenBalance(balance, decimal) {
  return !!(balance && Number.isInteger(decimal)) ? amountFormatter(balance, decimal, Math.min(4, decimal)) : 0
}

export function formatToUsd(price) {
  const format = { decimalSeparator: '.', groupSeparator: ',', groupSize: 3 }
  const usdPrice = formatFixed(price, {
    decimalPlaces: 2,
    dropTrailingZeros: false,
    format
  })
  return usdPrice
}

// get the token balance of an address
export async function getTokenBalance(tokenAddress, address, library) {
  if (!isAddress(tokenAddress) || !isAddress(address)) {
    throw Error(`Invalid 'tokenAddress' or 'address' parameter '${tokenAddress}' or '${address}'.`)
  }

  return getContract(tokenAddress, ERC20_ABI, library).balanceOf(address)
}

// get the token allowance
export async function getTokenAllowance(address, tokenAddress, spenderAddress, library) {
  if (!isAddress(address) || !isAddress(tokenAddress) || !isAddress(spenderAddress)) {
    throw Error(
      "Invalid 'address' or 'tokenAddress' or 'spenderAddress' parameter" +
        `'${address}' or '${tokenAddress}' or '${spenderAddress}'.`
    )
  }

  return getContract(tokenAddress, ERC20_ABI, library).allowance(address, spenderAddress)
}

// amount must be a BigNumber, {base,display}Decimals must be Numbers
export function amountFormatter(amount, baseDecimals = 18, displayDecimals = 3, useLessThan = true) {
  if (displayDecimals > baseDecimals) {
    return amountFormatter(amount, baseDecimals, baseDecimals, useLessThan)
  }

  const zero = ethers.utils.bigNumberify(0)
  if (baseDecimals > 18 || displayDecimals > 18 || displayDecimals > baseDecimals) {
    throw Error(`Invalid combination of baseDecimals '${baseDecimals}' and displayDecimals '${displayDecimals}.`)
  }
  // if balance is falsy, return undefined
  if (!amount) {
    return undefined
  }
  // if amount is 0, return
  else if (amount.isZero()) {
    return '0'
  }
  // amount is negative
  else if (amount.lt(zero)) {
    return `-${amountFormatter(zero.sub(amount), baseDecimals, displayDecimals, useLessThan)}`
  }
  // amount > 0
  else {
    // amount of 'wei' in 1 'ether'
    const baseAmount = ethers.utils.bigNumberify(10).pow(ethers.utils.bigNumberify(baseDecimals))

    const minimumDisplayAmount = baseAmount.div(
      ethers.utils.bigNumberify(10).pow(ethers.utils.bigNumberify(displayDecimals))
    )

    // if balance is less than the minimum display amount
    if (amount.lt(minimumDisplayAmount)) {
      return useLessThan
        ? `<${ethers.utils.formatUnits(minimumDisplayAmount, baseDecimals)}`
        : `${ethers.utils.formatUnits(amount, baseDecimals)}`
    }
    // if the balance is greater than the minimum display amount
    else {
      const stringAmount = ethers.utils.formatUnits(amount, baseDecimals)

      // if there isn't a decimal portion
      if (!stringAmount.match(/\./)) {
        return stringAmount
      }
      // if there is a decimal portion
      else {
        const [wholeComponent, decimalComponent] = stringAmount.split('.')
        const roundUpAmount = minimumDisplayAmount.div(ethers.constants.Two)
        const roundedDecimalComponent = ethers.utils
          .bigNumberify(decimalComponent.padEnd(baseDecimals, '0'))
          .add(roundUpAmount)
          .toString()
          .padStart(baseDecimals, '0')
          .substring(0, displayDecimals)

        // decimals are too small to show
        if (roundedDecimalComponent === '0'.repeat(displayDecimals)) {
          return wholeComponent
        }
        // decimals are not too small to show
        else {
          return `${wholeComponent}.${roundedDecimalComponent.toString().replace(/0*$/, '')}`
        }
      }
    }
  }
}
