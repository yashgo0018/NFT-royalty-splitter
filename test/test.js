const { expect, assert } = require("chai");
const { ethers } = require("hardhat");

describe("Greeter", function () {
  let nftContract, signers, accounts;

  before(async () => {
    signers = await ethers.getSigners();
    accounts = signers.map(s => s.address);
    const MetaverseAddress = accounts[1];
    const NFT = await ethers.getContractFactory("NFT");
    nftContract = await NFT.deploy(MetaverseAddress);
    await nftContract.deployed();
  });

  it("Should support erc165, erc721, erc2981 interfaces", async function () {
    const ERC165_INTERFACE_ID = "0x01ffc9a7";
    const ERC721_INTERFACE_ID = "0x80ac58cd";
    const ERC2981_INTERFACE_ID = "0x2a55205a";
    assert(await nftContract.supportsInterface(ERC165_INTERFACE_ID), "ERC165 Interface Id not supported");
    assert(await nftContract.supportsInterface(ERC721_INTERFACE_ID), "ERC721 Interface Id not supported");
    assert(await nftContract.supportsInterface(ERC2981_INTERFACE_ID), "ERC2981 Interface Id not supported");
  });

  it("Should not create pending nft if the user is not a celeb", async function () {
    await expect(nftContract.addPendingNFT("tokenUri", ethers.utils.parseEther("1")))
      .to.be.revertedWith("Only Celeb allowed");
  });

  it("Should not change status of the celeb if not owner", async function () {
    await expect(nftContract.connect(signers[1]).changeCelebStatus(accounts[2], true))
      .to.be.revertedWith("Ownable: caller is not the owner");
  });

  it("Should change the status of the celeb if owner", async function () {
    assert(!(await nftContract.isValidCeleb(accounts[2])), "initial celeb status should be false");
    await nftContract.changeCelebStatus(accounts[2], true);
    assert(await nftContract.isValidCeleb(accounts[2]), "final celeb status should be true");
  });

  it("Should create a pending nft id user is celeb", async function () {
    expect(Number(await nftContract.totalPendingNFTs())).to.equal(0);
    await nftContract.connect(signers[2]).addPendingNFT("tokenUri", ethers.utils.parseEther("1"));
    expect(Number(await nftContract.totalPendingNFTs())).to.equal(1);
    const { celeb, tokenURI, amount, minted } = await nftContract.pendingNFTs(0);
    expect(JSON.stringify({ celeb, tokenURI, amount, minted }))
      .to.equal(JSON.stringify({
        celeb: accounts[2],
        tokenURI: "tokenUri",
        amount: ethers.utils.parseEther("1"),
        minted: false
      }));
  });

  it("Should not mint the nft if the id is wrong", async function () {
    await expect(nftContract.safeMint(1)).to.be.revertedWith("NFT doesn't exist");
  });

  it("Should not mint the nft if the amount is wrong", async function () {
    await expect(nftContract.safeMint(0, { value: ethers.utils.parseEther("0.1") })).to.be.revertedWith("Invalid amount paid");
  });

  it("Should mint the nft", async function () {
    const initialBalanceOfMetaverse = await signers[1].getBalance();
    const initialBalanceOfCeleb = await signers[2].getBalance();
    await nftContract.safeMint(0, { value: ethers.utils.parseEther("1") });
    expect(await nftContract.ownerOf(0)).to.equal(accounts[0]);
    const finalBalanceOfMetaverse = await signers[1].getBalance();
    const finalBalanceOfCeleb = await signers[2].getBalance();
    expect(ethers.utils.formatEther(finalBalanceOfCeleb.sub(initialBalanceOfCeleb))).to.equal("0.3");
    expect(ethers.utils.formatEther(finalBalanceOfMetaverse.sub(initialBalanceOfMetaverse))).to.equal("0.7");
  });

  it("Should not mint if already minted", async function () {
    await expect(nftContract.safeMint(0, { value: ethers.utils.parseEther("1") })).to.be.revertedWith("NFT already minted");
  });

  it("Should split the payment sent to splitter contract between the metaverse and celeb equally", async function () {
    const { receiver, royaltyAmount } = await nftContract.royaltyInfo(0, ethers.utils.parseEther("1"));
    expect(ethers.utils.formatEther(royaltyAmount)).to.equal("0.05");
    const initialBalanceOfMetaverse = await signers[1].getBalance();
    const initialBalanceOfCeleb = await signers[2].getBalance();
    await signers[0].sendTransaction({ to: receiver, value: royaltyAmount });
    const finalBalanceOfMetaverse = await signers[1].getBalance();
    const finalBalanceOfCeleb = await signers[2].getBalance();
    expect(ethers.utils.formatEther(finalBalanceOfCeleb.sub(initialBalanceOfCeleb))).to.equal("0.025");
    expect(ethers.utils.formatEther(finalBalanceOfMetaverse.sub(initialBalanceOfMetaverse))).to.equal("0.025");
  });

  it("Should not split the payment after 1 year of minting", async function () {
    // increase the block.timestamp by 1 year
    await ethers.provider.send("evm_increaseTime", [365 * 24 * 3600]);

    // then send the transaction
    const { receiver, royaltyAmount } = await nftContract.royaltyInfo(0, ethers.utils.parseEther("1"));
    const initialBalanceOfMetaverse = await signers[1].getBalance();
    const initialBalanceOfCeleb = await signers[2].getBalance();
    await signers[0].sendTransaction({ to: receiver, value: royaltyAmount });
    const finalBalanceOfMetaverse = await signers[1].getBalance();
    const finalBalanceOfCeleb = await signers[2].getBalance();
    expect(ethers.utils.formatEther(finalBalanceOfCeleb.sub(initialBalanceOfCeleb))).to.equal("0.0");
    expect(ethers.utils.formatEther(finalBalanceOfMetaverse.sub(initialBalanceOfMetaverse))).to.equal("0.05");
  })
});
