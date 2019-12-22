pragma solidity ^0.5.11;


import "./commons/SafeMath.sol";
import "./commons/SigUtils.sol";
import "./interfaces/IERC20.sol";
import "./interfaces/UniswapExchange.sol";
import "./interfaces/UniswapFactory.sol";
import "./libs/Fabric.sol";


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
        address _witness,
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
        address _witness,
        uint256 _amount
    );

    address public constant ETH_ADDRESS = address(0x00eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee);
    uint256 private constant never = uint(-1);

    UniswapFactory public uniswapFactory;

    mapping(bytes32 => uint256) public ethDeposits;

    constructor(UniswapFactory _uniswapFactory) public {
        uniswapFactory = _uniswapFactory;
    }

    function() external payable {require(msg.sender != tx.origin);}

    function depositEth(
        bytes calldata _data
    ) external payable {
        require(msg.value > 0, "No value provided");

        (
            address fromToken,
            address toToken,
            uint256 minReturn,
            uint256 fee,
            address payable owner,
            ,
            address witness
        ) = decodeOrder(_data);

        require(fromToken == ETH_ADDRESS, "order is not from ETH");

        bytes32 key = _keyOf(
            IERC20(fromToken),
            IERC20(toToken),
            minReturn,
            fee,
            owner,
            witness
        );

        ethDeposits[key] = ethDeposits[key].add(msg.value);
        emit DepositETH(key, msg.sender, msg.value, _data);
    }

    function cancelOrder(
        IERC20 _fromToken,
        IERC20 _toToken,
        uint256 _minReturn,
        uint256 _fee,
        address payable _owner,
        address _witness
    ) external {
        require(msg.sender == _owner, "Only the owner of the order can cancel it");
        bytes32 key = _keyOf(
            _fromToken,
            _toToken,
            _minReturn,
            _fee,
            _owner,
            _witness
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
            _witness,
            amount
        );
    }

    function executeOrder(
        IERC20 _fromToken,
        IERC20 _toToken,
        uint256 _minReturn,
        uint256 _fee,
        address payable _owner,
        bytes calldata _witnesses
    ) external {
        // Calculate witness using signature
        // avoid front-run by requiring msg.sender to know
        // the secret
        address witness = SigUtils.ecrecover2(
            keccak256(abi.encodePacked(msg.sender)),
            _witnesses
        );

        bytes32 key = _keyOf(
            _fromToken,
            _toToken,
            _minReturn,
            _fee,
            _owner,
            witness
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
            witness,
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
        bytes32 _secret,
        address _witness
    ) external view returns (bytes memory) {
        return abi.encodeWithSelector(
            _fromToken.transfer.selector,
            vaultOfOrder(
                _fromToken,
                _toToken,
                _minReturn,
                _fee,
                _owner,
                _witness
            ),
            _amount,
            abi.encode(
                _fromToken,
                _toToken,
                _minReturn,
                _fee,
                _owner,
                _secret,
                _witness
            )
        );
    }

    function encodeEthOrder(
        address _fromToken,
        address _toToken,
        uint256 _minReturn,
        uint256 _fee,
        address payable _owner,
        bytes32 _secret,
        address _witness
    ) external pure returns (bytes memory) {
        return abi.encode(
            _fromToken,
            _toToken,
            _minReturn,
            _fee,
            _owner,
            _secret,
            _witness
        );
    }

    function decodeOrder(
        bytes memory _data
    ) public pure returns (
        address fromToken,
        address toToken,
        uint256 minReturn,
        uint256 fee,
        address payable owner,
        bytes32 secret,
        address witness
    ) {
        (
            fromToken,
            toToken,
            minReturn,
            fee,
            owner,
            secret,
            witness
        ) = abi.decode(
            _data,
            (
                address,
                address,
                uint256,
                uint256,
                address,
                bytes32,
                address
            )
        );
    }

    function existOrder(
        IERC20 _fromToken,
        IERC20 _toToken,
        uint256 _minReturn,
        uint256 _fee,
        address payable _owner,
        address _witness
    ) external view returns (bool) {
        bytes32 key = _keyOf(
            _fromToken,
            _toToken,
            _minReturn,
            _fee,
            _owner,
            _witness
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
        address _witness
    ) external view returns (bool) {
        bytes32 key = _keyOf(
            _fromToken,
            _toToken,
            _minReturn,
            _fee,
            _owner,
            _witness
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
            if (amount <= _fee) {
                return false;
            }

            uint256 sell = amount.sub(_fee);
            bought = uniswapFactory.getExchange(address(_toToken)).getEthToTokenInputPrice(sell);
        } else if (address(_toToken) == ETH_ADDRESS) {
            bought = uniswapFactory.getExchange(address(_fromToken)).getTokenToEthInputPrice(amount);
            if (bought <= _fee) {
                return false;
            }

            bought = bought.sub(_fee);
        } else {
            uint256 boughtEth = uniswapFactory.getExchange(address(_fromToken)).getTokenToEthInputPrice(amount);
            if (boughtEth <= _fee) {
                return false;
            }

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
        address _witness
    ) public view returns (address) {
        return _keyOf(
            _fromToken,
            _toToken,
            _minReturn,
            _fee,
            _owner,
            _witness
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
        address _witness
    ) private pure returns (bytes32) {
        return keccak256(
            abi.encode(
                _fromToken,
                _toToken,
                _minReturn,
                _fee,
                _owner,
                _witness
            )
        );
    }
}
