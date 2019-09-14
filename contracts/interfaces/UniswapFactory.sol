pragma solidity ^0.5.11;

import "./IERC20.sol";
import "./UniswapExchange.sol";


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
