import React, { useState, useReducer, useEffect } from 'react'
import ReactGA from 'react-ga'

import { useTranslation } from 'react-i18next'
import { useWeb3Context } from 'web3-react'

import { ethers } from 'ethers'
import styled from 'styled-components'

import { Button } from '../../theme'
import CurrencyInputPanel, { CurrencySelect, Aligner, StyledTokenName } from '../CurrencyInputPanel'
import OversizedPanel from '../OversizedPanel'
import TokenLogo from '../TokenLogo'
import ArrowDown from '../../assets/svg/SVGArrowDown'
import Circle from '../../assets/images/circle.svg'
import SVGClose from '../../assets/svg/SVGClose'
import SVGDiv from '../../assets/svg/SVGDiv'
import { amountFormatter } from '../../utils'
import { useUniswapExContract } from '../../hooks'
import { Spinner } from '../../theme'
import { useTokenDetails, useAllTokenDetails } from '../../contexts/Tokens'
import { useTransactionAdder } from '../../contexts/Transactions'
import { useAddressBalance, useExchangeReserves } from '../../contexts/Balances'
import { useFetchAllBalances } from '../../contexts/AllBalances'
import { useAddressAllowance } from '../../contexts/Allowances'

import './ExchangePage.css'

// Use to detach input from output
let inputValue
let isFetchingOrders = true
let hasFetchedOrders
let orders = []
const ordersAdded = {}

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

// Bytes
const ORDER_BYTES_LENGTH = 448
const TRANSFER_TX_LENGTH= 136
const TX_PADDED_BYTES_BOILERPLATE = 128

// Contract
const CONTRACT_DEPLOYED_BLOCK = 8579313
const TRANSFER_SELECTOR = 'a9059cbb'
const BALANCE_SELECTOR = '0x70a08231'
const DEPOSIT_ORDER_EVENT_TOPIC0 = '0x294738b98bcebacf616fd72532d3d8d8d229807bf03b68b25681bfbbdb3d3fe5'

// Order fee
const ORDER_FEE = '6000000000000000' // 0,006 ETH

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

async function fetchUserOrders(account, uniswapEXContract, setInputError) {
  // @TODO: move this to "useFetchUserOrders"
  hasFetchedOrders = true
  if (account) {
    try {
      const [transfers, deposits] = await Promise.all([
        fetch(
          `https://api.etherscan.io/api?module=account&action=txlist&address=${account}&startblock=${CONTRACT_DEPLOYED_BLOCK}&sort=asc&apikey=`
        ),
        fetch(
          `https://api.etherscan.io/api?module=logs&action=getLogs&fromBlock=${CONTRACT_DEPLOYED_BLOCK}&toBlock=latest&address=${uniswapEXContract.address}&topic0=${DEPOSIT_ORDER_EVENT_TOPIC0}&apikey=`
        )
      ])

      // Transfers
      const transfersResults = await transfers.json()
      if (transfersResults.message === 'OK') {
        // eslint-disable-next-line
        for (let { hash } of transfersResults.result) {
          const res = await fetch(
            `https://api.etherscan.io/api?module=proxy&action=eth_getTransactionByHash&txhash=${hash}&apikey=`
          )
          const { result } = await res.json()
          // @TODO: UAF - please change it, shame on you Nacho
          // Check if the extra data is related to an order
          const indexOfTransfer = result ? result.input.indexOf(TRANSFER_SELECTOR) : -1
          if (indexOfTransfer !== -1 && result.input.length > ORDER_BYTES_LENGTH) {
            const orderData = `0x${result.input.substr(indexOfTransfer + TRANSFER_TX_LENGTH + TX_PADDED_BYTES_BOILERPLATE, ORDER_BYTES_LENGTH)}`
            const order = await decodeOrder(uniswapEXContract, orderData)
            if (!order) {
              if (ordersAdded[orderData] >= 0) {
                delete orders[ordersAdded[orderData]]
                delete ordersAdded[orderData]
              }
              continue
            }
            const vault = await uniswapEXContract.vaultOfOrder(...Object.values(order))
            const amount = await new Promise((resolve, reject) =>
              window.web3.eth.call(
                {
                  to: order.fromToken,
                  data: `${BALANCE_SELECTOR}000000000000000000000000${vault.replace('0x', '')}`
                },
                (error, amount) => {
                  if (error) {
                    reject(error)
                  }
                  resolve(amount)
                }
              )
            )
            if (order && ordersAdded[orderData] === undefined) {
              orders.push({ ...order, amount })
              ordersAdded[orderData] = orders.length - 1
            }
          }
        }
      }

      // Deposit ETH orders
      const depositsResults = await deposits.json()
      if (depositsResults.message === 'OK') {
        // eslint-disable-next-line
        for (let { data, topics } of depositsResults.result) {
          const [, key, owner] = topics
          // Check the owner from a padded 32-bytes address
          const bytesBoilerplate = 66
          if (`0x${owner.substr(26, bytesBoilerplate).toLowerCase()}` === account.toLowerCase()) {
            const orderData = `0x${data.substr(-ORDER_BYTES_LENGTH)}`
            const order = await decodeOrder(uniswapEXContract, orderData)
            const amount = await uniswapEXContract.ethDeposits(key)
            if (order && !ordersAdded[orderData]) {
              orders.push({ ...order, amount })
              ordersAdded[orderData] = true
            }
          }
        }
      }
    } catch (e) {
      console.log(`Error when fetching open orders: ${e.message}`)
    }
  }
  isFetchingOrders = false
  setInputError(null) // Hack to update the component state, should be removed
  setTimeout(() => fetchUserOrders(account, uniswapEXContract, setInputError), 30000)
}

