const { ethers, upgrades } = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();

  console.log("Deployer address: ", deployer.address);

  console.log("Deployer balance: ", (await deployer.provider.getBalance(deployer.address)).toString());

  const GasBack = await ethers.getContractFactory("GasBack");

  const gasBack = await upgrades.deployProxy(GasBack, [], { initializer: 'initialize' });
  await gasBack.waitForDeployment();
  console.log("GasBack deployed at: ", await gasBack.getAddress());
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });