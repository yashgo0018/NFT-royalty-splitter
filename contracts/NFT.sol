// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Counters.sol";
import "./Splitter.sol";

contract NFT is ERC721, ERC721URIStorage, Ownable {
    using Counters for Counters.Counter;

    Counters.Counter private _tokenIdCounter;

    struct PendingNFT {
        address celeb;
        string tokenURI;
        uint256 amount;
        bool minted;
    }

    address public metaverse;

    uint256 public totalPendingNFTs;

    mapping(address => bool) public isValidCeleb; // address of the celeb => isCeleb
    mapping(uint256 => Splitter) royaltyReceiver;
    mapping(uint256 => PendingNFT) public pendingNFTs;

    event CelebStatusChanged(address celeb, bool status);
    event PendingNFTAdded(
        uint256 id,
        address celeb,
        string tokenURI,
        uint256 amount
    );
    event PendingNFTMinted(uint256 id);

    constructor(address _metaverse) ERC721("MyToken", "MTK") {
        metaverse = _metaverse;
    }

    modifier onlyCeleb() {
        require(isValidCeleb[msg.sender], "Only Celeb allowed");
        _;
    }

    function changeCelebStatus(address _celeb, bool _status)
        external
        onlyOwner
    {
        isValidCeleb[_celeb] = _status;
        emit CelebStatusChanged(_celeb, _status);
    }

    function addPendingNFT(string memory uri, uint256 amount) public onlyCeleb {
        uint256 nftId = totalPendingNFTs++;
        pendingNFTs[nftId] = PendingNFT(msg.sender, uri, amount, false);
        emit PendingNFTAdded(nftId, msg.sender, uri, amount);
    }

    function safeMint(uint256 pendingNftId) public payable {
        require(totalPendingNFTs > pendingNftId, "NFT doesn't exist");
        PendingNFT storage nft = pendingNFTs[pendingNftId];
        require(!nft.minted, "NFT already minted");
        require(nft.amount == msg.value, "Invalid amount paid");

        // mint the nft
        uint256 tokenId = _tokenIdCounter.current();
        _tokenIdCounter.increment();
        _safeMint(msg.sender, tokenId);
        _setTokenURI(tokenId, nft.tokenURI);

        // set the pending nfts status to minted
        nft.minted = true;

        // create a royalty splitter contract
        royaltyReceiver[tokenId] = new Splitter(
            nft.celeb,
            metaverse,
            (356 * 24 * 3600), // 1 year split for secondary sales royality
            5000 // 50% split
        );

        // transfer the primary sales revenue in 30-70 split
        payable(nft.celeb).transfer((msg.value * 30) / 100);
        payable(metaverse).transfer((msg.value * 70) / 100);

        // emit the pending nft minted event
        emit PendingNFTMinted(pendingNftId);
    }

    // The following functions are overrides required by Solidity.

    function _burn(uint256 tokenId)
        internal
        override(ERC721, ERC721URIStorage)
    {
        super._burn(tokenId);
    }

    function tokenURI(uint256 tokenId)
        public
        view
        override(ERC721, ERC721URIStorage)
        returns (string memory)
    {
        return super.tokenURI(tokenId);
    }

    function royaltyInfo(uint256 _tokenId, uint256 _salePrice)
        external
        view
        returns (address receiver, uint256 royaltyAmount)
    {
        require(_exists(_tokenId), "Token not found");
        receiver = address(royaltyReceiver[_tokenId]);
        // set the royalty amount to 5% of the sales amount
        royaltyAmount = (_salePrice * 5) / 100;
    }
}
