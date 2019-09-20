# UniswapEX

> Limit orders on top of [Uniswap](https://uniswap.io)

## Table of Contents

- [Introduction](#introduction)
- [How it works](#how-it-works)
  - [Users](#users)
  - [Relayers](#relayers)

## Introduction

[UniswapEx](https://uniswapex.io) is a protocol for automated limit orders exchange on Ethereum built on top of [Uniswap](https://uniswap.io).

[Limit orders](https://www.investopedia.com/terms/l/limitorder.asp) give traders complete control over the execution price at which their orders will be filled. It eliminates the possibility of a “bad fill” and provide you some degree of protection.

It continues the base commitment to free and decentralized exchange.

All the orders can **ONLY** be cancelled by its owner. Saying that, we can not steal your funds.

The [smart contract](https://etherscan.io/address/#code) is validated and can be audited by anyone.

## How it works

Using [UniswapEx](https://uniswapex.io) is extremedily easy due to the [Uniswap FE's](https://github.com/Uniswap/uniswap-frontend) UI.

It has two main actors: [Users](#users) and [Relayers](#relayers).

### Users

As a user you can simple place an order and then wait for a relayer execute it once the order can fill its parameters.

An order is composed by:

| Param     | Description                                                            |
| --------- | ---------------------------------------------------------------------- |
| fromToken | Token used to buy. For ETH it is the E-address.                        |
| toToken   | Token to be bought. For ETH it is the E-address.                       |
| minReturn | Mininum amount of toToken to buy.                                      |
| fee       | Amount in ETH (WEI) to pay for the relayer to execute the order.       |
| owner     | Owner of the order                                                     |
| witness   | Ephemeral address as salt used to avoid relayer-front-runner execution |

Every order has a `fee` which is the _payment_ to the relayer to execute your order. This fee should be greater that the cost of executing your order. So far, we set a fixed fee of INSERT_FEE_HERE but we expect to have it configurable when placing the order.

We solved the ERC20 token standard critical problem by using counterfactual addresses. You won't need to send two transactions like on Uniswap where it is well known that the _approve + transferFrom mechanism_ is potentially insecure.

### Relayer

The relayer will execute orders **only** when they can be filled.

If you want to build your own relayer, you can follow our example [here](LINK_TO_THE_RELAYER_FOLDER)

## Next

- Ability for the user to set the fee.

If you want to add your token reach out us.
