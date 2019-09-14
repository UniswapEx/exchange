#! /bin/bash

UNISWAPEX=UniswapEX.sol

OUTPUT=full

npx truffle-flattener contracts/$UNISWAPEX > $OUTPUT/$UNISWAPEX