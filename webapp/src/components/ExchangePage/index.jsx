import React, { createContext, useState, useReducer, useEffect } from 'react'
import ReactGA from 'react-ga'

import { useTranslation } from 'react-i18next'
import { useWeb3Context } from 'web3-react'
import { aggregate } from '@makerdao/multicall'
import * as ls from 'local-storage'

import { safeAccess, isAddress } from '../../utils'

import { ethers } from 'ethers'
import styled from 'styled-components'
import Web3 from 'web3'

import { Button } from '../../theme'
import CurrencyInputPanel, { CurrencySelect, Aligner, StyledTokenName } from '../CurrencyInputPanel'
import OversizedPanel from '../OversizedPanel'
import TransactionDetails from '../TransactionDetails'
import TokenLogo from '../TokenLogo'
import ArrowDown from '../../assets/svg/SVGArrowDown'
import Circle from '../../assets/images/circle.svg'
import SVGClose from '../../assets/svg/SVGClose'
import SVGDiv from '../../assets/svg/SVGDiv'
import { amountFormatter } from '../../utils'
import { useUniswapExContract } from '../../hooks'
import { Spinner } from '../../theme'
import { useTokenDetails, useAllTokenDetails } from '../../contexts/Tokens'
import {
  useTransactionAdder,
  ACTION_PLACE_ORDER,
  ACTION_CANCEL_ORDER,
  useAllPendingOrders,
  useAllPendingCancelOrders,
  useOrderPendingState
} from '../../contexts/Transactions'
import { useAddressBalance, useExchangeReserves } from '../../contexts/Balances'
import { useFetchAllBalances } from '../../contexts/AllBalances'
import { useAddressAllowance } from '../../contexts/Allowances'

import './ExchangePage.css'

const readWeb3 = new Web3(process.env.REACT_APP_NETWORK_URL)

const MULTICALL_CONFIG = {
  multicallAddress: '0xeefba1e63905ef1d7acba5a8513c70307c1ce441',
  rpcUrl: process.env.REACT_APP_NETWORK_URL
}

// Use to detach input from output
let inputValue

let ranBackfill = {}
let ranEthBackfill = {}

const INPUT = 0
const OUTPUT = 1
const RATE = 2

const ETH_TO_TOKEN = 0
const TOKEN_TO_ETH = 1
const TOKEN_TO_TOKEN = 2

// Denominated in bips
const SLIPPAGE_WARNING = '30' // [30+%

const RATE_OP_MULT = 'x'
const RATE_OP_DIV = '/'

// Addresses
const ETH_ADDRESS = '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE'

// Order fee
const ORDER_FEE = '6000000000000000' // 0,006 ETH
const ORDER_MIN_FEE = 300000 * 1e9 // Fee with 1 GWEI

const DownArrowBackground = styled.div`
  ${({ theme }) => theme.flexRowNoWrap}
  justify-content: center;
  align-items: center;
`

const WrappedArrowDown = ({ clickable, active, ...rest }) => <ArrowDown {...rest} />
const DownArrow = styled(WrappedArrowDown)`
  color: ${({ theme, active }) => (active ? theme.royalGreen : theme.chaliceGray)};
  width: 0.625rem;
  height: 0.625rem;
  position: relative;
  padding: 0.875rem;
  cursor: ${({ clickable }) => clickable && 'pointer'};
`

const WrappedArrowRight = ({ clickable, active, ...rest }) => <ArrowDown {...rest} transform="rotate(-90)" />
const RightArrow = styled(WrappedArrowRight)`
  color: ${({ theme }) => theme.royalGreen};
  width: 0.625rem;
  height: 0.625rem;
  position: relative;
`

const WrappedRateIcon = ({ RateIconSVG, clickable, active, icon, ...rest }) => <RateIconSVG {...rest} />

const RateIcon = styled(WrappedRateIcon)`
  stroke: ${({ theme, active }) => (active ? theme.royalGreen : theme.chaliceGray)};
  width: 0.625rem;
  height: 0.625rem;
  position: relative;
  padding: 0.875rem;
  -webkit-user-select: none;
  -moz-user-select: none;
  -ms-user-select: none;
  user-select: none;
  cursor: ${({ clickable }) => clickable && 'pointer'};
`

const ExchangeRateWrapper = styled.div`
  ${({ theme }) => theme.flexRowNoWrap};
  align-items: center;
  color: ${({ theme }) => theme.doveGray};
  font-size: 0.75rem;
  padding: 0.5rem 1rem;
`

const ExchangeRate = styled.span`
  flex: 1 1 auto;
  width: 0;
  color: ${({ theme }) => theme.doveGray};
`

const Flex = styled.div`
  display: flex;
  justify-content: center;
  padding: 2rem;

  button {
    max-width: 20rem;
  }
`

const Order = styled.div`
  display: -webkit-box;
  display: -webkit-flex;
  display: -ms-flexbox;
  display: flex;
  -webkit-flex-flow: column nowrap;
  -ms-flex-flow: column nowrap;
  flex-flow: column nowrap;
  box-shadow: 0 4px 8px 0 rgba(0, 0, 0, 0.05);
  position: relative;
  border-radius: 1.25rem;
  z-index: 1;
  padding: 20px;
  margin-bottom: 40px;
  border: ${({ theme }) => `1px solid ${theme.malibuGreen}`};
  background-color: ${({ theme }) => theme.concreteGray};
`

const SpinnerWrapper = styled(Spinner)`
  margin: 0 0.25rem 0 0.25rem;
`

// ///
// Local storage
// ///
const LS_ORDERS = 'orders_'
const LS_LAST_BACKFILL = 'last_backfill_'
const LS_LAST_ETH_BACKFILL = 'last_backfill_eth_'

function lsKey(key, account) {
  return key + account.toString()
}

function saveOrder(account, orderData) {
  if (!account) return

  const key = lsKey(LS_ORDERS, account)
  const prev = ls.get(key)

  if (prev === null) {
    ls.set(key, [orderData])
  } else {
    const parsed = prev
    if (parsed.indexOf(orderData) === -1) {
      parsed.push(orderData)
      ls.set(key, parsed)
    }
  }
}

