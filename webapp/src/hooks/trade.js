import { Trade, TokenAmount, Pair, CurrencyAmount, Token, ETHER, WETH, JSBI } from 'uniswap-v2-sdk'
import flatMap from 'lodash.flatmap'
import { useMemo } from 'react'
import { Interface } from '@ethersproject/abi'
import { parseUnits } from '@ethersproject/units'

import { BASES_TO_CHECK_TRADES_AGAINST } from '../constants'
import PAIR_ABI from '../constants/abis/pair.json'
import { useActiveWeb3React } from './index'
import { useTokenDetails } from '../contexts/Tokens'

import { useMultipleContractSingleData } from '../state/multicall/hooks'

export const PairState = {
  LOADING: 'LOADING',
  NOT_EXISTS: 'NOT_EXISTS',
  EXISTS: 'EXISTS',
  INVALID: 'INVALID'
}

const PAIR_INTERFACE = new Interface(PAIR_ABI)

function useAllCommonPairs(currencyA, currencyB) {
  const { chainId } = useActiveWeb3React()

  const bases = chainId ? BASES_TO_CHECK_TRADES_AGAINST[chainId] : []

  const [tokenA, tokenB] = chainId
    ? [wrappedCurrency(currencyA, chainId), wrappedCurrency(currencyB, chainId)]
    : [undefined, undefined]

  const allPairCombinations = useMemo(
    () => [
      // the direct pair
      [tokenA, tokenB],
      // token A against all bases
      ...bases.map(base => [tokenA, base]),
      // token B against all bases
      ...bases.map(base => [tokenB, base]),
      // each base against all bases
      ...flatMap(bases, base => bases.map(otherBase => [base, otherBase]))
    ],
    [tokenA, tokenB, bases]
  )

  const allPairs = usePairs(allPairCombinations)

  // only pass along valid pairs, non-duplicated pairs
  return useMemo(
    () =>
      Object.values(
        allPairs
          // filter out invalid pairs
          .filter(result => Boolean(result[0] === PairState.EXISTS && result[1]))
          // filter out duplicated pairs
          .reduce((memo, [, curr]) => {
            memo[curr.liquidityToken.address] = memo[curr.liquidityToken.address]
              ? memo[curr.liquidityToken.address]
              : curr
            return memo
          }, {})
      ),
    [allPairs]
  )
}

/**
 * Returns the best trade for the exact amount of tokens in to the given token out
 */
export function useTradeExactIn(currencyAddressIn, currencyValueIn, currencyAddressOut) {
  const currencyIn = useTokenDetails(currencyAddressIn)
  const currencyOutDetail = useTokenDetails(currencyAddressOut)
  const currencyOut = currencyAddressOut
    ? currencyAddressOut === 'ETH'
      ? ETHER
      : new Token(
          currencyOutDetail.chainId,
          currencyAddressOut,
          currencyOutDetail.decimals,
          currencyOutDetail.symbol,
          currencyOutDetail.name
        )
    : undefined

  const currencyAmountIn = tryParseAmount(
    currencyValueIn,
    currencyAddressIn
      ? currencyAddressIn === 'ETH'
        ? ETHER
        : new Token(currencyIn.chainId, currencyAddressIn, currencyIn.decimals, currencyIn.symbol, currencyIn.name)
      : undefined
  )

  const allowedPairs = useAllCommonPairs(currencyAmountIn ? currencyAmountIn.currency : undefined, currencyOut)

  return useMemo(() => {
    if (currencyAmountIn && currencyOut && allowedPairs.length > 0) {
      const tradeRes = Trade.bestTradeExactIn(allowedPairs, currencyAmountIn, currencyOut, {
        maxHops: 3,
        maxNumResults: 1
      })[0]

      return tradeRes ? tradeRes : null
    }
    return null
  }, [allowedPairs, currencyAmountIn, currencyOut])
}

/**
 * Returns the best trade for the token in to the exact amount of token out
 */
export function useTradeExactOut(currencyInAddress, currentOutAddress, currencyAmountOut) {
  const allowedPairs = useAllCommonPairs(currencyIn, currencyAmountOut.currency)
  const currencyIn = useTokenDetails(currencyInAddress)

  return useMemo(() => {
    if (currencyIn && currencyAmountOut && allowedPairs.length > 0) {
      const tradeRes = Trade.bestTradeExactOut(allowedPairs, currencyIn, currencyAmountOut, {
        maxHops: 3,
        maxNumResults: 1
      })[0]
      return tradeRes ? tradeRes : null
    }
    return null
  }, [allowedPairs, currencyIn, currencyAmountOut])
}

export function usePairs(currencies) {
  const { chainId } = useActiveWeb3React()

  const tokens = useMemo(
    () =>
      currencies.map(([currencyA, currencyB]) => [
        wrappedCurrency(currencyA, chainId),
        wrappedCurrency(currencyB, chainId)
      ]),
    [chainId, currencies]
  )

  const pairAddresses = useMemo(
    () =>
      tokens.map(([tokenA, tokenB]) => {
        return tokenA && tokenB && !tokenA.equals(tokenB) ? Pair.getAddress(tokenA, tokenB) : undefined
      }),
    [tokens]
  )

  const results = useMultipleContractSingleData(pairAddresses, PAIR_INTERFACE, 'getReserves')

  return useMemo(() => {
    return results.map((result, i) => {
      const { result: reserves, loading } = result
      const tokenA = tokens[i][0]
      const tokenB = tokens[i][1]

      if (loading) return [PairState.LOADING, null]
      if (!tokenA || !tokenB || tokenA.equals(tokenB)) return [PairState.INVALID, null]
      if (!reserves) return [PairState.NOT_EXISTS, null]
      const { _reserve0, _reserve1 } = reserves

      const [token0, token1] = tokenA.sortsBefore(tokenB) ? [tokenA, tokenB] : [tokenB, tokenA]
      return [
        PairState.EXISTS,
        new Pair(new TokenAmount(token0, _reserve0.toString()), new TokenAmount(token1, _reserve1.toString()))
      ]
    })
  }, [results, tokens])
}

export function usePair(tokenA, tokenB) {
  return usePairs([[tokenA, tokenB]])[0]
}

export function wrappedCurrency(currency, chainId) {
  return chainId && currency === ETHER ? WETH[chainId] : currency instanceof Token ? currency : undefined
}

// try to parse a user entered amount for a given token
export function tryParseAmount(value, currency) {
  if (!value || !currency) {
    return
  }
  try {
    const typedValueParsed = parseUnits(value.toString(), currency.decimals).toString()
    if (typedValueParsed !== '0') {
      return currency instanceof Token
        ? new TokenAmount(currency, JSBI.BigInt(typedValueParsed))
        : CurrencyAmount.ether(JSBI.BigInt(typedValueParsed))
    }
  } catch (error) {
    // should fail if the user specifies too many decimal places of precision (or maybe exceed max uint?)
    console.error(`Failed to parse input amount: "${value}"`, error)
  }
  // necessary for all paths to return a value
  return
}
