# UniswapEX

> Limit orders on top of [Uniswap](https://uniswap.io)

**TL;DR**: [Users](#users) can create limited orders. [Relayers](#relayers) can earn a fee executing them when the trade conditions can be fulfilled.

## Table of Contents

- [Introduction](#introduction)
- [How it works](#how-it-works)
  - [Users](#users)
  - [Relayers](#relayers)
- [Next](#next)

## Introduction

[UniswapEx](https://uniswapex.io) is a protocol for automated limit orders exchange on Ethereum built on top of [Uniswap](https://uniswap.io).

[Limit orders](https://www.investopedia.com/terms/l/limitorder.asp) give traders complete control over the rate at which their orders will be executed, enabling traders to automate transactions at a specific rateñ

It continues the base commitment to free and decentralized exchange.

Every token combination is available. There **isn't** a limitation on how you can select what to buy and what to sell (Of course if it is a token living on the Ethereum network).

An order at UniswapEX can only be canceled by its creator, and it can be executed if the creator receives the desired amount, making the system trustless and independent of a central entity.

The [smart contract](https://etherscan.io/address/#code) is validated and can be reviewed by anyone. The code hasn't been audited by a reputable third party yet, and we advise to proceed with caution.

## How it works

Using [UniswapEx](https://uniswapex.io) is extremely easy due to the [Uniswap FE's](https://github.com/Uniswap/uniswap-frontend) UI.

It has two main actors: [Users](#users) and [Relayers](#relayers).

### Users

As a user, an order can be created by sending a tradeable token to a specific counterfactual address, or by calling the contract method DepositETH. Relayers in the system will periodically check if the order can be filled, and will execute the trade when it's possible.

An order is composed by:

| Param     | Description                                                            |
| --------- | ---------------------------------------------------------------------- |
| fromToken | Token used to buy. For ETH it is the E-address.                        |
| toToken   | Token to be bought. For ETH it is the E-address.                       |
| minReturn | Mininum amount of toToken to buy.                                      |
| owner     | Owner of the order                                                     |
| witness   | Ephemeral address as salt used to avoid relayer-front-runner execution |

Every order has a fee which is the _payment_ to the relayer for performing the trade. This fee should be higher than the transaction cost of executing the order. So far, we set a fixed fee of 0.006 ETH but we expect to have it configurable when placing the order. This fee represents sending the order execution transaction by the [relayer](#relayers) with 20 GWEI.

One of the biggest challenges when working with ERC20 tokens is dealing with the approve and transferFrom pattern; it confuses the user, makes transacting more expensive, and it's often used with "unlimited" authorizations, forcing the user to trust the contract.

We built a solution to avoid the approve and transferFrom, that works with almost all existing ERC20 tokens, we use a counterfactual contract address deployed using CREATE2 to encode the unique trading conditions signature, so the only thing that the user needs to do to create an order is sent the tokens to this given address.

The next question to arise is data availability; we avoid any centralized solution by appending the data required to execute or cancel the order after the transaction data of the token transfer. The ERC20 contract ignores this extra data most of the time but ensures the data availability needed to be able to execute or cancel the trade.

### Relayer

The relayers have the task of monitoring the network, looking for new orders, and executing them when the trade conditions can be fulfilled.

Because of how we encode the transaction data, there is no event for detecting new token orders, forcing the relayers to search through all the ERC20 token transfers looking for the specially encoded UniswapEX transaction data.

The process of looking for those orders is one of the most costly jobs of being a relayer, and one of the things that we found out, is that it was far more easy to "listen" for other relayers when they were about to execute an order, and then copy the execution transaction, effectively "stealing" the job performed by that relayer.

We fixed this issue by providing a secret in the transaction data; the relayer has to obtain this secret and sign a message containing the address that is going to use to execute the order. In this way, it can provide a proof of seeing the original data, and this proof can't be used by a front runner to copy the transaction.

We made two simple examples in [python](https://github.com/UniswapEx/relayer-python) and [node](https://github.com/UniswapEx/relayer-node)

## Next

- Ability for the user to set the fee.

If you want to add your token reach out us.

- [Discord](https://discord.gg/w6JVcrg)
- [Telegram](https://t.me/UniswapEX)
- [Twitter](https://twitter.com/uniswapex)

Repo forked from [Uniswap](https://github.com/Uniswap/uniswap-frontend) repo
