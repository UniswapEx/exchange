pragma solidity ^0.5.11;

import "../interfaces/IERC20.sol";


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