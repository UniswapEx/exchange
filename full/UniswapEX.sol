
// File: contracts/commons/SafeMath.sol

pragma solidity ^0.5.11;

/**
 * @dev Wrappers over Solidity's arithmetic operations with added overflow
 * checks.
 *
 * Arithmetic operations in Solidity wrap on overflow. This can easily result
 * in bugs, because programmers usually assume that an overflow raises an
 * error, which is the standard behavior in high level programming languages.
 * `SafeMath` restores this intuition by reverting the transaction when an
 * operation overflows.
 *
 * Using this library instead of the unchecked operations eliminates an entire
 * class of bugs, so it's recommended to use it always.
 */
library SafeMath {
    /**
     * @dev Returns the addition of two unsigned integers, reverting on
     * overflow.
     *
     * Counterpart to Solidity's `+` operator.
     *
     * Requirements:
     * - Addition cannot overflow.
     */
    function add(uint256 a, uint256 b) internal pure returns (uint256) {
        uint256 c = a + b;
        require(c >= a, "SafeMath: addition overflow");

        return c;
    }

    /**
     * @dev Returns the subtraction of two unsigned integers, reverting on
     * overflow (when the result is negative).
     *
     * Counterpart to Solidity's `-` operator.
     *
     * Requirements:
     * - Subtraction cannot overflow.
     */
    function sub(uint256 a, uint256 b) internal pure returns (uint256) {
        return sub(a, b, "SafeMath: subtraction overflow");
    }

    /**
     * @dev Returns the subtraction of two unsigned integers, reverting with custom message on
     * overflow (when the result is negative).
     *
     * Counterpart to Solidity's `-` operator.
     *
     * Requirements:
     * - Subtraction cannot overflow.
     *
     * NOTE: This is a feature of the next version of OpenZeppelin Contracts.
     * @dev Get it via `npm install @openzeppelin/contracts@next`.
     */
    function sub(uint256 a, uint256 b, string memory errorMessage) internal pure returns (uint256) {
        require(b <= a, errorMessage);
        uint256 c = a - b;

        return c;
    }

    /**
     * @dev Returns the multiplication of two unsigned integers, reverting on
     * overflow.
     *
     * Counterpart to Solidity's `*` operator.
     *
     * Requirements:
     * - Multiplication cannot overflow.
     */
    function mul(uint256 a, uint256 b) internal pure returns (uint256) {
        // Gas optimization: this is cheaper than requiring 'a' not being zero, but the
        // benefit is lost if 'b' is also tested.
        // See: https://github.com/OpenZeppelin/openzeppelin-contracts/pull/522
        if (a == 0) {
            return 0;
        }

        uint256 c = a * b;
        require(c / a == b, "SafeMath: multiplication overflow");

        return c;
    }

    /**
     * @dev Returns the integer division of two unsigned integers. Reverts on
     * division by zero. The result is rounded towards zero.
     *
     * Counterpart to Solidity's `/` operator. Note: this function uses a
     * `revert` opcode (which leaves remaining gas untouched) while Solidity
     * uses an invalid opcode to revert (consuming all remaining gas).
     *
     * Requirements:
     * - The divisor cannot be zero.
     */
    function div(uint256 a, uint256 b) internal pure returns (uint256) {
        return div(a, b, "SafeMath: division by zero");
    }

    /**
     * @dev Returns the integer division of two unsigned integers. Reverts with custom message on
     * division by zero. The result is rounded towards zero.
     *
     * Counterpart to Solidity's `/` operator. Note: this function uses a
     * `revert` opcode (which leaves remaining gas untouched) while Solidity
     * uses an invalid opcode to revert (consuming all remaining gas).
     *
     * Requirements:
     * - The divisor cannot be zero.
     * NOTE: This is a feature of the next version of OpenZeppelin Contracts.
     * @dev Get it via `npm install @openzeppelin/contracts@next`.
     */
    function div(uint256 a, uint256 b, string memory errorMessage) internal pure returns (uint256) {
        // Solidity only automatically asserts when dividing by 0
        require(b > 0, errorMessage);
        uint256 c = a / b;
        // assert(a == b * c + a % b); // There is no case in which this doesn't hold

        return c;
    }

    /**
     * @dev Returns the remainder of dividing two unsigned integers. (unsigned integer modulo),
     * Reverts when dividing by zero.
     *
     * Counterpart to Solidity's `%` operator. This function uses a `revert`
     * opcode (which leaves remaining gas untouched) while Solidity uses an
     * invalid opcode to revert (consuming all remaining gas).
     *
     * Requirements:
     * - The divisor cannot be zero.
     */
    function mod(uint256 a, uint256 b) internal pure returns (uint256) {
        return mod(a, b, "SafeMath: modulo by zero");
    }

    /**
     * @dev Returns the remainder of dividing two unsigned integers. (unsigned integer modulo),
     * Reverts with custom message when dividing by zero.
     *
     * Counterpart to Solidity's `%` operator. This function uses a `revert`
     * opcode (which leaves remaining gas untouched) while Solidity uses an
     * invalid opcode to revert (consuming all remaining gas).
     *
     * Requirements:
     * - The divisor cannot be zero.
     *
     * NOTE: This is a feature of the next version of OpenZeppelin Contracts.
     * @dev Get it via `npm install @openzeppelin/contracts@next`.
     */
    function mod(uint256 a, uint256 b, string memory errorMessage) internal pure returns (uint256) {
        require(b != 0, errorMessage);
        return a % b;
    }
}

