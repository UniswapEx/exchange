import React, { useState, useReducer, useEffect } from 'react'
import ReactGA from 'react-ga'

import { useTranslation } from 'react-i18next'
import { useWeb3React } from '@web3-react/core'
import * as ls from 'local-storage'
import { darken } from 'polished'

import { isAddress, getEtherscanLink } from '../../utils'

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
import { useTokenDetails } from '../../contexts/Tokens'
import {
  ACTION_PLACE_ORDER,
  ACTION_CANCEL_ORDER,
  useAllPendingOrders,
  useTransactionAdder,
  useOrderPendingState,
  useAllPendingCancelOrders
} from '../../contexts/Transactions'
import { useAddressBalance } from '../../contexts/Balances'
import { useFetchAllBalances } from '../../contexts/AllBalances'
import { useAddressAllowance } from '../../contexts/Allowances'
import { useTradeExactIn } from '../../hooks/trade'
import { LIMIT_ORDER_MODULE_ADDRESSES, ORDER_GRAPH, MULTICALL_ADDRESS } from '../../constants'
import { aggregate } from '@makerdao/multicall'

import './ExchangePage.css'

// Use to detach input from output
let inputValue

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

const Spacer = styled.div`
  flex: 1 1 auto;
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

const CancelButton = styled.div`
  color: ${({ selected, theme }) => (selected ? theme.textColor : theme.textColor)};
  padding: 0px 6px 0px 6px;
  font-size: 0.85rem;
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
  border: ${({ theme }) => `1px solid ${theme.mercuryGray}`};
  background-color: ${({ theme }) => theme.concreteGray};
`

const SpinnerWrapper = styled(Spinner)`
  margin: 0 0.25rem 0 0.25rem;