function getSavedOrders(account) {
  if (!account) return []

  const raw = ls.get(lsKey(LS_ORDERS, account))
  return raw === null ? [] : raw
}

function setLastBackfill(account, lastBlock) {
  if (!account) return

  ls.set(lsKey(LS_LAST_BACKFILL, account), lastBlock)
}

function getLastBackfill(account) {
  if (!account) return 0

  const raw = ls.get(lsKey(LS_LAST_BACKFILL, account))
  return raw === null ? 0 : raw
}

function setLastEthBackfill(account, lastBlock) {
  if (!account) return

  ls.set(lsKey(LS_LAST_ETH_BACKFILL, account), lastBlock)
}

function getLastEthBackfill(account) {
  if (!account) return 0

  const raw = ls.get(lsKey(LS_LAST_ETH_BACKFILL, account))
  return raw === null ? 0 : raw
}

// ///
// Helpers
// ///

function getSwapType(inputCurrency, outputCurrency) {
  if (!inputCurrency || !outputCurrency) {
    return null
  } else if (inputCurrency === 'ETH') {
    return ETH_TO_TOKEN
  } else if (outputCurrency === 'ETH') {
    return TOKEN_TO_ETH
  } else {
    return TOKEN_TO_TOKEN
  }
}

// this mocks the getInputPrice function, and calculates the required output
// updateInputValue is hack to detach output input from output
function calculateEtherTokenOutputFromInput(inputAmount, inputReserve, outputReserve, updateInputValue = true) {
  const inputAmountWithFee = inputAmount.mul(ethers.utils.bigNumberify(997))
  const numerator = inputAmountWithFee.mul(outputReserve)
  const denominator = inputReserve.mul(ethers.utils.bigNumberify(1000)).add(inputAmountWithFee)
  if (updateInputValue) {
    inputValue = inputAmount
  }
  return numerator.div(denominator)
}

// this mocks the getOutputPrice function, and calculates the required input
function calculateEtherTokenInputFromOutput(outputAmount, inputReserve, outputReserve) {
  const numerator = inputReserve.mul(outputAmount).mul(ethers.utils.bigNumberify(1000))
  const denominator = outputReserve.sub(outputAmount).mul(ethers.utils.bigNumberify(997))
  return numerator.div(denominator).add(ethers.constants.One)
}

function getInitialSwapState(outputCurrency) {
  return {
    independentValue: '', // this is a user input
    dependentValue: '', // this is a calculated number
    independentField: INPUT,
    prevIndependentField: OUTPUT,
    inputCurrency: 'ETH',
    outputCurrency: outputCurrency ? outputCurrency : '',
    rateOp: RATE_OP_MULT,
    inputRateValue: ''
  }
}

function swapStateReducer(state, action) {
  switch (action.type) {
    case 'FLIP_INDEPENDENT': {
      const { inputCurrency, outputCurrency } = state
      return {
        ...state,
        dependentValue: '',
        independentField: INPUT,
        independentValue: '',
        inputRateValue: '',
        inputCurrency: outputCurrency,
        outputCurrency: inputCurrency
      }
    }
    case 'FLIP_RATE_OP': {
      const { rateOp, inputRateValue } = state

      const rate = inputRateValue ? ethers.utils.bigNumberify(ethers.utils.parseUnits(inputRateValue, 18)) : undefined
      const flipped = rate ? amountFormatter(flipRate(rate), 18, 18, false) : ''

      return {
        ...state,
        inputRateValue: flipped,
        rateOp: rateOp === RATE_OP_DIV ? RATE_OP_MULT : RATE_OP_DIV
      }
    }
    case 'SELECT_CURRENCY': {
      const { inputCurrency, outputCurrency } = state
      const { field, currency } = action.payload

      const newInputCurrency = field === INPUT ? currency : inputCurrency
      const newOutputCurrency = field === OUTPUT ? currency : outputCurrency

      if (newInputCurrency === newOutputCurrency) {
        return {
          ...state,
          inputCurrency: field === INPUT ? currency : '',
          outputCurrency: field === OUTPUT ? currency : ''
        }
      } else {
        return {
          ...state,
          inputCurrency: newInputCurrency,
          outputCurrency: newOutputCurrency
        }
      }
    }
    case 'UPDATE_INDEPENDENT': {
      const { field, value } = action.payload
      const { dependentValue, independentValue, independentField, prevIndependentField, inputRateValue } = state

      return {
        ...state,
        independentValue: field !== RATE ? value : independentValue,
        dependentValue: Number(value) === Number(independentValue) ? dependentValue : '',
        independentField: field,
        inputRateValue: field === RATE ? value : inputRateValue,
        prevIndependentField: independentField === field ? prevIndependentField : independentField
      }
    }
    case 'UPDATE_DEPENDENT': {
      return {
        ...state,
        dependentValue: action.payload === null ? inputValue : action.payload
      }
    }
    default: {
      return getInitialSwapState()
    }
  }
}

function getExchangeRate(inputValue, inputDecimals, outputValue, outputDecimals, invert = false) {
  try {
    if (
      inputValue &&
      (inputDecimals || inputDecimals === 0) &&
      outputValue &&
      (outputDecimals || outputDecimals === 0)
    ) {
      const factor = ethers.utils.bigNumberify(10).pow(ethers.utils.bigNumberify(18))

      if (invert) {
        return inputValue
          .mul(factor)
          .div(outputValue)
          .mul(ethers.utils.bigNumberify(10).pow(ethers.utils.bigNumberify(outputDecimals)))
          .div(ethers.utils.bigNumberify(10).pow(ethers.utils.bigNumberify(inputDecimals)))
      } else {
        return outputValue
          .mul(factor)
          .div(inputValue)
          .mul(ethers.utils.bigNumberify(10).pow(ethers.utils.bigNumberify(inputDecimals)))
          .div(ethers.utils.bigNumberify(10).pow(ethers.utils.bigNumberify(outputDecimals)))
      }
    }
  } catch {}
}