// File: contracts/interfaces/IERC20.sol

pragma solidity ^0.5.11;


/**
 * @dev Interface of the ERC20 standard as defined in the EIP. Does not include
 * the optional functions; to access them see {ERC20Detailed}.
 */
interface IERC20 {
    /**
     * @dev Returns the amount of tokens in existence.
     */
    function totalSupply() external view returns (uint256);

    /**
     * @dev Returns the amount of tokens owned by `account`.
     */
    function balanceOf(address account) external view returns (uint256);

    /**
     * @dev Moves `amount` tokens from the caller's account to `recipient`.
     *
     * Returns a boolean value indicating whether the operation succeeded.
     *
     * Emits a {Transfer} event.
     */
    function transfer(address recipient, uint256 amount) external returns (bool);

    /**
     * @dev Returns the remaining number of tokens that `spender` will be
     * allowed to spend on behalf of `owner` through {transferFrom}. This is
     * zero by default.
     *
     * This value changes when {approve} or {transferFrom} are called.
     */
    function allowance(address owner, address spender) external view returns (uint256);

    /**
     * @dev Sets `amount` as the allowance of `spender` over the caller's tokens.
     *
     * Returns a boolean value indicating whether the operation succeeded.
     *
     * IMPORTANT: Beware that changing an allowance with this method brings the risk
     * that someone may use both the old and the new allowance by unfortunate
     * transaction ordering. One possible solution to mitigate this race
     * condition is to first reduce the spender's allowance to 0 and set the
     * desired value afterwards:
     * https://github.com/ethereum/EIPs/issues/20#issuecomment-263524729
     *
     * Emits an {Approval} event.
     */
    function approve(address spender, uint256 amount) external returns (bool);

    /**
     * @dev Moves `amount` tokens from `sender` to `recipient` using the
     * allowance mechanism. `amount` is then deducted from the caller's
     * allowance.
     *
     * Returns a boolean value indicating whether the operation succeeded.
     *
     * Emits a {Transfer} event.
     */
    function transferFrom(address sender, address recipient, uint256 amount) external returns (bool);

    /**
     * @dev Emitted when `value` tokens are moved from one account (`from`) to
     * another (`to`).
     *
     * Note that `value` may be zero.
     */
    event Transfer(address indexed from, address indexed to, uint256 value);

    /**
     * @dev Emitted when the allowance of a `spender` for an `owner` is set by
     * a call to {approve}. `value` is the new allowance.
     */
    event Approval(address indexed owner, address indexed spender, uint256 value);
}

// File: contracts/interfaces/UniswapExchange.sol

pragma solidity ^0.5.11;


