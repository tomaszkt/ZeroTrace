import { DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployer } = await hre.getNamedAccounts();
  const { deploy } = hre.deployments;

  const deployedDiary = await deploy("ZeroTrace", {
    from: deployer,
    log: true,
  });

  console.log(`ZeroTrace contract: `, deployedDiary.address);
};
export default func;
func.id = "deploy_zeroTrace"; // id required to prevent reexecution
func.tags = ["ZeroTrace"];