function applyExchangeRateTo(inputValue, exchangeRate, inputDecimals, outputDecimals, invert = false) {
  try {
    if (
      inputValue &&
      exchangeRate &&
      (inputDecimals || inputDecimals === 0) &&
      (outputDecimals || outputDecimals === 0)
    ) {
      const factor = ethers.utils.bigNumberify(10).pow(ethers.utils.bigNumberify(18))

      if (invert) {
        return inputValue
          .mul(factor)
          .div(exchangeRate)
          .mul(ethers.utils.bigNumberify(10).pow(ethers.utils.bigNumberify(outputDecimals)))
          .div(ethers.utils.bigNumberify(10).pow(ethers.utils.bigNumberify(inputDecimals)))
      } else {
        return exchangeRate
          .mul(inputValue)
          .div(factor)
          .mul(ethers.utils.bigNumberify(10).pow(ethers.utils.bigNumberify(outputDecimals)))
          .div(ethers.utils.bigNumberify(10).pow(ethers.utils.bigNumberify(inputDecimals)))
      }
    }
  } catch {}
}

function exchangeRateDiff(exchangeRateA, exchangeRateB) {
  try {
    if (exchangeRateA && exchangeRateB) {
      const factor = ethers.utils.bigNumberify(10).pow(ethers.utils.bigNumberify(18))
      const deltaRaw = factor.mul(exchangeRateA).div(exchangeRateB)

      if (false && deltaRaw < factor) {
        return factor.sub(deltaRaw)
      } else {
        return deltaRaw.sub(factor)
      }
    }
  } catch {}
}

function flipRate(rate) {
  try {
    if (rate) {
      const factor = ethers.utils.bigNumberify(10).pow(ethers.utils.bigNumberify(18))
      return factor.mul(factor).div(rate)
    }
  } catch {}
}

function getMarketRate(
  swapType,
  inputReserveETH,
  inputReserveToken,
  inputDecimals,
  outputReserveETH,
  outputReserveToken,
  outputDecimals,
  invert = false
) {
  if (swapType === ETH_TO_TOKEN) {
    return getExchangeRate(outputReserveETH, 18, outputReserveToken, outputDecimals, invert)
  } else if (swapType === TOKEN_TO_ETH) {
    return getExchangeRate(inputReserveToken, inputDecimals, inputReserveETH, 18, invert)
  } else if (swapType === TOKEN_TO_TOKEN) {
    const factor = ethers.utils.bigNumberify(10).pow(ethers.utils.bigNumberify(18))
    const firstRate = getExchangeRate(inputReserveToken, inputDecimals, inputReserveETH, 18)
    const secondRate = getExchangeRate(outputReserveETH, 18, outputReserveToken, outputDecimals)
    try {
      return !!(firstRate && secondRate) ? firstRate.mul(secondRate).div(factor) : undefined
    } catch {}
  }
}

function findOrders(data) {
  const orders = []
  const transfers = data.split('a9059cbb').slice(1)

  for (const transfer of transfers) {
    if (transfer.length >= 704) {
      const order = transfer.slice(256, 706)
      // Uniswap orders have a pk and address embeded on the tx
      // we look for those
      const pk = `0x${order.slice(320, 320 + 64)}`
      const expectedAddress = `0x${order.slice(408, 408 + 40)}`
      if (new ethers.Wallet(pk).address.toLowerCase() === expectedAddress) {
        orders.push(`0x${order.slice(1)}`)
      }
    }
  }

  return orders
}

async function backfillOrders(account, onUpdate = _ => {}) {
  const reviewedTxs = new Set()

  const targetBlock = await readWeb3.eth.getBlockNumber()
  const last = getLastBackfill(account)
  console.info(`Running backfill for ${account} - ${last}/${targetBlock}`)

  const logs = await readWeb3.eth.getPastLogs({
    fromBlock: last,
    toBlock: targetBlock,
    topics: [
      '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef', // Transfer topic
      `0x000000000000000000000000${account.replace('0x', '')}` // Account topic
    ]
  })

  console.info(`Found ${logs.length} candidates for ${account}`)

  let bufferEval = 0
  for (const log of logs) {
    const txHash = log.transactionHash
    if (!reviewedTxs.has(txHash)) {
      reviewedTxs.add(txHash)
      const tx = await readWeb3.eth.getTransaction(txHash)
      const orders = findOrders(tx.input)

      for (const order of orders) {
        console.info(`Found order ${txHash}`)
        saveOrder(account, order)
        onUpdate(log.blockNumber)
      }

      bufferEval++
      if (bufferEval > 10) {
        setLastBackfill(account, log.blockNumber)
        bufferEval = 0
      }
    }
  }

  setLastBackfill(account, targetBlock)
  console.info(`Finished backfill for ${account} up to ${targetBlock}`)
  return targetBlock
}

async function backfillEthOrders(account, uniswapEx) {
  if (!account) return

  if (ranEthBackfill[account]) return
  ranEthBackfill[account] = true

  const targetBlock = await readWeb3.eth.getBlockNumber()
  const last = getLastEthBackfill(account)
  console.info(`Running ETH backfill for ${account} - ${last}/${targetBlock}`)

  const logs = await readWeb3.eth.getPastLogs({
    fromBlock: last,
    toBlock: targetBlock,
    address: uniswapEx.address,
    topics: [
      '0x294738b98bcebacf616fd72532d3d8d8d229807bf03b68b25681bfbbdb3d3fe5', // Deposit topic
      null, // Any log
      `0x000000000000000000000000${account.replace('0x', '')}` // Account topic
    ]
  })

  console.info(`Found ${logs.length} ETH orders for ${account}`)

  for (const log of logs) {
    const order = log.data.slice(194)
    saveOrder(account, order)
  }

  setLastEthBackfill(account, targetBlock)
  console.info(`Finished ETH backfill for ${account}`)
}

const BACKFILL_RUNNING = 1
const BACKFILL_DONE = 2

