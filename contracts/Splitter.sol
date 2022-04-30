// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

contract Splitter {
    address celeb;
    address metaverse;
    uint256 timeLimit;
    uint256 celebPercentage;

    constructor(
        address _celeb,
        address _metaverse,
        uint256 duration,
        uint256 _celebPercentage
    ) {
        celeb = _celeb;
        metaverse = _metaverse;
        timeLimit = block.timestamp + duration;
        celebPercentage = _celebPercentage;
    }

    receive() external payable {
        if (timeLimit > block.timestamp) {
            payable(celeb).transfer((msg.value * celebPercentage) / 10000);
        }
        payable(metaverse).transfer(address(this).balance);
    }
}
