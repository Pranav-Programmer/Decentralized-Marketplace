// contracts/scripts/deploy.js
const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying with", await deployer.getAddress());

  const SimpleEscrow = await hre.ethers.getContractFactory("SimpleEscrow");
  const escrow = await SimpleEscrow.deploy();

  // wait for the deployment to be mined (ethers v6)
  await escrow.waitForDeployment();

  // getAddress() returns the contract address (ethers v6)
  const address = await escrow.getAddress();
  console.log("SimpleEscrow deployed to:", address);
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
