import React, { createContext, useContext, useReducer, useMemo, useCallback, useEffect } from 'react'
import { useWeb3React } from '@web3-react/core'

import { safeAccess } from '../utils'
import { getUSDPrice } from '../utils/price'

const BLOCK_NUMBER = 'BLOCK_NUMBER'
const USD_PRICE = 'USD_PRICE'

const UPDATE_BLOCK_NUMBER = 'UPDATE_BLOCK_NUMBER'
const UPDATE_USD_PRICE = 'UPDATE_USD_PRICE'

const ApplicationContext = createContext()

function useApplicationContext() {
  return useContext(ApplicationContext)
}

function reducer(state, { type, payload }) {
  switch (type) {
    case UPDATE_BLOCK_NUMBER: {
      const { chainId, blockNumber } = payload
      return {
        ...state,
        [BLOCK_NUMBER]: {
          ...(safeAccess(state, [BLOCK_NUMBER]) || {}),
          [chainId]: blockNumber
        }
      }
    }
    case UPDATE_USD_PRICE: {
      const { chainId, USDPrice } = payload
      return {
        ...state,
        [USD_PRICE]: {
          ...(safeAccess(state, [USD_PRICE]) || {}),
          [chainId]: USDPrice
        }
      }
    }
    default: {
      throw Error(`Unexpected action type in ApplicationContext reducer: '${type}'.`)
    }
  }
}

export default function Provider({ children }) {
  const [state, dispatch] = useReducer(reducer, {
    [BLOCK_NUMBER]: {},
    [USD_PRICE]: {}
  })

  const updateBlockNumber = useCallback((chainId, blockNumber) => {
    dispatch({ type: UPDATE_BLOCK_NUMBER, payload: { chainId, blockNumber } })
  }, [])

  const updateUSDPrice = useCallback((chainId, USDPrice) => {
    dispatch({ type: UPDATE_USD_PRICE, payload: { chainId, USDPrice } })
  }, [])

  return (
    <ApplicationContext.Provider
      value={useMemo(() => [state, { updateBlockNumber, updateUSDPrice }], [state, updateBlockNumber, updateUSDPrice])}
    >
      {children}
    </ApplicationContext.Provider>
  )
}

export function Updater() {
  const { chainId, library, connectorName } = useWeb3React()

  const globalBlockNumber = useBlockNumber()
  const [, { updateBlockNumber, updateUSDPrice }] = useApplicationContext()

  // slow down polling interval
  useEffect(() => {
    if (library) {
      if (connectorName === 'Network') {
        library.polling = false
      } else {
        library.pollingInterval = 5
      }
    }
  }, [library, connectorName])

  // update usd price
  useEffect(() => {
    if (library) {
      let stale = false

      getUSDPrice(library.provider)
        .then(([price]) => {
          if (!stale) {
            updateUSDPrice(chainId, price)
          }
        })
        .catch(() => {
          if (!stale) {
            updateUSDPrice(chainId, null)
          }
        })
    }
  }, [globalBlockNumber, library, chainId, updateUSDPrice])

  // update block number
  useEffect(() => {
    if (library) {
      let stale = false

      function update() {
        library
          .getBlockNumber()
          .then(blockNumber => {
            if (!stale) {
              updateBlockNumber(chainId, blockNumber)
            }
          })
          .catch(() => {
            if (!stale) {
              updateBlockNumber(chainId, null)
            }
          })
      }

      update()
      library.on('block', update)

      return () => {
        stale = true
        library.removeListener('block', update)
      }
    }
  }, [chainId, library, updateBlockNumber])

  return null
}

export function useBlockNumber() {
  const { chainId } = useWeb3React()

  const [state] = useApplicationContext()

  return safeAccess(state, [BLOCK_NUMBER, chainId])
}

export function useUSDPrice() {
  const { chainId } = useWeb3React()

  const [state] = useApplicationContext()

  return safeAccess(state, [USD_PRICE, chainId])
}
