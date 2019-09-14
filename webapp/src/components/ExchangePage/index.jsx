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

const INPUT = 0
const OUTPUT = 1

const ETH_TO_TOKEN = 0
const TOKEN_TO_ETH = 1
const TOKEN_TO_TOKEN = 2

// Denominated in bips
const ALLOWED_SLIPPAGE_DEFAULT = 100
const TOKEN_ALLOWED_SLIPPAGE_DEFAULT = 100

// Addresses
const ETH_ADDRESS = '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE'

// Bytes
const TRANSFER_TX_LENGTH = 138
const TX_PADDED_BYTES_BOILERPLATE = 128

// Contract
const CONTRACT_DEPLOYED_BLOCK = 8439826
const TRANSFER_SELECTOR = '0xa9059cbb'
const BALANCE_SELECTOR = '0x70a08231'
const DEPOSIT_ORDER_EVENT_TOPIC0 = '0x294738b98bcebacf616fd72532d3d8d8d229807bf03b68b25681bfbbdb3d3fe5'

// Order fee
const ORDER_FEE = '11600000000290000' // 0,0116 ETH

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
  color: ${({ theme, active }) => (active ? theme.royalGreen : theme.chaliceGray)};
  width: 0.625rem;
  height: 0.625rem;
  position: relative;
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

function calculateSlippageBounds(value, token = false, tokenAllowedSlippage, allowedSlippage) {
  if (value) {
    const offset = value.mul(token ? tokenAllowedSlippage : allowedSlippage).div(ethers.utils.bigNumberify(10000))
    const minimum = value.sub(offset)
    const maximum = value.add(offset)
    return {
      minimum: minimum.lt(ethers.constants.Zero) ? ethers.constants.Zero : minimum,
      maximum: maximum.gt(ethers.constants.MaxUint256) ? ethers.constants.MaxUint256 : maximum
    }
  } else {
    return {}
  }
}

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
    inputCurrency: 'ETH',
    outputCurrency: outputCurrency ? outputCurrency : ''
  }
}

