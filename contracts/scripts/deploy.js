async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying with", deployer.address);

  const SimpleEscrow = await ethers.getContractFactory("SimpleEscrow");
  const escrow = await SimpleEscrow.deploy();
  await escrow.deployed();
  console.log("SimpleEscrow deployed to:", escrow.address);
}
main().catch((e)=>{ console.error(e); process.exit(1); });
