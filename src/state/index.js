import { configureStore, getDefaultMiddleware } from '@reduxjs/toolkit'
import { save, load } from 'redux-localstorage-simple'

import root from '../module/root/reducer'
import multicall from './multicall/reducer'
// import user from './user/reducer'
// import transactions from './transactions/reducer'
// import swap from './swap/reducer'
// import mint from './mint/reducer'
// import lists from './lists/reducer'
// import burn from './burn/reducer'

// import { updateVersion } from './user/actions'

const PERSISTED_KEYS = ['user', 'transactions', 'lists']

const store = configureStore({
  reducer: {
    root,
    multicall
    //application,
    // user,
    // transactions,
    // swap,
    // mint,
    // burn,
    // lists
  },
  middleware: [...getDefaultMiddleware(), save({ states: PERSISTED_KEYS })],
  preloadedState: load({ states: PERSISTED_KEYS })
})

// store.dispatch(updateVersion())

export default store
