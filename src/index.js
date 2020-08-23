import React from 'react'
import ReactDOM from 'react-dom'
import ReactGA from 'react-ga'
import { Web3Provider } from '@ethersproject/providers'
import { Provider } from 'react-redux'

import { createWeb3ReactRoot, Web3ReactProvider } from '@web3-react/core'

import ThemeProvider, { GlobalStyle } from './theme'
import LocalStorageContextProvider, { Updater as LocalStorageContextUpdater } from './contexts/LocalStorage'
import ApplicationContextProvider, { Updater as ApplicationContextUpdater } from './contexts/Application'
import TransactionContextProvider, { Updater as TransactionContextUpdater } from './contexts/Transactions'
import TokensContextProvider from './contexts/Tokens'
import BalancesContextProvider from './contexts/Balances'
import AllowancesContextProvider from './contexts/Allowances'
import AllBalancesContextProvider from './contexts/AllBalances'
import MulticallUpdater from './state/multicall/updater'
import { NetworkContextName } from './constants'

import App from './pages/App'
import store from './state'

import './i18n'

const Web3ProviderNetwork = createWeb3ReactRoot(NetworkContextName)

if (process.env.NODE_ENV === 'production') {
  ReactGA.initialize('UA-148036712-1')
} else {
  ReactGA.initialize('test', { testMode: true })
}
ReactGA.pageview(window.location.pathname + window.location.search)

function getLibrary(provider) {
  const library = new Web3Provider(provider)
  library.pollingInterval = 15000
  return library
}

function ContextProviders({ children }) {
  return (
    <LocalStorageContextProvider>
      <ApplicationContextProvider>
        <TransactionContextProvider>
          <TokensContextProvider>
            <BalancesContextProvider>
              <AllBalancesContextProvider>
                <AllowancesContextProvider>{children}</AllowancesContextProvider>
              </AllBalancesContextProvider>
            </BalancesContextProvider>
          </TokensContextProvider>
        </TransactionContextProvider>
      </ApplicationContextProvider>
    </LocalStorageContextProvider>
  )
}

function Updaters() {
  return (
    <>
      <LocalStorageContextUpdater />
      <ApplicationContextUpdater />
      <TransactionContextUpdater />
      <MulticallUpdater />
    </>
  )
}

ReactDOM.render(
  <Web3ReactProvider getLibrary={getLibrary}>
    <Web3ProviderNetwork getLibrary={getLibrary}>
      <ContextProviders>
        <Provider store={store}>
          <Updaters />
          <ThemeProvider>
            <>
              <GlobalStyle />
              <App />
            </>
          </ThemeProvider>
        </Provider>
      </ContextProviders>
    </Web3ProviderNetwork>
  </Web3ReactProvider>,
  document.getElementById('root')
)
