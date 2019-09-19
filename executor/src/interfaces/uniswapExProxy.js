module.exports = [
  {
    'constant': false,
    'inputs': [
      {
        'internalType': 'contract IERC20',
        'name': '_fromToken',
        'type': 'address',
      },
      {
        'internalType': 'contract IERC20',
        'name': '_toToken',
        'type': 'address',
      },
      {
        'internalType': 'uint256',
        'name': '_minReturn',
        'type': 'uint256',
      },
      {
        'internalType': 'uint256',
        'name': '_fee',
        'type': 'uint256',
      },
      {
        'internalType': 'address payable',
        'name': '_owner',
        'type': 'address',
      },
      {
        'internalType': 'bytes32',
        'name': '_salt',
        'type': 'bytes32',
      },
      {
        'internalType': 'bytes32',
        'name': '_checksum',
        'type': 'bytes32',
      },
    ],
    'name': 'executeOrder',
    'outputs': [

    ],
    'payable': false,
    'stateMutability': 'nonpayable',
    'type': 'function',
  },
  {
    'constant': true,
    'inputs': [
      {
        'internalType': 'address payable',
        'name': '_owner',
        'type': 'address',
      },
      {
        'internalType': 'bytes32',
        'name': '_salt',
        'type': 'bytes32',
      },
      {
        'internalType': 'address',
        'name': '_relayer',
        'type': 'address',
      },
    ],
    'name': 'getChecksum',
    'outputs': [
      {
        'internalType': 'bytes32',
        'name': '',
        'type': 'bytes32',
      },
    ],
    'payable': false,
    'stateMutability': 'pure',
    'type': 'function',
  },
  {
    'constant': true,
    'inputs': [

    ],
    'name': 'uniswapEx',
    'outputs': [
      {
        'internalType': 'contract UniswapEX',
        'name': '',
        'type': 'address',
      },
    ],
    'payable': false,
    'stateMutability': 'view',
    'type': 'function',
  },
  {
    'inputs': [
      {
        'internalType': 'contract UniswapEX',
        'name': '_uniswapEx',
        'type': 'address',
      },
    ],
    'payable': false,
    'stateMutability': 'nonpayable',
    'type': 'constructor',
  },
  {
    'payable': true,
    'stateMutability': 'payable',
    'type': 'fallback',
  },
];
