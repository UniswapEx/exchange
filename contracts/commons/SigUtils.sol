pragma solidity ^0.5.5;


library SigUtils {
    /**
      @dev Recovers address who signed the message
      @param _hash operation ethereum signed message hash
      @param _signature message `hash` signature
    */
    function ecrecover2 (
        bytes32 _hash,
        bytes memory _signature
    ) internal pure returns (address) {
        bytes32 r;
        bytes32 s;
        uint8 v;

        assembly {
            r := mload(add(_signature, 32))
            s := mload(add(_signature, 64))
            v := and(mload(add(_signature, 65)), 255)
        }

        if (v < 27) {
            v += 27;
        }

        return ecrecover(
            _hash,
            v,
            r,
            s
        );
    }
}
