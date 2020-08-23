import React, { createContext, useContext, useReducer, useMemo, useCallback, useEffect } from 'react'
import { useWeb3React } from '@web3-react/core'

import { safeAccess, isAddress, getTokenAllowance } from '../utils'
import { useBlockNumber } from './Application'

const UPDATE = 'UPDATE'

const AllowancesContext = createContext()

function useAllowancesContext() {
  return useContext(AllowancesContext)
}

function reducer(state, { type, payload }) {
  switch (type) {
    case UPDATE: {
      const { chainId, address, tokenAddress, spenderAddress, value, blockNumber } = payload
      return {
        ...state,
        [chainId]: {
          ...(safeAccess(state, [chainId]) || {}),
          [address]: {
            ...(safeAccess(state, [chainId, address]) || {}),
            [tokenAddress]: {
              ...(safeAccess(state, [chainId, address, tokenAddress]) || {}),
              [spenderAddress]: {
                value,
                blockNumber
              }
            }
          }
        }
      }
    }
    default: {
      throw Error(`Unexpected action type in AllowancesContext reducer: '${type}'.`)
    }
  }
}

export default function Provider({ children }) {
  const [state, dispatch] = useReducer(reducer, {})

  const update = useCallback((chainId, address, tokenAddress, spenderAddress, value, blockNumber) => {
    dispatch({ type: UPDATE, payload: { chainId, address, tokenAddress, spenderAddress, value, blockNumber } })
  }, [])

  return (
    <AllowancesContext.Provider value={useMemo(() => [state, { update }], [state, update])}>
      {children}
    </AllowancesContext.Provider>
  )
}

export function useAddressAllowance(address, tokenAddress, spenderAddress) {
  const { chainId, library } = useWeb3React()

  const globalBlockNumber = useBlockNumber()

  const [state, { update }] = useAllowancesContext()
  const { value, blockNumber } = safeAccess(state, [chainId, address, tokenAddress, spenderAddress]) || {}

  useEffect(() => {
    if (
      isAddress(address) &&
      isAddress(tokenAddress) &&
      isAddress(spenderAddress) &&
      (value === undefined || blockNumber !== globalBlockNumber) &&
      (chainId || chainId === 0) &&
      library
    ) {
      let stale = false

      getTokenAllowance(address, tokenAddress, spenderAddress, library)
        .then(value => {
          if (!stale) {
            update(chainId, address, tokenAddress, spenderAddress, value, globalBlockNumber)
          }
        })
        .catch(() => {
          if (!stale) {
            update(chainId, address, tokenAddress, spenderAddress, null, globalBlockNumber)
          }
        })

      return () => {
        stale = true
      }
    }
  }, [address, tokenAddress, spenderAddress, value, blockNumber, globalBlockNumber, chainId, library, update])

  return value
}