`

// ///
// Local storage
// ///
const LS_ORDERS = 'orders_'

function lsKey(key, account, chainId) {
  return key + account.toString() + chainId
}

function saveOrder(account, orderData, chainId) {
  if (!account) return

  const key = lsKey(LS_ORDERS, account, chainId)
  const prev = ls.get(key)

  if (prev === null) {
    ls.set(key, [orderData])
  } else {
    if (prev.indexOf(orderData) === -1) {
      prev.push(orderData)
      ls.set(key, prev)
    }
  }
}

function getSavedOrders(account, chainId) {
  if (!account) return []

  console.log("Loading saved orders from storage location", account, lsKey(LS_ORDERS, account, chainId))
  const raw = ls.get(lsKey(LS_ORDERS, account, chainId))
  return raw == null ? [] : raw
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

async function fetchUserOrders(account, chainId) {
  const query = `
  query GetOrdersByOwner($owner: String) {
    orders(where:{owner:$owner,status:open}) {
      id
      owner
      module
      fromToken
      toToken
      amount
      minReturn
      witness
      secret
      status
    }
  }`

  const res = await fetch(ORDER_GRAPH[chainId], {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables: { owner: account.toLowerCase() } })
  }).catch(console.error)

  const { data } = await res.json()

  return {
    allOrders: [],
    openOrders: data.orders
  }
}

function useGraphOrders(account, chainId) {
  const [state, setState] = useState({ openOrders: [], allOrders: [] })

  useEffect(() => {
    console.log(`Requesting load orders from the graph`)
    if (account && isAddress(account)) {
      fetchUserOrders(account, chainId).then(orders => {
        console.log(`Fetched ${orders.allOrders.length} ${orders.openOrders.length} orders from the graph`)
        setState(orders)
      })
    }
  }, [account, chainId])

  return state
}

function isEthOrder(order) {
  return order.fromToken.toLowerCase() === ETH_ADDRESS.toLowerCase()
}

function keyOfOrder(order) {
  const moduleData = ethers.utils.defaultAbiCoder.encode(
    ['address', 'uint256'],
    [order.toToken, order.minReturn]
  )

  return ethers.utils.keccak256(
    ethers.utils.defaultAbiCoder.encode(
      ['address', 'address', 'address', 'address', 'bytes'],
      [order.module, order.fromToken, order.owner, order.witness, moduleData]
    )
  )
}

function vaultForOrder(order, uniswapEXContract) {
  const VAULT_CODE_HASH = '0xfa3da1081bc86587310fce8f3a5309785fc567b9b20875900cb289302d6bfa97'
  const hash = ethers.utils.keccak256(
    ethers.utils.solidityPack(
      ['bytes1', 'address', 'bytes32', 'bytes32'],
      ['0xff', uniswapEXContract.address, keyOfOrder(order), VAULT_CODE_HASH]
    )
  )

  return `0x${hash.slice(-40)}`
}

async function balancesOfOrders(orders, uniswapEXContract, chainId) {
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
    {
      multicallAddress: MULTICALL_ADDRESS[chainId],
      rpcUrl: process.env.REACT_APP_NETWORK_URL
    }
  )

  return result.results
}

function useSavedOrders(account, chainId, uniswapEXContract, deps = []) {
  const [state, setState] = useState({ allOrders: [], openOrders: [] })

  useEffect(() => {
    console.log(`Requesting load orders from storage`)
    if (isAddress(account)) {
      const allOrders = getSavedOrders(account, chainId)
      console.log(`Loaded ${allOrders.length} orders from local storage`)
      balancesOfOrders(allOrders, uniswapEXContract, chainId).then((amounts) => {
        allOrders.map((o, i) => (o.amount = amounts[i].toString()))
        setState ({
          allOrders: allOrders,
          openOrders: allOrders.filter(o => o.amount !== "0")
        })
      })
    }
  // eslint-disable-next-line
  }, [...deps, account, chainId, uniswapEXContract])

  return state
}

export default function ExchangePage({ initialCurrency }) {
  const { t } = useTranslation()
  const { account, library, chainId } = useWeb3React()

  // core swap state
  const [swapState, dispatchSwapState] = useReducer(swapStateReducer, initialCurrency, getInitialSwapState)

  const { independentValue, independentField, inputCurrency, outputCurrency, rateOp, inputRateValue } = swapState

  const uniswapEXContract = useUniswapExContract()

  const [inputError, setInputError] = useState()

  const loading = !account

  const pendingOrders = useAllPendingOrders()
  const pendingCancelOrders = useAllPendingCancelOrders()

  // Get locally saved orders and the graph orders
  const local = useSavedOrders(account, chainId, uniswapEXContract, [pendingOrders.length, pendingCancelOrders.length])
  const graph = useGraphOrders(account, chainId)

  // Aggregate graph and local orders, local orders have priority
  const allOrders = local.allOrders.concat(graph.allOrders.filter((o) => !(local.allOrders.find((c) => c.secret === o.secret))))
  const openOrders = local.openOrders.concat(graph.openOrders.filter((o) => !(local.allOrders.find((c) => c.secret === o.secret))))

  // Define orders to show as openOrders + pending orders
  const orders = openOrders.concat(allOrders.filter(o => pendingOrders.find((p) => p.secret === o.secret)))
  // const orders = graph.openOrders.concat(knownOrders.filter(o => o && pendingOrders.indexOf(o) !== -1))
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

  // get input allowance
  const inputAllowance = useAddressAllowance(account, inputCurrency, inputExchangeAddress)

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

  const [savedRate, setSavedRate] = useState()

  const inputValueParsed = independentField === INPUT ? independentValueParsed : inputValue
  const inputValueFormatted =
    independentField === INPUT ? independentValue : amountFormatter(inputValue, inputDecimals, Math.min(4, 18), false)

  let outputValueFormatted
  let outputValueParsed
  let rateRaw = savedRate ? ethers.utils.bigNumberify(ethers.utils.parseUnits(savedRate, 18)) : ''

  const bestTradeExactIn = useTradeExactIn(
    inputCurrency,
    independentField === INPUT ? independentValue : inputValueFormatted,
    outputCurrency
  )

  if (bestTradeExactIn) {
    inputValue = ethers.utils.bigNumberify(
      ethers.utils.parseUnits(bestTradeExactIn.inputAmount.toExact(), inputDecimals)
    )
  }

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
      outputValueParsed = bestTradeExactIn
        ? ethers.utils.parseUnits(bestTradeExactIn.outputAmount.toExact(), dependentDecimals)
        : null
      outputValueFormatted = bestTradeExactIn ? bestTradeExactIn.outputAmount.toSignificant(6) : ''
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
    if (independentField === OUTPUT || independentField === RATE) {
      return () => {
        dispatchSwapState({ type: 'UPDATE_DEPENDENT', payload: null })
      }
    }
  }, [independentField])

  const [inverted, setInverted] = useState(false)

  const marketRate = getExchangeRate(
    inputValueParsed,
    inputDecimals,
    bestTradeExactIn ? ethers.utils.parseUnits(bestTradeExactIn.outputAmount.toExact(), outputDecimals) : null,
    outputDecimals,
    rateOp === RATE_OP_DIV
  )

  const exchangeRate = marketRate
  const exchangeRateInverted = flipRate(exchangeRate)

  const rateDelta = exchangeRateDiff(rateOp === RATE_OP_DIV ? inverseRate : rateRaw, exchangeRate)
  const limitSlippage = ethers.utils
    .bigNumberify(SLIPPAGE_WARNING)
    .mul(ethers.utils.bigNumberify(10).pow(ethers.utils.bigNumberify(16)))
  const highSlippageWarning = rateDelta && rateDelta.lt(ethers.utils.bigNumberify(0).sub(limitSlippage))
  const rateDeltaFormatted = amountFormatter(rateDelta, 16, 2, true)

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
      // Prefix Hex for secret message
      // this secret it's only intended for avoiding relayer front-running
      // so a decreased entropy it's not an issue
      const secret = ethers.utils.hexlify(ethers.utils.randomBytes(13)).replace('0x', '')
      const fullSecret = `20756e697377617065782e696f2020d83ddc09${secret}`
      const { privateKey, address } = new ethers.Wallet(fullSecret)
      const abiCoder = new ethers.utils.AbiCoder()
      data = await (swapType === ETH_TO_TOKEN
        ? method(
            LIMIT_ORDER_MODULE_ADDRESSES[chainId],
            fromCurrency,
            account,
            address,
            abiCoder.encode(['address', 'uint256'], [toCurrency, minimumReturn]),
            privateKey
          )
        : method(
            LIMIT_ORDER_MODULE_ADDRESSES[chainId],
            fromCurrency,
            account,
            address,
            abiCoder.encode(['address', 'uint256'], [toCurrency, minimumReturn]),
            privateKey,
            amount
          ))

      // const order = swapType === ETH_TO_TOKEN ? data : `0x${data.slice(267)}`
      const order = {
        amount: amount.toString(),
        creationAmount: amount.toString(),
        fromToken: fromCurrency.toLowerCase(),
        id: "???",
        minReturn: minimumReturn.toString(),
        module: LIMIT_ORDER_MODULE_ADDRESSES[chainId].toLowerCase(),
        owner: account.toLowerCase(),
        secret: privateKey,
        status: "open",
        toToken: toCurrency.toLowerCase(),
        witness: address.toLowerCase()
      }

      saveOrder(account, order, chainId)

      let res
      if (swapType === ETH_TO_TOKEN) {
        res = await uniswapEXContract.depositEth(data, { value: amount })
      } else {
        const provider = new ethers.providers.Web3Provider(library.provider)
        res = await provider.getSigner().sendTransaction(
          {
            to: fromCurrency,
            data: data
          }
        )
      }

      if (res.hash) {
        addTransaction(res, { action: ACTION_PLACE_ORDER, order: order })
      }
    } catch (e) {
      console.log("Error on place order", e.message)
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
          dispatchSwapState({ type: 'UPDATE_INDEPENDENT', payload: { value: inputValueFormatted, field: INPUT } })
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
          disabled={!account || !isValid || customSlippageError === 'invalid'}
          onClick={onPlace}
          warning={highSlippageWarning || customSlippageError === 'warning'}
        >
          {customSlippageError === 'warning' ? t('placeAnyway') : t('place')}
        </Button>
      </Flex>
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
      <div>
        {account && <>
          <p className="orders-title">{`${t('Orders')} ${orders.length > 0 ? `(${orders.length})` : ''}`}</p>
          {loading && (
            <>
              <SpinnerWrapper src={Circle} alt="loader" /> Loading ...
              <br />
              <br />
            </>
          )}
          {orders.length === 0 && !loading && <p>{t('noOpenOrders')}</p>}
          {
            <div>
              {orders.map(order => (
                <OrderCard key={order.witness} data={{ order: order }} />
              ))}
            </div>
          }
          </>
        }
      </div>
    </>
  )
}

function OrderCard(props) {
  const { t } = useTranslation()
  const { chainId } = useWeb3React()

  const order = props.data.order

  const fromToken = order.fromToken === ETH_ADDRESS.toLowerCase() ? 'ETH' : order.fromToken
  const toToken = order.toToken === ETH_ADDRESS.toLowerCase() ? 'ETH' : order.toToken

  const { symbol: fromSymbol, decimals: fromDecimals } = useTokenDetails(fromToken)
  const { symbol: toSymbol, decimals: toDecimals } = useTokenDetails(toToken)
  const { state, last } = useOrderPendingState(order)

  const canceling = state === ACTION_CANCEL_ORDER
  const pending = state === ACTION_PLACE_ORDER

  const uniswapEXContract = useUniswapExContract()
  const addTransaction = useTransactionAdder()

  async function onCancel(order, pending) {
    const abiCoder = new ethers.utils.AbiCoder()

    const { module, fromToken, toToken, minReturn, owner, witness } = order
    uniswapEXContract
      .cancelOrder(module, fromToken, owner, witness, abiCoder.encode(['address', 'uint256'], [toToken, minReturn]), {
        gasLimit: pending ? 400000 : undefined
      })
      .then(response => {
        addTransaction(response, { action: ACTION_CANCEL_ORDER, order: order })
      })
  }

  const explorerLink = last ? getEtherscanLink(chainId, last.response.hash, 'transaction') : undefined
  const amount = order.amount !== "0" ? order.amount : order.creationAmount

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
        <Spacer/>
        <CurrencySelect selected={true} disabled={canceling} onClick={() => onCancel(order, pending)}>
          <CancelButton>
            {canceling ? 'Cancelling ...' : t('cancel')}
          </CancelButton>
        </CurrencySelect>
      </div>
      <p>
        {`Amount: ${amountFormatter(ethers.utils.bigNumberify(amount), fromDecimals, 6)}`} {fromSymbol}
      </p>
      <p>
        {`Min return: ${amountFormatter(ethers.utils.bigNumberify(order.minReturn), toDecimals, 6)}`} {toSymbol}
      </p>
      <p>
        { last && <a rel="noopener noreferrer" target="_blank" href={explorerLink}>Pending transaction...</a> }
      </p>
    </Order>
  )
}