contract UniswapExchange {
    // Address of ERC20 token sold on this exchange
    function tokenAddress() external view returns (address token);
    // Address of Uniswap Factory
    function factoryAddress() external view returns (address factory);
    // Provide Liquidity
    function addLiquidity(uint256 min_liquidity, uint256 max_tokens, uint256 deadline) external payable returns (uint256);
    function removeLiquidity(uint256 amount, uint256 min_eth, uint256 min_tokens, uint256 deadline) external returns (uint256, uint256);
    // Get Prices
    function getEthToTokenInputPrice(uint256 eth_sold) external view returns (uint256 tokens_bought);
    function getEthToTokenOutputPrice(uint256 tokens_bought) external view returns (uint256 eth_sold);
    function getTokenToEthInputPrice(uint256 tokens_sold) external view returns (uint256 eth_bought);
    function getTokenToEthOutputPrice(uint256 eth_bought) external view returns (uint256 tokens_sold);
    // Trade ETH to ERC20
    function ethToTokenSwapInput(uint256 min_tokens, uint256 deadline) external payable returns (uint256  tokens_bought);
    function ethToTokenTransferInput(uint256 min_tokens, uint256 deadline, address recipient) external payable returns (uint256  tokens_bought);
    function ethToTokenSwapOutput(uint256 tokens_bought, uint256 deadline) external payable returns (uint256  eth_sold);
    function ethToTokenTransferOutput(uint256 tokens_bought, uint256 deadline, address recipient) external payable returns (uint256  eth_sold);
    // Trade ERC20 to ETH
    function tokenToEthSwapInput(uint256 tokens_sold, uint256 min_eth, uint256 deadline) external returns (uint256  eth_bought);
    function tokenToEthTransferInput(uint256 tokens_sold, uint256 min_eth, uint256 deadline, address recipient) external returns (uint256  eth_bought);
    function tokenToEthSwapOutput(uint256 eth_bought, uint256 max_tokens, uint256 deadline) external returns (uint256  tokens_sold);
    function tokenToEthTransferOutput(uint256 eth_bought, uint256 max_tokens, uint256 deadline, address recipient) external returns (uint256  tokens_sold);
    // Trade ERC20 to ERC20
    function tokenToTokenSwapInput(uint256 tokens_sold, uint256 min_tokens_bought, uint256 min_eth_bought, uint256 deadline, address token_addr) external returns (uint256  tokens_bought);
    function tokenToTokenTransferInput(uint256 tokens_sold, uint256 min_tokens_bought, uint256 min_eth_bought, uint256 deadline, address recipient, address token_addr) external returns (uint256  tokens_bought);
    function tokenToTokenSwapOutput(uint256 tokens_bought, uint256 max_tokens_sold, uint256 max_eth_sold, uint256 deadline, address token_addr) external returns (uint256  tokens_sold);
    function tokenToTokenTransferOutput(uint256 tokens_bought, uint256 max_tokens_sold, uint256 max_eth_sold, uint256 deadline, address recipient, address token_addr) external returns (uint256  tokens_sold);
    // Trade ERC20 to Custom Pool
    function tokenToExchangeSwapInput(uint256 tokens_sold, uint256 min_tokens_bought, uint256 min_eth_bought, uint256 deadline, address exchange_addr) external returns (uint256  tokens_bought);
    function tokenToExchangeTransferInput(uint256 tokens_sold, uint256 min_tokens_bought, uint256 min_eth_bought, uint256 deadline, address recipient, address exchange_addr) external returns (uint256  tokens_bought);
    function tokenToExchangeSwapOutput(uint256 tokens_bought, uint256 max_tokens_sold, uint256 max_eth_sold, uint256 deadline, address exchange_addr) external returns (uint256  tokens_sold);
    function tokenToExchangeTransferOutput(uint256 tokens_bought, uint256 max_tokens_sold, uint256 max_eth_sold, uint256 deadline, address recipient, address exchange_addr) external returns (uint256  tokens_sold);
    // ERC20 comaptibility for liquidity tokens
    bytes32 public name;
    bytes32 public symbol;
    uint256 public decimals;
    function transfer(address _to, uint256 _value) external returns (bool);
    function transferFrom(address _from, address _to, uint256 value) external returns (bool);
    function approve(address _spender, uint256 _value) external returns (bool);
    function allowance(address _owner, address _spender) external view returns (uint256);
    function balanceOf(address _owner) external view returns (uint256);
    function totalSupply() external view returns (uint256);
    // Never use
    function setup(address token_addr) external;
}

// File: contracts/interfaces/UniswapFactory.sol

pragma solidity ^0.5.11;




contract UniswapFactory {
    // Public Variables
    address public exchangeTemplate;
    uint256 public tokenCount;
    // Create Exchange
    function createExchange(address token) external returns (address exchange);
    // Get Exchange and Token Info
    function getExchange(address token) external view returns (UniswapExchange exchange);
    function getToken(address exchange) external view returns (IERC20 token);
    function getTokenWithId(uint256 tokenId) external view returns (address token);
    // Never use
    function initializeFactory(address template) external;
}

// File: contracts/libs/Fabric.sol