function useBackfill(account, uniswapEXContract) {
  const [oState, setOState] = useState({
    ranBackfill: {},
    syncBlock: 0
  })

  const [eState, setEState] = useState({
    ranEthBackfill: {}
  })

  useEffect(() => {
    if (isAddress(account) && oState.ranBackfill[account] === undefined) {
      setOState({ ranBackfill: { ...oState.ranBackfill, [account]: BACKFILL_RUNNING } })
      backfillOrders(account, block => {
        setOState({ syncBlock: block, ranBackfill: { ...oState.ranBackfill, [account]: BACKFILL_RUNNING } })
      }).then(block => {
        setOState({
          syncBlock: block,
          ranBackfill: { ...oState.ranBackfill, [account]: BACKFILL_DONE }
        })
      })
    }
  }, [account, oState.ranBackfill])

  useEffect(() => {
    if (isAddress(account) && eState.ranEthBackfill[account] === undefined) {
      setEState({ ranEthBackfill: { ...eState.ranEthBackfill, [account]: BACKFILL_RUNNING } })
      backfillEthOrders(account, uniswapEXContract).then(() => {
        setEState({ ranEthBackfill: { ...eState.ranEthBackfill, [account]: BACKFILL_DONE } })
      })
    }
  }, [account, eState.ranEthBackfill, uniswapEXContract])

  return { ...oState, ...eState }
}

async function balancesOfOrders(orders, uniswapEXContract) {
  const result = await aggregate(
    orders.map((o, i) => {
      if (!isEthOrder(o)) {
        return {
          target: o.fromToken,
          call: ['balanceOf(address)(uint256)', vaultForOrder(o, uniswapEXContract)],
          returns: [[i]]
        }
      } else {
        return {
          target: uniswapEXContract.address,
          call: ['ethDeposits(bytes32)(uint256)', keyOfOrder(o)],
          returns: [[i]]
        }
      }
    }),
    MULTICALL_CONFIG
  )

  return result.results
}

async function fetchUserOrders(account, uniswapEXContract) {
  const allOrders = getSavedOrders(account)
  const decodedOrders = allOrders.map(o => decodeOrder(uniswapEXContract, o))
  const amounts = await balancesOfOrders(decodedOrders, uniswapEXContract)
  decodedOrders.map((o, i) => (o.amount = amounts[i]))
  return {
    allOrders: decodedOrders,
    openOrders: decodedOrders.filter(o => !ethers.utils.bigNumberify(o.amount).eq(ethers.constants.Zero))
  }
}

function useStoredOrders(account, uniswapEXContract, deps = []) {
  const [state, setState] = useState({ openOrders: [], allOrders: [] })

  useEffect(() => {
    console.log(`Requesting load orders from storage`)
    if (isAddress(account)) {
      let stale = false
      fetchUserOrders(account, uniswapEXContract).then(orders => {
        console.log(`Fetched ${orders.allOrders.length} ${orders.openOrders.length} orders from local storage`)
        if (!stale) {
          setState(orders)
        } else {
          console.log(`Staled load orders from storage`)
        }
      })
      return () => {
        stale = true
      }
    }
  }, [...deps, account, uniswapEXContract])

  return state
}

function keyOfOrder(order) {
  return readWeb3.utils.soliditySha3({
    t: 'bytes',
    v: readWeb3.eth.abi.encodeParameters(
      ['address', 'address', 'uint256', 'uint256', 'address', 'address'],
      [order.fromToken, order.toToken, order.minReturn, order.fee, order.owner, order.witness]
    )
  })
}

function vaultForOrder(order, uniswapEXContract) {
  const VAULT_CODE_HASH = '0xfa3da1081bc86587310fce8f3a5309785fc567b9b20875900cb289302d6bfa97'
  const hash = readWeb3.utils.soliditySha3(
    { t: 'bytes1', v: '0xff' },
    { t: 'address', v: uniswapEXContract.address },
    { t: 'bytes32', v: keyOfOrder(order) },
    { t: 'bytes32', v: VAULT_CODE_HASH }
  )

  return `0x${hash.slice(-40)}`
}

function decodeOrder(uniswapEXContract, data) {
  // const { fromToken, toToken, minReturn, fee, owner, witness } = await uniswapEXContract.decodeOrder(data)
  const decoded = readWeb3.eth.abi.decodeParameters(
    ['address', 'address', 'uint256', 'uint256', 'address', 'bytes32', 'address'],
    data
  )

  return {
    fromToken: decoded[0],
    toToken: decoded[1],
    minReturn: decoded[2],
    fee: decoded[3],
    owner: decoded[4],
    witness: decoded[6],
    data: data
  }
}

function isEthOrder(order) {
  return order.fromToken.toLowerCase() === ETH_ADDRESS.toLowerCase()
}

function canCoverFees(swapType, fee, value, inputReserveETH, inputReserveToken, inputDecimals) {
  if (!value || swapType === null) {
    return true
  }

  const orderFee = ethers.utils.bigNumberify(fee.toString())
  let ethValue

  if (swapType === ETH_TO_TOKEN) {
    ethValue = value
  } else {
    const factor = ethers.utils.bigNumberify(10).pow(ethers.utils.bigNumberify(inputDecimals))
    const ethRate = getExchangeRate(inputReserveToken, inputDecimals, inputReserveETH, 18)
    if (!ethRate) {
      return true
    }
    ethValue = value.mul(ethRate).div(factor)
  }

  return ethValue.gt(orderFee)
}

