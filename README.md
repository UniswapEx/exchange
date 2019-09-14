# UniswapEX

> Limit orders on top of [Uniswap](https://uniswap.io)

## Table of Contents

- [Introduction](#introduction)
- [How it works](#how-it-works)

## Introduction

WIP

## How it works

You place an order and then a relayer execute it.

The relayer will take ETH as fee for executing the order.

- Cheaper than Uniswap.
- Monetize as uploading a relayer
- Avoid erc20 double tx issue by only doing 1 tx instead of approving + executing