pragma solidity ^0.5.11;



/**
 * @title Fabric
 * @dev Create deterministics vaults.
 */
library Fabric {
    /*Vault bytecode

        def _fallback() payable:
            call cd[56] with:
                funct call.data[0 len 4]
                gas cd[56] wei
                args call.data[4 len 64]
            selfdestruct(tx.origin)

        // Constructor bytecode
        0x6012600081600A8239f3

        0x60 12 - PUSH1 12           // Size of the contract to return
        0x60 00 - PUSH1 00           // Memory offset to return stored code
        0x81    - DUP2  12           // Size of code to copy
        0x60 0a - PUSH1 0A           // Start of the code to copy
        0x82    - DUP3  00           // Dest memory for code copy
        0x39    - CODECOPY 00 0A 12  // Code copy to memory
        0xf3    - RETURN 00 12       // Return code to store

        // Deployed contract bytecode
        0x60008060448082803781806038355AF132FF

        0x60 00 - PUSH1 00                    // Size for the call output
        0x80    - DUP1  00                    // Offset for the call output
        0x60 44 - PUSH1 44                    // Size for the call input
        0x80    - DUP1  44                    // Size for copying calldata to memory
        0x82    - DUP3  00                    // Offset for calldata copy
        0x80    - DUP1  00                    // Offset for destination of calldata copy
        0x37    - CALLDATACOPY 00 00 44       // Execute calldata copy, is going to be used for next call
        0x81    - DUP2  00                    // Offset for call input
        0x80    - DUP1  00                    // Amount of ETH to send during call
        0x60 38 - PUSH1 38                    // calldata pointer to load value into stack
        0x35    - CALLDATALOAD 38 (A)         // Load value (A), address to call
        0x5a    - GAS                         // Remaining gas
        0xf1    - CALL (A) (A) 00 00 44 00 00 // Execute call to address (A) with calldata mem[0:64]
        0x32    - ORIGIN (B)                  // Dest funds for selfdestruct
        0xff    - SELFDESTRUCT (B)            // selfdestruct contract, end of execution
    */
    bytes public constant code = hex"6012600081600A8239F360008060448082803781806038355AF132FF";
    bytes32 public constant vaultCodeHash = bytes32(0xfa3da1081bc86587310fce8f3a5309785fc567b9b20875900cb289302d6bfa97);

    /**
    * @dev Get a deterministics vault.
    */
    function getVault(bytes32 _key) internal view returns (address) {
        return address(
            uint256(
                keccak256(
                    abi.encodePacked(
                        byte(0xff),
                        address(this),
                        _key,
                        vaultCodeHash
                    )
                )
            )
        );
    }

    /**
    * @dev Create deterministic vault.
    */
    function executeVault(bytes32 _key, IERC20 _token, address _to) internal returns (uint256 value) {
        address addr;
        bytes memory slotcode = code;

        /* solium-disable-next-line */
        assembly{
          // Create the contract arguments for the constructor
          addr := create2(0, add(slotcode, 0x20), mload(slotcode), _key)
          if iszero(extcodesize(addr)) {
            revert(0, 0)
          }
        }

        value = _token.balanceOf(addr);
        /* solium-disable-next-line */
        (bool success, ) = addr.call(
            abi.encodePacked(
                abi.encodeWithSelector(
                    _token.transfer.selector,
                    _to,
                    value
                ),
                address(_token)
            )
        );

        require(success, "error pulling tokens");
    }
}

// File: contracts/UniswapEX.sol

pragma solidity ^0.5.11;







