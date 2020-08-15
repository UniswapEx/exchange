import React, { createContext, useContext, useReducer, useMemo, useCallback, useEffect } from 'react'
import { useWeb3React } from '@web3-react/core'
import { ChainId } from 'uniswap-v2-sdk'

import { isAddress, getTokenName, getTokenSymbol, getTokenDecimals, safeAccess } from '../utils'

const NAME = 'name'
const SYMBOL = 'symbol'
const DECIMALS = 'decimals'
const EXCHANGE_ADDRESS = 'exchangeAddress'

// the Uniswap Default token list lives here
export const DEFAULT_TOKEN_LIST_URL = 'https://unpkg.com/@uniswap/default-token-list@latest'

const UPDATE = 'UPDATE'
const SET_LIST = 'SET_LIST'

const ETH = {
  ETH: {
    [NAME]: 'Ethereum',
    [SYMBOL]: 'ETH',
    [DECIMALS]: 18,
    [EXCHANGE_ADDRESS]: null
  }
}

export const WETH = {
  1: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
  3: '0xc778417e063141139fce010982780140aa0cd5ab'
}

const EMPTY_LIST = {
  [ChainId.KOVAN]: {},
  [ChainId.RINKEBY]: {},
  [ChainId.ROPSTEN]: {},
  [ChainId.GÖRLI]: {},
  [ChainId.MAINNET]: {}
}

const TokensContext = createContext()

function useTokensContext() {
  return useContext(TokensContext)
}

function reducer(state, { type, payload }) {
  switch (type) {
    case UPDATE: {
      const { chainId, tokenAddress, name, symbol, decimals } = payload
      return {
        ...state,
        [chainId]: {
          ...(safeAccess(state, [chainId]) || {}),
          [tokenAddress]: {
            [NAME]: name,
            [SYMBOL]: symbol,
            [DECIMALS]: decimals
          }
        }
      }
    }
    case SET_LIST: {
      return payload
    }
    default: {
      throw Error(`Unexpected action type in TokensContext reducer: '${type}'.`)
    }
  }
}

export default function Provider({ children }) {
  const [state, dispatch] = useReducer(reducer, EMPTY_LIST)

  useEffect(() => {
    fetch(DEFAULT_TOKEN_LIST_URL)
      .then(res =>
        res.json().then(list => {
          const tokenList = list.tokens.reduce(
            (tokenMap, token) => {
              if (tokenMap[token.chainId][token.address] !== undefined) throw Error('Duplicate tokens.')
              return {
                ...tokenMap,
                [token.chainId]: {
                  ...tokenMap[token.chainId],
                  [token.address]: token
                }
              }
            },
            { ...EMPTY_LIST }
          )
          dispatch({ type: SET_LIST, payload: tokenList })
        })
      )
      .catch(e => console.error(e.message))
  }, [])

  const update = useCallback((chainId, tokenAddress, name, symbol, decimals) => {
    dispatch({ type: UPDATE, payload: { chainId, tokenAddress, name, symbol, decimals } })
  }, [])

  return (
    <TokensContext.Provider value={useMemo(() => [state, { update }], [state, update])}>
      {children}
    </TokensContext.Provider>
  )
}

export function useTokenDetails(tokenAddress) {
  const { chainId, library } = useWeb3React()

  const [state, { update }] = useTokensContext()
  const allTokensInNetwork = { ...ETH, ...(safeAccess(state, [chainId]) || {}) }
  const { [NAME]: name, [SYMBOL]: symbol, [DECIMALS]: decimals } = safeAccess(allTokensInNetwork, [tokenAddress]) || {}

  useEffect(() => {
    if (
      isAddress(tokenAddress) &&
      (name === undefined || symbol === undefined || decimals === undefined) &&
      (chainId || chainId === 0) &&
      library
    ) {
      let stale = false

      const namePromise = getTokenName(tokenAddress, library).catch(() => null)
      const symbolPromise = getTokenSymbol(tokenAddress, library).catch(() => null)
      const decimalsPromise = getTokenDecimals(tokenAddress, library).catch(() => null)

      Promise.all([namePromise, symbolPromise, decimalsPromise]).then(
        ([resolvedName, resolvedSymbol, resolvedDecimals]) => {
          if (!stale) {
            update(chainId, tokenAddress, resolvedName, resolvedSymbol, resolvedDecimals)
          }
        }
      )
      return () => {
        stale = true
      }
    }
  }, [tokenAddress, name, symbol, decimals, chainId, library, update])

  return { name, symbol, decimals, chainId }
}

export function useAllTokenDetails(r) {
  const { chainId } = useWeb3React()

  const [state] = useTokensContext()
  const tokenDetails = { ...ETH, ...(safeAccess(state, [chainId]) || {}) }

  return tokenDetails
}