export default function ExchangePage({ initialCurrency }) {
  const { t } = useTranslation()
  const { account } = useWeb3Context()

  // core swap state
  const [swapState, dispatchSwapState] = useReducer(swapStateReducer, initialCurrency, getInitialSwapState)

  const {
    independentValue,
    dependentValue,
    independentField,
    inputCurrency,
    outputCurrency,
    rateOp,
    inputRateValue
  } = swapState

  const uniswapEXContract = useUniswapExContract()
  const [inputError, setInputError] = useState()

  const stateBackfill = useBackfill(account, uniswapEXContract)
  const loading = stateBackfill.ranBackfill[account] !== BACKFILL_DONE || stateBackfill.ranEthBackfill[account] !== BACKFILL_DONE

  const pendingOrders = useAllPendingOrders()
  const { allOrders, openOrders } = useStoredOrders(account, uniswapEXContract, [
    stateBackfill.syncBlock,
    stateBackfill.ranBackfill[account],
    stateBackfill.ranEthBackfill[account],
    pendingOrders.length
  ])

  const orders = openOrders.concat(allOrders.filter(o => pendingOrders.indexOf(o.data) !== -1))
  const addTransaction = useTransactionAdder()

  // analytics
  useEffect(() => {
    ReactGA.pageview(window.location.pathname + window.location.search)
  }, [])

  // get swap type from the currency types
  const swapType = getSwapType(inputCurrency, outputCurrency)

  // get decimals and exchange address for each of the currency types
  const { symbol: inputSymbol, decimals: inputDecimals, exchangeAddress: inputExchangeAddress } = useTokenDetails(
    inputCurrency
  )
  const { symbol: outputSymbol, decimals: outputDecimals } = useTokenDetails(outputCurrency)
  const allTokens = useAllTokenDetails()

  // get input allowance
  const inputAllowance = useAddressAllowance(account, inputCurrency, inputExchangeAddress)

  // fetch reserves for each of the currency types
  const { reserveETH: inputReserveETH, reserveToken: inputReserveToken } = useExchangeReserves(inputCurrency)
  const { reserveETH: outputReserveETH, reserveToken: outputReserveToken } = useExchangeReserves(outputCurrency)

  // get balances for each of the currency types
  const inputBalance = useAddressBalance(account, inputCurrency)
  const outputBalance = useAddressBalance(account, outputCurrency)
  const inputBalanceFormatted = !!(inputBalance && Number.isInteger(inputDecimals))
    ? amountFormatter(inputBalance, inputDecimals, Math.min(4, inputDecimals))
    : ''
  const outputBalanceFormatted = !!(outputBalance && Number.isInteger(outputDecimals))
    ? amountFormatter(outputBalance, outputDecimals, Math.min(4, outputDecimals))
    : ''

  // compute useful transforms of the data above
  const independentDecimals = independentField === INPUT ? inputDecimals : outputDecimals
  const dependentDecimals = independentField === OUTPUT ? inputDecimals : outputDecimals

  // declare/get parsed and formatted versions of input/output values
  const [independentValueParsed, setIndependentValueParsed] = useState()
  const dependentValueFormatted = !!(dependentValue && (dependentDecimals || dependentDecimals === 0))
    ? amountFormatter(dependentValue, dependentDecimals, Math.min(4, dependentDecimals), false)
    : ''

  const [savedRate, setSavedRate] = useState()

  const inputValueParsed = independentField === INPUT ? independentValueParsed : inputValue
  const inputValueFormatted =
    independentField === INPUT ? independentValue : amountFormatter(inputValue, inputDecimals, Math.min(4, 18), false)

  let outputValueFormatted
  let outputValueParsed
  let rateRaw = savedRate ? ethers.utils.bigNumberify(ethers.utils.parseUnits(savedRate, 18)) : ''

  switch (independentField) {
    case OUTPUT:
      outputValueParsed = independentValueParsed
      outputValueFormatted = independentValue
      rateRaw = getExchangeRate(
        inputValueParsed,
        inputDecimals,
        outputValueParsed,
        outputDecimals,
        rateOp === RATE_OP_DIV
      )
      break
    case RATE:
      if (!inputRateValue || Number(inputRateValue) === 0) {
        outputValueParsed = ''
        outputValueFormatted = ''
      } else {
        rateRaw = ethers.utils.bigNumberify(ethers.utils.parseUnits(inputRateValue, 18))
        outputValueParsed = applyExchangeRateTo(
          inputValueParsed,
          rateRaw,
          inputDecimals,
          outputDecimals,
          rateOp === RATE_OP_DIV
        )
        outputValueFormatted = amountFormatter(
          outputValueParsed,
          dependentDecimals,
          Math.min(4, dependentDecimals),
          false
        )
      }

      break
    case INPUT:
      outputValueParsed = dependentValue
      outputValueFormatted = dependentValueFormatted
      rateRaw = getExchangeRate(
        inputValueParsed,
        inputDecimals,
        outputValueParsed,
        outputDecimals,
        rateOp === RATE_OP_DIV
      )
      break
    default:
      break
  }

  // rate info
  const rateFormatted = independentField === RATE ? inputRateValue : amountFormatter(rateRaw, 18, 4, false)
  const inverseRateInputSymbol = rateOp === RATE_OP_DIV ? inputSymbol : outputSymbol
  const inverseRateOutputSymbol = rateOp === RATE_OP_DIV ? outputSymbol : inputSymbol
  const inverseRate = flipRate(rateRaw)

  useEffect(() => {
    setSavedRate(rateFormatted)
  }, [rateFormatted])

  // validate + parse independent value
  const [independentError, setIndependentError] = useState()
  useEffect(() => {
    if (independentValue && (independentDecimals || independentDecimals === 0)) {
      try {
        const parsedValue = ethers.utils.parseUnits(independentValue, independentDecimals)

        if (parsedValue.lte(ethers.constants.Zero) || parsedValue.gte(ethers.constants.MaxUint256)) {
          throw Error()
        } else {
          setIndependentValueParsed(parsedValue)
          setIndependentError(null)
        }
      } catch {
        setIndependentError(t('inputNotValid'))
      }

      return () => {
        setIndependentValueParsed()
        setIndependentError()
      }
    }
  }, [independentValue, independentDecimals, t])

  // validate input allowance + balance
  const [showUnlock, setShowUnlock] = useState(false)
  useEffect(() => {
    const inputValueCalculation = inputValueParsed
    if (inputBalance && (inputAllowance || inputCurrency === 'ETH') && inputValueCalculation) {
      if (inputBalance.lt(inputValueCalculation)) {
        setInputError(t('insufficientBalance'))
      } else {
        setInputError(null)
        setShowUnlock(false)
      }
      return () => {
        setInputError()
        setShowUnlock(false)
      }
    }
  }, [inputBalance, inputCurrency, inputAllowance, t, inputValueParsed])

  // calculate dependent value
  useEffect(() => {
    const amount = independentValueParsed

    if (independentField === OUTPUT || independentField === RATE) {
      return () => {
        dispatchSwapState({ type: 'UPDATE_DEPENDENT', payload: null })
      }
    }

    if (swapType === ETH_TO_TOKEN) {
      const reserveETH = outputReserveETH
      const reserveToken = outputReserveToken

      if (amount && reserveETH && reserveToken) {
        try {
          const calculatedDependentValue =
            independentField === INPUT
              ? calculateEtherTokenOutputFromInput(amount, reserveETH, reserveToken)
              : calculateEtherTokenInputFromOutput(amount, reserveETH, reserveToken)

          if (calculatedDependentValue.lte(ethers.constants.Zero)) {
            throw Error()
          }

          dispatchSwapState({ type: 'UPDATE_DEPENDENT', payload: calculatedDependentValue })
        } catch {
          setIndependentError(t('insufficientLiquidity'))
        }
        return () => {
          dispatchSwapState({ type: 'UPDATE_DEPENDENT', payload: '' })
        }
      }
    } else if (swapType === TOKEN_TO_ETH) {
      const reserveETH = inputReserveETH
      const reserveToken = inputReserveToken

      if (amount && reserveETH && reserveToken) {
        try {
          const calculatedDependentValue =
            independentField === INPUT
              ? calculateEtherTokenOutputFromInput(amount, reserveToken, reserveETH)
              : calculateEtherTokenInputFromOutput(amount, reserveToken, reserveETH)

          if (calculatedDependentValue.lte(ethers.constants.Zero)) {
            throw Error()
          }

          dispatchSwapState({ type: 'UPDATE_DEPENDENT', payload: calculatedDependentValue })
        } catch {
          setIndependentError(t('insufficientLiquidity'))
        }
        return () => {
          dispatchSwapState({ type: 'UPDATE_DEPENDENT', payload: '' })
        }
      }
    } else if (swapType === TOKEN_TO_TOKEN) {
      const reserveETHFirst = inputReserveETH
      const reserveTokenFirst = inputReserveToken

      const reserveETHSecond = outputReserveETH
      const reserveTokenSecond = outputReserveToken

      if (amount && reserveETHFirst && reserveTokenFirst && reserveETHSecond && reserveTokenSecond) {
        try {
          if (independentField === INPUT) {
            const intermediateValue = calculateEtherTokenOutputFromInput(amount, reserveTokenFirst, reserveETHFirst)
            if (intermediateValue.lte(ethers.constants.Zero)) {
              throw Error()
            }
            const calculatedDependentValue = calculateEtherTokenOutputFromInput(
              intermediateValue,
              reserveETHSecond,
              reserveTokenSecond,
              false
            )
            if (calculatedDependentValue.lte(ethers.constants.Zero)) {
              throw Error()
            }
            dispatchSwapState({ type: 'UPDATE_DEPENDENT', payload: calculatedDependentValue })
          } else {
            const intermediateValue = calculateEtherTokenInputFromOutput(amount, reserveETHSecond, reserveTokenSecond)
            if (intermediateValue.lte(ethers.constants.Zero)) {
              throw Error()
            }
            const calculatedDependentValue = calculateEtherTokenInputFromOutput(
              intermediateValue,
              reserveTokenFirst,
              reserveETHFirst
            )
            if (calculatedDependentValue.lte(ethers.constants.Zero)) {
              throw Error()
            }
            dispatchSwapState({ type: 'UPDATE_DEPENDENT', payload: calculatedDependentValue })
          }
        } catch {
          setIndependentError(t('insufficientLiquidity'))
        }
        return () => {
          dispatchSwapState({ type: 'UPDATE_DEPENDENT', payload: '' })
        }
      }
    }
  }, [
    independentValueParsed,
    swapType,
    outputReserveETH,
    outputReserveToken,
    inputReserveETH,
    inputReserveToken,
    independentField,
    inputRateValue,
    t
  ])

  // calculate check liquidity
  useEffect(() => {
    if ((independentField === OUTPUT || independentField === RATE) && outputValueParsed) {
      return () => {
        let reserveAmount

        if (swapType === ETH_TO_TOKEN || swapType === TOKEN_TO_TOKEN) {
          reserveAmount = outputReserveToken
        } else {
          reserveAmount = inputReserveETH
        }

        if (reserveAmount && outputValueParsed.gt(reserveAmount)) {
          setIndependentError(t('insufficientLiquidity'))
        } else {
          setIndependentError(null)
          setInputError(null)
        }
      }
    }
  }, [swapType, outputValueParsed, inputReserveETH, outputReserveToken, independentField, t])

  const [inverted, setInverted] = useState(false)

  const marketRate = getMarketRate(
    swapType,
    inputReserveETH,
    inputReserveToken,
    inputDecimals,
    outputReserveETH,
    outputReserveToken,
    outputDecimals
  )

  const exchangeRate = marketRate
  const exchangeRateInverted = flipRate(exchangeRate)

  const rateDelta = exchangeRateDiff(rateOp === RATE_OP_DIV ? inverseRate : rateRaw, exchangeRate)
  const limitSlippage = ethers.utils
    .bigNumberify(SLIPPAGE_WARNING)
    .mul(ethers.utils.bigNumberify(10).pow(ethers.utils.bigNumberify(16)))
  const highSlippageWarning = rateDelta && rateDelta.lt(ethers.utils.bigNumberify(0).sub(limitSlippage))
  const rateDeltaFormatted = amountFormatter(rateDelta, 16, 2, true)

  const [fee, setFee] = useState(ORDER_FEE)

  const enoughAmountToCoverFees = canCoverFees(
    swapType,
    fee,
    independentField === INPUT ? independentValueParsed : inputValueParsed,
    inputReserveETH,
    inputReserveToken,
    inputDecimals
  )

  const isValid = outputValueParsed && !inputError && !independentError

  const estimatedText = `(${t('estimated')})`
  function formatBalance(value) {
    return `Balance: ${value}`
  }

  async function onPlace() {
    let method, fromCurrency, toCurrency, amount, minimumReturn, data, relayerFee

    ReactGA.event({
      category: 'place',
      action: 'place'
    })

    amount = inputValueParsed
    minimumReturn = outputValueParsed
    relayerFee = ethers.utils.bigNumberify(fee.toString())

    if (swapType === ETH_TO_TOKEN) {
      //@TODO: change it later
      method = uniswapEXContract.encodeEthOrder
      fromCurrency = ETH_ADDRESS
      toCurrency = outputCurrency
    } else if (swapType === TOKEN_TO_ETH) {
      method = uniswapEXContract.encodeTokenOrder
      fromCurrency = inputCurrency
      toCurrency = ETH_ADDRESS
    } else if (swapType === TOKEN_TO_TOKEN) {
      method = uniswapEXContract.encodeTokenOrder
      fromCurrency = inputCurrency
      toCurrency = outputCurrency
    }
    try {
      // Prefix Hex for secret message
      // this secret it's only intended for avoiding relayer front-running
      // so a decreased entropy it's not an issue
      const secret = ethers.utils.hexlify(ethers.utils.randomBytes(13)).replace('0x', '')
      const fullSecret = `20756e697377617065782e696f2020d83ddc09${secret}`
      const { privateKey, address } = new ethers.Wallet(fullSecret)
      data = await (swapType === ETH_TO_TOKEN
        ? method(fromCurrency, toCurrency, minimumReturn, relayerFee, account, privateKey, address)
        : method(fromCurrency, toCurrency, amount, minimumReturn, relayerFee, account, privateKey, address))
      const order = swapType === ETH_TO_TOKEN ? data : `0x${data.slice(267)}`
      saveOrder(account, order)
      const res = await (swapType === ETH_TO_TOKEN
        ? uniswapEXContract.depositEth(data, { value: amount })
        : new Promise((resolve, reject) =>
            window.web3.eth.sendTransaction(
              {
                from: account,
                to: fromCurrency,
                data
              },
              (err, hash) => {
                if (err) {
                  reject(err)
                }
                resolve({ hash })
              }
            )
          ))

      if (res.hash) {
        addTransaction(res, { action: ACTION_PLACE_ORDER, order: order })
      }
    } catch (e) {
      console.log(e.message)
    }
  }

  const [customSlippageError] = useState('')

  const allBalances = useFetchAllBalances()
  return (
    <>
      <CurrencyInputPanel
        title={t('input')}
        allBalances={allBalances}
        extraText={inputBalanceFormatted && formatBalance(inputBalanceFormatted)}
        extraTextClickHander={() => {
          if (inputBalance && inputDecimals) {
            const valueToSet = inputCurrency === 'ETH' ? inputBalance.sub(ethers.utils.parseEther('.1')) : inputBalance
            if (valueToSet.gt(ethers.constants.Zero)) {
              dispatchSwapState({
                type: 'UPDATE_INDEPENDENT',
                payload: { value: amountFormatter(valueToSet, inputDecimals, inputDecimals, false), field: INPUT }
              })
            }
          }
        }}
        onCurrencySelected={inputCurrency => {
          dispatchSwapState({ type: 'SELECT_CURRENCY', payload: { currency: inputCurrency, field: INPUT } })
        }}
        onValueChange={inputValue => {
          dispatchSwapState({ type: 'UPDATE_INDEPENDENT', payload: { value: inputValue, field: INPUT } })
        }}
        showUnlock={showUnlock}
        selectedTokens={[inputCurrency, outputCurrency]}
        selectedTokenAddress={inputCurrency}
        value={inputValueFormatted}
        errorMessage={inputError ? inputError : independentField === INPUT ? independentError : ''}
      />
      <OversizedPanel>
        <DownArrowBackground>
          <RateIcon
            RateIconSVG={rateOp === RATE_OP_MULT ? SVGClose : SVGDiv}
            icon={rateOp}
            onClick={() => {
              dispatchSwapState({ type: 'FLIP_RATE_OP' })
            }}
            clickable
            alt="swap"
            active={isValid}
          />
        </DownArrowBackground>
      </OversizedPanel>
      <CurrencyInputPanel
        title={t('rate')}
        showCurrencySelector={false}
        extraText={
          inverseRateInputSymbol && inverseRate && inverseRateOutputSymbol
            ? `1 ${inverseRateInputSymbol} = ${amountFormatter(inverseRate, 18, 4, false)} ${inverseRateOutputSymbol}`
            : '-'
        }
        extraTextClickHander={() => {
          dispatchSwapState({ type: 'FLIP_RATE_OP' })
        }}
        value={rateFormatted || ''}
        onValueChange={rateValue => {
          dispatchSwapState({ type: 'UPDATE_INDEPENDENT', payload: { value: rateValue, field: RATE } })
        }}
      />
      <OversizedPanel>
        <DownArrowBackground>
          <DownArrow
            onClick={() => {
              dispatchSwapState({ type: 'FLIP_INDEPENDENT' })
            }}
            clickable
            alt="swap"
            active={isValid}
          />
        </DownArrowBackground>
      </OversizedPanel>
      <CurrencyInputPanel
        title={t('output')}
        allBalances={allBalances}
        description={estimatedText}
        extraText={outputBalanceFormatted && formatBalance(outputBalanceFormatted)}
        onCurrencySelected={outputCurrency => {
          dispatchSwapState({ type: 'SELECT_CURRENCY', payload: { currency: outputCurrency, field: OUTPUT } })
        }}
        onValueChange={outputValue => {
          dispatchSwapState({ type: 'UPDATE_INDEPENDENT', payload: { value: outputValue, field: OUTPUT } })
        }}
        selectedTokens={[inputCurrency, outputCurrency]}
        selectedTokenAddress={outputCurrency}
        value={outputValueFormatted}
        errorMessage={independentField === OUTPUT ? independentError : ''}
        disableUnlock
      />
      <OversizedPanel hideBottom>
        <ExchangeRateWrapper
          onClick={() => {
            setInverted(inverted => !inverted)
          }}
        >
          <ExchangeRate>{t('exchangeRate')}</ExchangeRate>
          {inverted ? (
            <span>
              {exchangeRate
                ? `1 ${inputSymbol} = ${amountFormatter(exchangeRate, 18, 4, false)} ${outputSymbol}`
                : ' - '}
            </span>
          ) : (
            <span>
              {exchangeRate
                ? `1 ${outputSymbol} = ${amountFormatter(exchangeRateInverted, 18, 4, false)} ${inputSymbol}`
                : ' - '}
            </span>
          )}
        </ExchangeRateWrapper>
      </OversizedPanel>
      <TransactionDetails
        account={account}
        highSlippageWarning={highSlippageWarning}
        inputError={inputError}
        independentError={independentError}
        inputCurrency={inputCurrency}
        outputCurrency={outputCurrency}
        independentValue={independentValue}
        independentValueParsed={independentValueParsed}
        independentField={independentField}
        INPUT={INPUT}
        inputValueParsed={inputValueParsed}
        outputValueParsed={outputValueParsed}
        inputSymbol={inputSymbol}
        outputSymbol={outputSymbol}
        dependentDecimals={dependentDecimals}
        independentDecimals={independentDecimals}
        fee={fee}
        setFee={setFee}
      />
      <Flex>
        <Button
          disabled={!fee || !account || !isValid || customSlippageError === 'invalid' || !enoughAmountToCoverFees}
          onClick={onPlace}
          warning={
            fee < ORDER_MIN_FEE || highSlippageWarning || customSlippageError === 'warning' || !enoughAmountToCoverFees
          }
        >
          {fee < ORDER_MIN_FEE || customSlippageError === 'warning' ? t('placeAnyway') : t('place')}
        </Button>
      </Flex>
      {!account && <div className="fee-error">{t('noWallet')} </div>}
      {rateDeltaFormatted && (
        <div className="market-delta-info">
          {rateDeltaFormatted.startsWith('-')
            ? t('placeBelow', { rateDelta: rateDeltaFormatted })
            : t('placeAbove', { rateDelta: rateDeltaFormatted })}
        </div>
      )}
      {highSlippageWarning && (
        <div className="slippage-warning">
          <span role="img" aria-label="warning">
            ⚠️
          </span>
          {t('highSlippageWarning')}
        </div>
      )}
      {!enoughAmountToCoverFees && (
        <div className="fee-error">
          <span role="img" aria-label="error">
            💸
          </span>
          {t('enoughAmountToCoverFees', {
            fee: amountFormatter(ethers.utils.bigNumberify(fee.toString()), 18, 4, false)
          })}{' '}
          <TokenLogo address={'ETH'} />
        </div>
      )}
      <div>
        <p className="orders-title">{`${t('Orders')} ${orders.length > 0 ? `(${orders.length})` : ''}`}</p>
        { loading ? (
          <><SpinnerWrapper src={Circle} alt="loader" /> Loading ...</>
        ) : orders.length === 0 ? (
          <p>{t('noOpenOrders')}</p>
        ) : (
          <div>
            {orders.map(order => (
              <OrderCard key={order.witness} data={{ order: order }} />
            ))}
          </div>
        )}
      </div>
    </>
  )
}

