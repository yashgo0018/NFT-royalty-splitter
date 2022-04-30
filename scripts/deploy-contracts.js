const hre = require("hardhat");

async function main() {
  const MetaverseAddress = await (await hre.ethers.getSigners())[1].getAddress();
  const NFT = await hre.ethers.getContractFactory("NFT");
  const nft = await NFT.deploy(MetaverseAddress);

  await nft.deployed();

  console.log("NFT deployed to:", nft.address);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