contract UniswapEX {
    using SafeMath for uint256;
    using Fabric for bytes32;

    event DepositETH(
        bytes32 indexed _key,
        address indexed _caller,
        uint256 _amount,
        bytes _data
    );

    event OrderExecuted(
        bytes32 indexed _key,
        address _fromToken,
        address _toToken,
        uint256 _minReturn,
        uint256 _fee,
        address _owner,
        bytes32 _salt,
        address _relayer,
        uint256 _amount,
        uint256 _bought
    );

    event OrderCancelled(
        bytes32 indexed _key,
        address _fromToken,
        address _toToken,
        uint256 _minReturn,
        uint256 _fee,
        address _owner,
        bytes32 _salt,
        uint256 _amount
    );

    address public constant ETH_ADDRESS = address(0x00eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee);
    uint256 private constant never = uint(-1);

    UniswapFactory public uniswapFactory;

    mapping(bytes32 => uint256) public ethDeposits;

    constructor(UniswapFactory _uniswapFactory) public {
        uniswapFactory = _uniswapFactory;
    }

    function() external payable { }

    function depositEth(
        bytes calldata _data
    ) external payable {
        require(msg.value > 0, "No value provided");

        bytes32 key = keccak256(_data);
        ethDeposits[key] = ethDeposits[key].add(msg.value);
        emit DepositETH(key, msg.sender, msg.value, _data);
    }

    function cancelOrder(
        IERC20 _fromToken,
        IERC20 _toToken,
        uint256 _minReturn,
        uint256 _fee,
        address payable _owner,
        bytes32 _salt
    ) external {
        require(msg.sender == _owner, "Only the owner of the order can cancel it");
        bytes32 key = _keyOf(
            _fromToken,
            _toToken,
            _minReturn,
            _fee,
            _owner,
            _salt
        );

        uint256 amount;
        if (address(_fromToken) == ETH_ADDRESS) {
            amount = ethDeposits[key];
            ethDeposits[key] = 0;
            msg.sender.transfer(amount);
        } else {
            amount = key.executeVault(_fromToken, msg.sender);
        }

        emit OrderCancelled(
            key,
            address(_fromToken),
            address(_toToken),
            _minReturn,
            _fee,
            _owner,
            _salt,
            amount
        );
    }

    function executeOrder(
        IERC20 _fromToken,
        IERC20 _toToken,
        uint256 _minReturn,
        uint256 _fee,
        address payable _owner,
        bytes32 _salt
    ) external {
        bytes32 key = _keyOf(
            _fromToken,
            _toToken,
            _minReturn,
            _fee,
            _owner,
            _salt
        );

        // Pull amount
        uint256 amount = _pullOrder(_fromToken, key);
        require(amount > 0, "The order does not exists");

        uint256 bought;

        if (address(_fromToken) == ETH_ADDRESS) {
            // Keep some eth for paying the fee
            uint256 sell = amount.sub(_fee);
            bought = _ethToToken(uniswapFactory, _toToken, sell, _owner);
            msg.sender.transfer(_fee);
        } else if (address(_toToken) == ETH_ADDRESS) {
            // Convert
            bought = _tokenToEth(uniswapFactory, _fromToken, amount, address(this));
            bought = bought.sub(_fee);

            // Send fee and amount bought
            msg.sender.transfer(_fee);
            _owner.transfer(bought);
        } else {
            // Convert from fromToken to ETH
            uint256 boughtEth = _tokenToEth(uniswapFactory, _fromToken, amount, address(this));
            msg.sender.transfer(_fee);

            // Convert from ETH to toToken
            bought = _ethToToken(uniswapFactory, _toToken, boughtEth.sub(_fee), _owner);
        }

        require(bought >= _minReturn, "Tokens bought are not enough");

        emit OrderExecuted(
            key,
            address(_fromToken),
            address(_toToken),
            _minReturn,
            _fee,
            _owner,
            _salt,
            msg.sender,
            amount,
            bought
        );
    }

    function encodeTokenOrder(
        IERC20 _fromToken,
        IERC20 _toToken,
        uint256 _amount,
        uint256 _minReturn,
        uint256 _fee,
        address payable _owner,
        bytes32 _salt
    ) external view returns (bytes memory) {
        return abi.encodeWithSelector(
            _fromToken.transfer.selector,
            vaultOfOrder(
                _fromToken,
                _toToken,
                _minReturn,
                _fee,
                _owner,
                _salt
            ),
            _amount,
            abi.encode(
                _fromToken,
                _toToken,
                _minReturn,
                _fee,
                _owner,
                _salt
            )
        );
    }

    function encodeEthOrder(
        address _fromToken,
        address _toToken,
        uint256 _minReturn,
        uint256 _fee,
        address payable _owner,
        bytes32 _salt
    ) external pure returns (bytes memory) {
        return abi.encode(
            _fromToken,
            _toToken,
            _minReturn,
            _fee,
            _owner,
            _salt
        );
    }

    function decodeOrder(
        bytes calldata _data
    ) external pure returns (
        address fromToken,
        address toToken,
        uint256 minReturn,
        uint256 fee,
        address payable owner,
        bytes32 salt
    ) {
        (
            fromToken,
            toToken,
            minReturn,
            fee,
            owner,
            salt
        ) = abi.decode(
            _data,
            (address, address, uint256, uint256, address, bytes32)
        );
    }

    function existOrder(
        IERC20 _fromToken,
        IERC20 _toToken,
        uint256 _minReturn,
        uint256 _fee,
        address payable _owner,
        bytes32 _salt
    ) external view returns (bool) {
        bytes32 key = _keyOf(
            _fromToken,
            _toToken,
            _minReturn,
            _fee,
            _owner,
            _salt
        );

        if (address(_fromToken) == ETH_ADDRESS) {
            return ethDeposits[key] != 0;
        } else {
            return _fromToken.balanceOf(key.getVault()) != 0;
        }
    }

    function canExecuteOrder(
        IERC20 _fromToken,
        IERC20 _toToken,
        uint256 _minReturn,
        uint256 _fee,
        address payable _owner,
        bytes32 _salt
    ) external view returns (bool) {
        bytes32 key = _keyOf(
            _fromToken,
            _toToken,
            _minReturn,
            _fee,
            _owner,
            _salt
        );

        // Pull amount
        uint256 amount;
        if (address(_fromToken) == ETH_ADDRESS) {
            amount = ethDeposits[key];
        } else {
            amount = _fromToken.balanceOf(key.getVault());
        }

        uint256 bought;

        if (address(_fromToken) == ETH_ADDRESS) {
            uint256 sell = amount.sub(_fee);
            bought = uniswapFactory.getExchange(address(_toToken)).getEthToTokenInputPrice(sell);
        } else if (address(_toToken) == ETH_ADDRESS) {
            bought = uniswapFactory.getExchange(address(_fromToken)).getTokenToEthInputPrice(amount);
            bought = bought.sub(_fee);
        } else {
            uint256 boughtEth = uniswapFactory.getExchange(address(_fromToken)).getTokenToEthInputPrice(amount);
            bought = uniswapFactory.getExchange(address(_toToken)).getEthToTokenInputPrice(boughtEth.sub(_fee));
        }

        return bought >= _minReturn;
    }

    function vaultOfOrder(
        IERC20 _fromToken,
        IERC20 _toToken,
        uint256 _minReturn,
        uint256 _fee,
        address payable _owner,
        bytes32 _salt
    ) public view returns (address) {
        return _keyOf(
            _fromToken,
            _toToken,
            _minReturn,
            _fee,
            _owner,
            _salt
        ).getVault();
    }

    function _ethToToken(
        UniswapFactory _uniswapFactory,
        IERC20 _token,
        uint256 _amount,
        address _dest
    ) private returns (uint256) {
        UniswapExchange uniswap = _uniswapFactory.getExchange(address(_token));

        if (_dest != address(this)) {
            return uniswap.ethToTokenTransferInput.value(_amount)(1, never, _dest);
        } else {
            return uniswap.ethToTokenSwapInput.value(_amount)(1, never);
        }
    }

    function _tokenToEth(
        UniswapFactory _uniswapFactory,
        IERC20 _token,
        uint256 _amount,
        address _dest
    ) private returns (uint256) {
        UniswapExchange uniswap = _uniswapFactory.getExchange(address(_token));
        require(address(uniswap) != address(0), "The exchange should exist");

        // Check if previous allowance is enought and approve Uniswap if not
        uint256 prevAllowance = _token.allowance(address(this), address(uniswap));
        if (prevAllowance < _amount) {
            if (prevAllowance != 0) {
                _token.approve(address(uniswap), 0);
            }

            _token.approve(address(uniswap), uint(-1));
        }

        // Execute the trade
        if (_dest != address(this)) {
            return uniswap.tokenToEthTransferInput(_amount, 1, never, _dest);
        } else {
            return uniswap.tokenToEthSwapInput(_amount, 1, never);
        }
    }

    function _pullOrder(
        IERC20 _fromToken,
        bytes32 _key
    ) private returns (uint256 amount) {
        if (address(_fromToken) == ETH_ADDRESS) {
            amount = ethDeposits[_key];
            ethDeposits[_key] = 0;
        } else {
            amount = _key.executeVault(_fromToken, address(this));
        }
    }

    function _keyOf(
        IERC20 _fromToken,
        IERC20 _toToken,
        uint256 _minReturn,
        uint256 _fee,
        address payable _owner,
        bytes32 _salt
    ) private pure returns (bytes32) {
        return keccak256(
            abi.encode(
                _fromToken,
                _toToken,
                _minReturn,
                _fee,
                _owner,
                _salt
            )
        );
    }
}
