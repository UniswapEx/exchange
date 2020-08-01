import { AbstractConnector } from '@web3-react/abstract-connector'
import invariant from 'tiny-invariant'

class RequestError extends Error {
  constructor(message, code, data) {
    super(message)
  }
}

class MiniRpcProvider {
  isMetaMask = false
  chainId
  url
  host
  path

  constructor(chainId, url) {
    this.chainId = chainId
    this.url = url
    const parsed = new URL(url)
    this.host = parsed.host
    this.path = parsed.pathname
  }

  sendAsync = (request, callback) => {
    this.request(request.method, request.params)
      .then(result => callback(null, { jsonrpc: '2.0', id: request.id, result }))
      .catch(error => callback(error, null))
  }

  request = async (method, params) => {
    if (typeof method !== 'string') {
      return this.request(method.method, method.params)
    }
    if (method === 'eth_chainId') {
      return `0x${this.chainId.toString(16)}`
    }
    const response = await fetch(this.url, {
      method: 'POST',
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method,
        params
      })
    })
    if (!response.ok) throw new RequestError(`${response.status}: ${response.statusText}`, -32000)
    const body = await response.json()
    if ('error' in body) {
      throw new RequestError(body.error.message, body.error.code, body.error.data)
    } else if ('result' in body) {
      return body.result
    } else {
      throw new RequestError(`Received unexpected JSON-RPC response to ${method} request.`, -32000, body)
    }
  }
}

export class NetworkConnector extends AbstractConnector {
  providers
  currentChainId

  constructor({ urls, defaultChainId }) {
    invariant(defaultChainId || Object.keys(urls).length === 1, 'defaultChainId is a required argument with >1 url')
    super({ supportedChainIds: Object.keys(urls).map(k => Number(k)) })

    this.currentChainId = defaultChainId || Number(Object.keys(urls)[0])
    this.providers = Object.keys(urls).reduce((accumulator, chainId) => {
      accumulator[Number(chainId)] = new MiniRpcProvider(Number(chainId), urls[Number(chainId)])
      return accumulator
    }, {})
  }

  async activate() {
    return { provider: this.providers[this.currentChainId], chainId: this.currentChainId, account: null }
  }

  async getProvider() {
    return this.providers[this.currentChainId]
  }

  async getChainId() {
    return this.currentChainId
  }

  async getAccount() {
    return null
  }

  deactivate() {
    return
  }
}
