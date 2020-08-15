import React, { createContext, useContext, useReducer, useMemo, useCallback } from 'react'
import { BigNumber } from '@uniswap/sdk'
import { useWeb3React } from '@web3-react/core'

import { safeAccess, isAddress, getEtherBalance, getTokenBalance } from '../utils'
import { useAllTokenDetails } from './Tokens'

const ONE = new BigNumber(1)

const UPDATE = 'UPDATE'

const AllBalancesContext = createContext()

function useAllBalancesContext() {
  return useContext(AllBalancesContext)
}

function reducer(state, { type, payload }) {
  switch (type) {
    case UPDATE: {
      const { allBalanceData, chainId, address } = payload
      return {
        ...state,
        [chainId]: {
          ...(safeAccess(state, [chainId]) || {}),
          [address]: {
            ...(safeAccess(state, [chainId, address]) || {}),
            allBalanceData
          }
        }
      }
    }
    default: {
      throw Error(`Unexpected action type in AllBalancesContext reducer: '${type}'.`)
    }
  }
}

export default function Provider({ children }) {
  const [state, dispatch] = useReducer(reducer, {})

  const update = useCallback((allBalanceData, chainId, address) => {
    dispatch({ type: UPDATE, payload: { allBalanceData, chainId, address } })
  }, [])

  return (
    <AllBalancesContext.Provider value={useMemo(() => [state, { update }], [state, update])}>
      {children}
    </AllBalancesContext.Provider>
  )
}

export function useFetchAllBalances() {
  const { account, chainId, library } = useWeb3React()

  const allTokens = useAllTokenDetails()

  const [state, { update }] = useAllBalancesContext()

  const { allBalanceData } = safeAccess(state, [chainId, account]) || {}

  const getData = async () => {
    if (!!library && !!account) {
      const newBalances = {}
      await Promise.all(
        Object.keys(allTokens).map(async k => {
          let balance = null
          let ethRate = null

          if (isAddress(k) || k === 'ETH') {
            if (k === 'ETH') {
              balance = await getEtherBalance(account, library).catch(() => null)
              ethRate = ONE
            } else {
              balance = await getTokenBalance(k, account, library).catch(e => {
                console.error(e.message)
                return null
              })
            }

            return (newBalances[k] = { balance, ethRate })
          }
        })
      )
      update(newBalances, chainId, account)
    }
  }

  useMemo(getData, [account])

  return allBalanceData
}