async function decodeOrder(uniswapEXContract, data) {
  const { fromToken, toToken, minReturn, fee, owner, witness } = await uniswapEXContract.decodeOrder(data)
  const existOrder = await uniswapEXContract.existOrder(fromToken, toToken, minReturn, fee, owner, witness)
  if (existOrder) {
    return { fromToken, toToken, minReturn, fee, owner, witness }
  }
}

function canCoverFees(swapType, value, inputReserveETH, inputReserveToken, inputDecimals) {
  if (!value || swapType === null) {
    return true
  }

  const orderFee = ethers.utils.bigNumberify(ORDER_FEE)
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

  if (!hasFetchedOrders) {
    fetchUserOrders(account, uniswapEXContract, setInputError)
  }
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

  const enoughAmountToCoverFees = canCoverFees(
    swapType,
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
    let method, fromCurrency, toCurrency, amount, minimumReturn, data

    ReactGA.event({
      category: 'place',
      action: 'place'
    })

    amount = inputValueParsed
    minimumReturn = outputValueParsed

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
      const { privateKey, address } = ethers.Wallet.createRandom({ extraEntropy: ethers.utils.randomBytes(32) })
      data = await (swapType === ETH_TO_TOKEN
        ? method(fromCurrency, toCurrency, minimumReturn, ORDER_FEE, account, privateKey, address)
        : await method(fromCurrency, toCurrency, amount, minimumReturn, ORDER_FEE, account, privateKey, address))
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
        addTransaction(res)
      }
    } catch (e) {
      console.log(e.message)
    }
  }

  async function onCancel(order) {
    const { fromToken, toToken, minReturn, fee, owner, witness } = order
    uniswapEXContract.cancelOrder(fromToken, toToken, minReturn, fee, owner, witness).then(response => {
      addTransaction(response)
    })
  }

  const [customSlippageError] = useState('')

  const allBalances = useFetchAllBalances()
  const filteredOrders = orders.filter(Boolean) // Remove empty/cancelled orders

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
      <Flex>
        <Button
          disabled={!account || !isValid || customSlippageError === 'invalid' || !enoughAmountToCoverFees}
          onClick={onPlace}
          warning={highSlippageWarning || customSlippageError === 'warning' || !enoughAmountToCoverFees}
        >
          {customSlippageError === 'warning' ? t('placeAnyway') : t('place')}
        </Button>
      </Flex>
      { !account && <div className="fee-error">{t('noWallet')} </div>}
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
          {t('enoughAmountToCoverFees', { fee: ORDER_FEE / 1e18 })} <TokenLogo address={'ETH'} />
        </div>
      )}
      <div>
        <p className="orders-title">{`${t('Orders')} ${filteredOrders.length > 0 ? `(${filteredOrders.length})` : ''}`}</p>
        {isFetchingOrders ? (
          <SpinnerWrapper src={Circle} alt="loader" />
        ) : filteredOrders.length === 0 ? (
          <p>{t('noOpenOrders')}</p>
        ) : (
          <div>
            {filteredOrders.map((order, index) => {
              const fromToken = order.fromToken === ETH_ADDRESS ? 'ETH' : order.fromToken
              const toToken = order.toToken === ETH_ADDRESS ? 'ETH' : order.toToken

              return (
                <Order key={index} className="order">
                  <div className="tokens">
                    <CurrencySelect selected={true}>
                      <Aligner>
                        {<TokenLogo address={fromToken} />}
                        {
                          <StyledTokenName>
                            {(allTokens[fromToken] && allTokens[fromToken].symbol) || fromToken}
                          </StyledTokenName>
                        }
                      </Aligner>
                    </CurrencySelect>
                    <Aligner>
                      <RightArrow transform="rotate(-90)" />
                    </Aligner>
                    <CurrencySelect selected={true}>
                      <Aligner>
                        {<TokenLogo address={toToken} />}
                        {
                          <StyledTokenName>
                            {(allTokens[toToken] && allTokens[toToken].symbol) || toToken}
                          </StyledTokenName>
                        }
                      </Aligner>
                    </CurrencySelect>
                  </div>
                  <p>
                    {`Amount: ${ethers.utils.formatUnits(order.amount, 18)}`} <TokenLogo address={fromToken} />
                  </p>
                  <p>
                    {`Min return: ${ethers.utils.formatUnits(order.minReturn, 18)}`} <TokenLogo address={toToken} />
                  </p>
                  <p>
                    {`Fee: ${ethers.utils.formatUnits(order.fee, 18)}`} <TokenLogo address={'ETH'} />
                  </p>
                  <Button className="cta" onClick={() => onCancel(order)}>
                    {t('cancel')}
                  </Button>
                </Order>
              )
            })}
          </div>
        )}
      </div>
    </>
  )
}
