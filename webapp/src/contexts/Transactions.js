import React, { createContext, useContext, useReducer, useMemo, useCallback, useEffect } from 'react'
import { useWeb3React } from '@web3-react/core'

import { safeAccess } from '../utils'
import { useBlockNumber } from './Application'

const RESPONSE = 'response'
const CUSTOM_DATA = 'CUSTOM_DATA'
const BLOCK_NUMBER_CHECKED = 'BLOCK_NUMBER_CHECKED'
const RECEIPT = 'receipt'

const ADD = 'ADD'
const CHECK = 'CHECK'
const FINALIZE = 'FINALIZE'

const TransactionsContext = createContext()

export function useTransactionsContext() {
  return useContext(TransactionsContext)
}

function reducer(state, { type, payload }) {
  switch (type) {
    case ADD: {
      const { chainId, hash, response } = payload
      if (safeAccess(state, [chainId, hash]) !== null) {
        return state
      }

      return {
        ...state,
        [chainId]: {
          ...(safeAccess(state, [chainId]) || {}),
          [hash]: {
            [RESPONSE]: response
          }
        }
      }
    }
    case CHECK: {
      const { chainId, hash, blockNumber } = payload

      if (safeAccess(state, [chainId, hash]) === null) {
        throw Error('Attempted to check non-existent transaction.')
      }

      return {
        ...state,
        [chainId]: {
          ...(safeAccess(state, [chainId]) || {}),
          [hash]: {
            ...(safeAccess(state, [chainId, hash]) || {}),
            [BLOCK_NUMBER_CHECKED]: blockNumber
          }
        }
      }
    }
    case FINALIZE: {
      const { chainId, hash, receipt } = payload

      if (safeAccess(state, [chainId, hash]) === null) {
        throw Error('Attempted to finalize non-existent transaction.')
      }

      return {
        ...state,
        [chainId]: {
          ...(safeAccess(state, [chainId]) || {}),
          [hash]: {
            ...(safeAccess(state, [chainId, hash]) || {}),
            [RECEIPT]: receipt
          }
        }
      }
    }
    default: {
      throw Error(`Unexpected action type in TransactionsContext reducer: '${type}'.`)
    }
  }
}

export default function Provider({ children }) {
  const [state, dispatch] = useReducer(reducer, {})

  const add = useCallback((chainId, hash, response) => {
    dispatch({ type: ADD, payload: { chainId, hash, response } })
  }, [])
  const check = useCallback((chainId, hash, blockNumber) => {
    dispatch({ type: CHECK, payload: { chainId, hash, blockNumber } })
  }, [])
  const finalize = useCallback((chainId, hash, receipt) => {
    dispatch({ type: FINALIZE, payload: { chainId, hash, receipt } })
  }, [])

  return (
    <TransactionsContext.Provider
      value={useMemo(() => [state, { add, check, finalize }], [state, add, check, finalize])}
    >
      {children}
    </TransactionsContext.Provider>
  )
}

export function Updater() {
  const { chainId, library } = useWeb3React()

  const globalBlockNumber = useBlockNumber()

  const [state, { check, finalize }] = useTransactionsContext()
  const allTransactions = safeAccess(state, [chainId]) || {}

  useEffect(() => {
    if ((chainId || chainId === 0) && library) {
      let stale = false
      Object.keys(allTransactions)
        .filter(
          hash => !allTransactions[hash][RECEIPT] && allTransactions[hash][BLOCK_NUMBER_CHECKED] !== globalBlockNumber
        )
        .forEach(hash => {
          library
            .getTransactionReceipt(hash)
            .then(receipt => {
              if (!stale) {
                if (!receipt) {
                  check(chainId, hash, globalBlockNumber)
                } else {
                  finalize(chainId, hash, receipt)
                }
              }
            })
            .catch(() => {
              check(chainId, hash, globalBlockNumber)
            })
        })

      return () => {
        stale = true
      }
    }
  }, [chainId, library, allTransactions, globalBlockNumber, check, finalize])

  return null
}

export function useTransactionAdder() {
  const { chainId } = useWeb3React()

  const [, { add }] = useTransactionsContext()

  return useCallback(
    (response, customData = {}) => {
      if (!(chainId || chainId === 0)) {
        throw Error(`Invalid chainId '${chainId}`)
      }

      const hash = safeAccess(response, ['hash'])

      if (!hash) {
        throw Error('No transaction hash found.')
      }
      add(chainId, hash, { ...response, [CUSTOM_DATA]: customData })
    },
    [chainId, add]
  )
}

export function useAllTransactions() {
  const { chainId } = useWeb3React()

  const [state] = useTransactionsContext()

  return safeAccess(state, [chainId]) || {}
}

export function usePendingApproval(tokenAddress) {
  const allTransactions = useAllTransactions()

  return (
    Object.keys(allTransactions).filter(hash => {
      if (allTransactions[hash][RECEIPT]) {
        return false
      } else if (!allTransactions[hash][RESPONSE]) {
        return false
      } else if (allTransactions[hash][RESPONSE][CUSTOM_DATA].approval !== tokenAddress) {
        return false
      } else {
        return true
      }
    }).length >= 1
  )
}

export const ACTION_PLACE_ORDER = 0
export const ACTION_CANCEL_ORDER = 1

export const ORDER_NOT_PENDING = -1

export function useOrderPendingState(order) {
  const allTransactions = useAllTransactions()

  const last = Object.keys(allTransactions).find(
    hash =>
      allTransactions[hash][RESPONSE] &&
      allTransactions[hash][RESPONSE][CUSTOM_DATA].order.secret === order.secret &&
      !allTransactions[hash][RECEIPT]
  )

  if (last === undefined) {
    return { state: ORDER_NOT_PENDING, last: undefined }
  }

  return {
    state: allTransactions[last][RESPONSE][CUSTOM_DATA].action,
    last: allTransactions[last]
  }
}

export function useAllPendingOrders() {
  const allTransactions = useAllTransactions()
  return Object.keys(allTransactions)
    .filter(hash => {
      if (allTransactions[hash][RECEIPT]) {
        return false
      } else if (!allTransactions[hash][RESPONSE]) {
        return false
      } else if (allTransactions[hash][RESPONSE][CUSTOM_DATA].action === ACTION_PLACE_ORDER) {
        return true
      } else {
        return false
      }
    })
    .map(hash => allTransactions[hash][RESPONSE][CUSTOM_DATA].order)
}

export function useAllPendingCancelOrders() {
  const allTransactions = useAllTransactions()
  return Object.keys(allTransactions)
    .filter(hash => {
      if (allTransactions[hash][RECEIPT]) {
        return false
      } else if (!allTransactions[hash][RESPONSE]) {
        return false
      } else if (allTransactions[hash][RESPONSE][CUSTOM_DATA].action === ACTION_CANCEL_ORDER) {
        return true
      } else {
        return false
      }
    })
    .map(hash => allTransactions[hash][RESPONSE][CUSTOM_DATA].order)
}
