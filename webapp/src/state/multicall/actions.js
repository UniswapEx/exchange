import { createAction } from '@reduxjs/toolkit'

const ADDRESS_REGEX = /^0x[a-fA-F0-9]{40}$/
const LOWER_HEX_REGEX = /^0x[a-f0-9]*$/
export function toCallKey(call) {
  if (!ADDRESS_REGEX.test(call.address)) {
    throw new Error(`Invalid address: ${call.address}`)
  }
  if (!LOWER_HEX_REGEX.test(call.callData)) {
    throw new Error(`Invalid hex: ${call.callData}`)
  }
  return `${call.address}-${call.callData}`
}

export function parseCallKey(callKey) {
  const pcs = callKey.split('-')
  if (pcs.length !== 2) {
    throw new Error(`Invalid call key: ${callKey}`)
  }
  return {
    address: pcs[0],
    callData: pcs[1]
  }
}

export const addMulticallListeners = createAction('addMulticallListeners')
export const removeMulticallListeners = createAction('removeMulticallListeners')
export const fetchingMulticallResults = createAction('fetchingMulticallResults')
export const errorFetchingMulticallResults = createAction('errorFetchingMulticallResults')
export const updateMulticallResults = createAction('updateMulticallResults')
