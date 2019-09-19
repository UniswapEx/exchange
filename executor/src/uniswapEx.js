module.exports = [
  {
    constant: true,
    inputs: [
      { internalType: 'address', name: '_from', type: 'address' },
      { internalType: 'address', name: '_to', type: 'address' },
      { internalType: 'uint256', name: '_return', type: 'uint256' },
      { internalType: 'uint256', name: '_fee', type: 'uint256' },
      { internalType: 'address payable', name: '_owner', type: 'address' },
      { internalType: 'bytes32', name: '_salt', type: 'bytes32' }
    ],
    name: 'encode',
    outputs: [{ internalType: 'bytes', name: '', type: 'bytes' }],
    payable: false,
    stateMutability: 'view',
    type: 'function'
  },
  {
    constant: false,
    inputs: [
      { internalType: 'contract IERC20', name: '_from', type: 'address' },
      { internalType: 'contract IERC20', name: '_to', type: 'address' },
      { internalType: 'uint256', name: '_return', type: 'uint256' },
      { internalType: 'uint256', name: '_fee', type: 'uint256' },
      { internalType: 'address payable', name: '_owner', type: 'address' },
      { internalType: 'bytes32', name: '_salt', type: 'bytes32' }
    ],
    name: 'cancel',
    outputs: [],
    payable: false,
    stateMutability: 'nonpayable',
    type: 'function'
  },
  {
    constant: true,
    inputs: [
      { internalType: 'contract IERC20', name: '_from', type: 'address' },
      { internalType: 'contract IERC20', name: '_to', type: 'address' },
      { internalType: 'uint256', name: '_return', type: 'uint256' },
      { internalType: 'uint256', name: '_fee', type: 'uint256' },
      { internalType: 'address payable', name: '_owner', type: 'address' },
      { internalType: 'bytes32', name: '_salt', type: 'bytes32' }
    ],
    name: 'canExecuteOrder',
    outputs: [{ internalType: 'bool', name: '', type: 'bool' }],
    payable: false,
    stateMutability: 'view',
    type: 'function'
  },
  {
    constant: true,
    inputs: [
      { internalType: 'contract IERC20', name: '_from', type: 'address' },
      { internalType: 'contract IERC20', name: '_to', type: 'address' },
      { internalType: 'uint256', name: '_return', type: 'uint256' },
      { internalType: 'uint256', name: '_fee', type: 'uint256' },
      { internalType: 'address payable', name: '_owner', type: 'address' },
      { internalType: 'bytes32', name: '_salt', type: 'bytes32' }
    ],
    name: 'exists',
    outputs: [{ internalType: 'bool', name: '', type: 'bool' }],
    payable: false,
    stateMutability: 'view',
    type: 'function'
  },
  {
    constant: true,
    inputs: [
      { internalType: 'contract IERC20', name: '_from', type: 'address' },
      { internalType: 'contract IERC20', name: '_to', type: 'address' },
      { internalType: 'uint256', name: '_amount', type: 'uint256' },
      { internalType: 'uint256', name: '_return', type: 'uint256' },
      { internalType: 'uint256', name: '_fee', type: 'uint256' },
      { internalType: 'address payable', name: '_owner', type: 'address' },
      { internalType: 'bytes32', name: '_salt', type: 'bytes32' }
    ],
    name: 'encodeTokenOrder',
    outputs: [{ internalType: 'bytes', name: '', type: 'bytes' }],
    payable: false,
    stateMutability: 'view',
    type: 'function'
  },
  {
    constant: true,
    inputs: [],
    name: 'uniswapFactory',
    outputs: [
      { internalType: 'contract UniswapFactory', name: '', type: 'address' }
    ],
    payable: false,
    stateMutability: 'view',
    type: 'function'
  },
  {
    constant: true,
    inputs: [],
    name: 'ETH_ADDRESS',
    outputs: [{ internalType: 'address', name: '', type: 'address' }],
    payable: false,
    stateMutability: 'view',
    type: 'function'
  },
  {
    constant: false,
    inputs: [
      { internalType: 'contract IERC20', name: '_from', type: 'address' },
      { internalType: 'contract IERC20', name: '_to', type: 'address' },
      { internalType: 'uint256', name: '_return', type: 'uint256' },
      { internalType: 'uint256', name: '_fee', type: 'uint256' },
      { internalType: 'address payable', name: '_owner', type: 'address' },
      { internalType: 'bytes32', name: '_salt', type: 'bytes32' }
    ],
    name: 'execute',
    outputs: [],
    payable: false,
    stateMutability: 'nonpayable',
    type: 'function'
  },
  {
    constant: false,
    inputs: [{ internalType: 'bytes', name: '_data', type: 'bytes' }],
    name: 'depositETH',
    outputs: [],
    payable: true,
    stateMutability: 'payable',
    type: 'function'
  },
  {
    constant: true,
    inputs: [{ internalType: 'bytes', name: '_data', type: 'bytes' }],
    name: 'decode',
    outputs: [
      { internalType: 'address', name: '_from', type: 'address' },
      { internalType: 'address', name: '_to', type: 'address' },
      { internalType: 'uint256', name: '_return', type: 'uint256' },
      { internalType: 'uint256', name: '_fee', type: 'uint256' },
      { internalType: 'address payable', name: '_owner', type: 'address' }
    ],
    payable: false,
    stateMutability: 'view',
    type: 'function'
  },
  {
    constant: true,
    inputs: [{ internalType: 'bytes32', name: '', type: 'bytes32' }],
    name: 'ethDeposits',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    payable: false,
    stateMutability: 'view',
    type: 'function'
  },
  {
    constant: true,
    inputs: [
      { internalType: 'contract IERC20', name: '_from', type: 'address' },
      { internalType: 'contract IERC20', name: '_to', type: 'address' },
      { internalType: 'uint256', name: '_return', type: 'uint256' },
      { internalType: 'uint256', name: '_fee', type: 'uint256' },
      { internalType: 'address payable', name: '_owner', type: 'address' },
      { internalType: 'bytes32', name: '_salt', type: 'bytes32' }
    ],
    name: 'vaultOfOrder',
    outputs: [{ internalType: 'address', name: '', type: 'address' }],
    payable: false,
    stateMutability: 'view',
    type: 'function'
  },
  {
    inputs: [
      {
        internalType: 'contract UniswapFactory',
        name: '_uniswapFactory',
        type: 'address'
      }
    ],
    payable: false,
    stateMutability: 'nonpayable',
    type: 'constructor'
  },
  { payable: true, stateMutability: 'payable', type: 'fallback' },
  {
    anonymous: false,
    inputs: [
      {
        indexed: false,
        internalType: 'uint256',
        name: '_amount',
        type: 'uint256'
      },
      { indexed: false, internalType: 'bytes', name: '_data', type: 'bytes' }
    ],
    name: 'DepositETH',
    type: 'event'
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: false,
        internalType: 'address',
        name: '_from',
        type: 'address'
      },
      { indexed: false, internalType: 'address', name: '_to', type: 'address' },
      {
        indexed: false,
        internalType: 'uint256',
        name: '_amount',
        type: 'uint256'
      },
      {
        indexed: false,
        internalType: 'uint256',
        name: '_bought',
        type: 'uint256'
      },
      {
        indexed: false,
        internalType: 'uint256',
        name: '_fee',
        type: 'uint256'
      },
      {
        indexed: false,
        internalType: 'address',
        name: '_owner',
        type: 'address'
      },
      {
        indexed: false,
        internalType: 'bytes32',
        name: '_salt',
        type: 'bytes32'
      },
      {
        indexed: false,
        internalType: 'address',
        name: '_relayer',
        type: 'address'
      }
    ],
    name: 'Executed',
    type: 'event'
  }
]