function OrderCard(props) {
  const { t } = useTranslation()

  const order = props.data.order

  const fromToken = order.fromToken === ETH_ADDRESS ? 'ETH' : order.fromToken
  const toToken = order.toToken === ETH_ADDRESS ? 'ETH' : order.toToken

  const { symbol: fromSymbol, decimals: fromDecimals } = useTokenDetails(fromToken)
  const { symbol: toSymbol, decimals: toDecimals } = useTokenDetails(toToken)
  const state = useOrderPendingState(order.data)

  const canceling = state === ACTION_CANCEL_ORDER
  const pending = state === ACTION_PLACE_ORDER

  const uniswapEXContract = useUniswapExContract()
  const addTransaction = useTransactionAdder()

  async function onCancel(order, pending) {
    const { fromToken, toToken, minReturn, fee, owner, witness, data } = order
    uniswapEXContract
      .cancelOrder(fromToken, toToken, minReturn, fee, owner, witness, {
        gasLimit: pending ? 400000 : undefined
      })
      .then(response => {
        addTransaction(response, { action: ACTION_CANCEL_ORDER, order: data })
      })
  }

  return (
    <Order className="order">
      <div className="tokens">
        <CurrencySelect selected={true}>
          <Aligner>
            {<TokenLogo address={fromToken} />}
            {<StyledTokenName>{fromSymbol}</StyledTokenName>}
          </Aligner>
        </CurrencySelect>
        <Aligner>
          <RightArrow transform="rotate(-90)" />
        </Aligner>
        <CurrencySelect selected={true}>
          <Aligner>
            {<TokenLogo address={toToken} />}
            {<StyledTokenName>{toSymbol}</StyledTokenName>}
          </Aligner>
        </CurrencySelect>
      </div>
      <p>
        {!pending ? (
          <>
            {`Amount: ${amountFormatter(ethers.utils.bigNumberify(order.amount), fromDecimals, 6)}`} {fromSymbol}
          </>
        ) : (
          'Pending ...'
        )}
      </p>
      <p>
        {`Min return: ${amountFormatter(ethers.utils.bigNumberify(order.minReturn), toDecimals, 6)}`} {toSymbol}
      </p>
      <p>{`Fee: ${amountFormatter(ethers.utils.bigNumberify(order.fee), 18, 6)}`} ETH</p>
      <Button className="cta" disabled={canceling} onClick={() => onCancel(order, pending)}>
        {canceling ? 'Cancelling ...' : t('cancel')}
      </Button>
    </Order>
  )
}
