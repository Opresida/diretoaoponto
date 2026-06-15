// SPDX-License-Identifier: MIT
// PROMPT §13.3 — Contrato mínimo de ancoragem por Merkle root na Base.
pragma solidity ^0.8.24;

contract AnchorRegistry {
    event Anchored(bytes32 indexed root, uint256 count, uint256 timestamp);
    address public immutable institute;

    constructor() {
        institute = msg.sender;
    }

    function anchor(bytes32 root, uint256 count) external {
        require(msg.sender == institute, "unauthorized");
        emit Anchored(root, count, block.timestamp);
    }
}
