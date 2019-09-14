pragma solidity ^0.5.11;


import "../../contracts/interfaces/IERC20.sol";
import "../../contracts/libs/Fabric.sol";


contract VaultFactory {
    using Fabric for bytes32;

    function getVault(bytes32  _data) public view returns (address) {
        return _data.getVault();
    }

    function executeVault(bytes32 _data, IERC20 _token, address _to) public {
        _data.executeVault(_token, _to);
    }
}
