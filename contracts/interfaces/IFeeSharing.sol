// SPDX-License-Identifier: MIT
pragma solidity ^0.6.5;

interface IFeeSharing {
    function register(address _recipient) external returns (uint256 tokenId);

    function assign(uint256 _tokenId) external returns (uint256);
}