function swapStateReducer(state, action) {
  switch (action.type) {
    case 'FLIP_INDEPENDENT': {
      const { independentField, inputCurrency, outputCurrency } = state
      return {
        ...state,
        dependentValue: '',
        independentField: independentField === INPUT ? OUTPUT : INPUT,
        inputCurrency: outputCurrency,
        outputCurrency: inputCurrency
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
      const { dependentValue, independentValue } = state

      return {
        ...state,
        independentValue: value,
        dependentValue: Number(value) === Number(independentValue) ? dependentValue : '',
        independentField: field
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
    const ordersAdded = {} // Used to remove deplicated or old (cancelled/executed) orders
    try {
      const [transfers, deposits] = await Promise.all([
        fetch(
          `http://api.etherscan.io/api?module=account&action=txlist&address=${account}&startblock=${CONTRACT_DEPLOYED_BLOCK}&sort=asc&apikey=`
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
          if (result && result.input.indexOf(TRANSFER_SELECTOR) !== -1 && result.input.length > TRANSFER_TX_LENGTH) {
            const orderData = `0x${result.input.substr(
              TRANSFER_TX_LENGTH + TX_PADDED_BYTES_BOILERPLATE,
              result.input.length
            )}`
            const order = await decodeOrder(uniswapEXContract, orderData)
            if (!order) {
              continue
            }
            const vault = await uniswapEXContract.vaultOfOrder(...Object.values(order))
            const amount = await new Promise(res =>
              window.web3.eth.call(
                {
                  to: order.fromToken,
                  data: `${BALANCE_SELECTOR}000000000000000000000000${vault.replace('0x', '')}`
                },
                (error, amount) => {
                  if (error) {
                    throw new Error(error)
                  }
                  res(amount)
                }
              )
            )
            if (order && !ordersAdded[orderData]) {
              orders.push({ ...order, amount })
              ordersAdded[orderData] = true
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
            const orderData = `0x${data.substr(bytesBoilerplate + TX_PADDED_BYTES_BOILERPLATE, data.length)}`
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
}

async function decodeOrder(uniswapEXContract, data) {
  const { fromToken, toToken, minReturn, fee, owner, salt } = await uniswapEXContract.decodeOrder(data)
  const existOrder = await uniswapEXContract.existOrder(fromToken, toToken, minReturn, fee, owner, salt)
  if (existOrder) {
    return { fromToken, toToken, minReturn, fee, owner, salt }
  }
}

export default function ExchangePage({ initialCurrency, sending }) {
  const { t } = useTranslation()
  const { account } = useWeb3Context()
  // core swap state
  const [swapState, dispatchSwapState] = useReducer(swapStateReducer, initialCurrency, getInitialSwapState)

  const { independentValue, dependentValue, independentField, inputCurrency, outputCurrency } = swapState

  const uniswapEXContract = useUniswapExContract()
  const [inputError, setInputError] = useState()

  if (!hasFetchedOrders) {
    fetchUserOrders(account, uniswapEXContract, setInputError)
  }
  const addTransaction = useTransactionAdder()

  const [rawSlippage] = useState(ALLOWED_SLIPPAGE_DEFAULT)
  const [rawTokenSlippage] = useState(TOKEN_ALLOWED_SLIPPAGE_DEFAULT)

  const allowedSlippageBig = ethers.utils.bigNumberify(rawSlippage)
  const tokenAllowedSlippageBig = ethers.utils.bigNumberify(rawTokenSlippage)

  // analytics
  useEffect(() => {
    ReactGA.pageview(window.location.pathname + window.location.search)
  }, [])

  const [recipientError] = useState()

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
  const inputValueParsed = independentField === INPUT ? independentValueParsed : dependentValue
  const inputValueFormatted = independentField === INPUT ? independentValue : dependentValueFormatted
  const outputValueParsed = independentField === OUTPUT ? independentValueParsed : dependentValue
  const outputValueFormatted = independentField === OUTPUT ? independentValue : dependentValueFormatted

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

  // calculate slippage from target rate
  const { maximum: dependentValueMaximum } = calculateSlippageBounds(
    dependentValue,
    swapType === TOKEN_TO_TOKEN,
    tokenAllowedSlippageBig,
    allowedSlippageBig
  )

  // validate input allowance + balance
  const [showUnlock, setShowUnlock] = useState(false)
  useEffect(() => {
    const inputValueCalculation = independentField === INPUT ? independentValueParsed : dependentValueMaximum
    if (inputBalance && (inputAllowance || inputCurrency === 'ETH') && inputValueCalculation) {
      // @TODO: revisit this maybe I can remove the two lines below
      setInputError(null)
      setShowUnlock(false)
      return () => {
        setInputError()
        setShowUnlock(false)
      }
    }
  }, [independentField, independentValueParsed, dependentValueMaximum, inputBalance, inputCurrency, inputAllowance, t])

  // calculate dependent value
  useEffect(() => {
    const amount = independentValueParsed

    if (independentField === OUTPUT) {
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
    t
  ])

  const [inverted, setInverted] = useState(false)
  const exchangeRate = getExchangeRate(inputValueParsed, inputDecimals, outputValueParsed, outputDecimals)
  const exchangeRateInverted = getExchangeRate(inputValueParsed, inputDecimals, outputValueParsed, outputDecimals, true)

  const marketRate = getMarketRate(
    swapType,
    inputReserveETH,
    inputReserveToken,
    inputDecimals,
    outputReserveETH,
    outputReserveToken,
    outputDecimals
  )

  const percentSlippage =
    exchangeRate && marketRate
      ? exchangeRate
          .sub(marketRate)
          .abs()
          .mul(ethers.utils.bigNumberify(10).pow(ethers.utils.bigNumberify(18)))
          .div(marketRate)
          .sub(ethers.utils.bigNumberify(3).mul(ethers.utils.bigNumberify(10).pow(ethers.utils.bigNumberify(15))))
      : undefined

  const highSlippageWarning = percentSlippage && percentSlippage.gte(ethers.utils.parseEther('.2')) // [20+%

  const isValid = sending
    ? exchangeRate && inputError === null && independentError === null && recipientError === null
    : exchangeRate && inputError === null && independentError === null

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

    if (independentField === INPUT) {
      amount = independentValueParsed
      minimumReturn = dependentValue
    } else if (independentField === OUTPUT) {
      amount = dependentValue
      minimumReturn = independentValueParsed
    }

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
      data = await (swapType === ETH_TO_TOKEN
        ? method(
            fromCurrency,
            toCurrency,
            minimumReturn,
            ORDER_FEE,
            account,
            ethers.utils.bigNumberify(ethers.utils.randomBytes(32))
          )
        : await method(
            fromCurrency,
            toCurrency,
            amount,
            minimumReturn,
            ORDER_FEE,
            account,
            ethers.utils.bigNumberify(ethers.utils.randomBytes(32))
          ))
      const res = await (swapType === ETH_TO_TOKEN
        ? uniswapEXContract.depositEth(data, { value: amount })
        : new Promise(res =>
            window.web3.eth.sendTransaction(
              {
                from: account,
                to: fromCurrency,
                data
              },
              (err, hash) => {
                if (err) {
                  throw new Error(err)
                }
                res({ hash })
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
    const { fromToken, toToken, minReturn, fee, owner, salt } = order
    const tx = await uniswapEXContract.cancelOrder(fromToken, toToken, minReturn, fee, owner, salt)
    addTransaction(tx)
  }

  const [customSlippageError] = useState('')

  const allBalances = useFetchAllBalances()

  return (
    <>
      <CurrencyInputPanel
        title={t('input')}
        allBalances={allBalances}
        description={inputValueFormatted && independentField === OUTPUT ? estimatedText : ''}
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
        description={outputValueFormatted && independentField === INPUT ? estimatedText : ''}
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
          disabled={!isValid || customSlippageError === 'invalid'}
          onClick={onPlace}
          warning={highSlippageWarning || customSlippageError === 'warning'}
        >
          {highSlippageWarning || customSlippageError === 'warning' ? t('placeAnyway') : t('place')}
        </Button>
      </Flex>
      <div>
        <h2>{`${t('Orders')} ${orders.length > 0 ? `(${orders.length})` : ''}`}</h2>
        {isFetchingOrders ? (
          <SpinnerWrapper src={Circle} alt="loader" />
        ) : orders.length === 0 ? (
          <p>{t('noOpenOrders')}</p>
        ) : (
          <div>
            {orders.map((order, index) => {
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
                  <p>{`Amount: ${parseFloat(Number(ethers.utils.formatUnits(order.amount, 18)).toFixed(4))}`}</p>
                  <p>{`Min return: ${parseFloat(Number(ethers.utils.formatUnits(order.minReturn, 18)).toFixed(4))}`}</p>
                  <p>{`Fee: ${parseFloat(Number(ethers.utils.formatUnits(order.fee, 18)).toFixed(4))}`}</p>
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
