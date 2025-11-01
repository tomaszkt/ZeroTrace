import { FhevmType } from "@fhevm/hardhat-plugin";
import { task } from "hardhat/config";
import type { TaskArguments } from "hardhat/types";

task("task:address", "Prints the ZeroTraceDiary address").setAction(async function (_taskArguments: TaskArguments, hre) {
  const { deployments } = hre;

  const diary = await deployments.get("ZeroTraceDiary");

  console.log("ZeroTraceDiary address is " + diary.address);
});

task("task:count", "Returns the number of stored itineraries for the provided user")
  .addParam("user", "User address to query")
  .addOptionalParam("address", "Override contract address")
  .setAction(async function (taskArguments: TaskArguments, hre) {
    const { deployments, ethers } = hre;

    const diaryDeployment = taskArguments.address
      ? { address: taskArguments.address }
      : await deployments.get("ZeroTraceDiary");

    const contract = await ethers.getContractAt("ZeroTraceDiary", diaryDeployment.address);
    const count = await contract.getLocationCount(taskArguments.user);

    console.log(`Entries for ${taskArguments.user}: ${count}`);
  });

task("task:get-entry", "Reads one itinerary entry")
  .addParam("user", "User address to inspect")
  .addParam("index", "Entry index")
  .addOptionalParam("address", "Override contract address")
  .setAction(async function (taskArguments: TaskArguments, hre) {
    const { deployments, ethers } = hre;

    const diaryDeployment = taskArguments.address
      ? { address: taskArguments.address }
      : await deployments.get("ZeroTraceDiary");

    const contract = await ethers.getContractAt("ZeroTraceDiary", diaryDeployment.address);
    const entry = await contract.getLocationEntry(taskArguments.user, Number(taskArguments.index));

    console.log(`Day tag       : ${entry[0]}`);
    console.log(`Ciphertext    : ${entry[1]}`);
    console.log(`Encrypted key : ${entry[2]}`);
    console.log(`Stored at     : ${entry[3]}`);
  });

task("task:record-location", "Creates a new itinerary entry for the connected signer")
  .addParam("day", "Human-readable day tag, e.g. 2025-02-01")
  .addParam("cipher", "Encrypted location string")
  .addParam("key", "Ephemeral address used for encryption")
  .addOptionalParam("address", "Override contract address")
  .setAction(async function (taskArguments: TaskArguments, hre) {
    const { deployments, fhevm, ethers } = hre;

    const diaryDeployment = taskArguments.address
      ? { address: taskArguments.address }
      : await deployments.get("ZeroTraceDiary");

    await fhevm.initializeCLIApi();

    const signers = await ethers.getSigners();
    const signer = signers[0];

    const encryptedKey = await fhevm
      .createEncryptedInput(diaryDeployment.address, signer.address)
      .addAddress(taskArguments.key)
      .encrypt();

    const contract = await ethers.getContractAt("ZeroTraceDiary", diaryDeployment.address);
    const tx = await contract
      .connect(signer)
      .recordLocation(
        taskArguments.day,
        taskArguments.cipher,
        encryptedKey.handles[0],
        encryptedKey.inputProof,
      );

    console.log(`Submitted tx: ${tx.hash}`);
    const receipt = await tx.wait();
    console.log(`Status: ${receipt?.status}`);
  });

task("task:decrypt-key", "Decrypts an encrypted key handle for the caller")
  .addParam("handle", "Encrypted key handle returned by getLocationEntry")
  .addOptionalParam("address", "Override contract address")
  .setAction(async function (taskArguments: TaskArguments, hre) {
    const { deployments, fhevm, ethers } = hre;

    const diaryDeployment = taskArguments.address
      ? { address: taskArguments.address }
      : await deployments.get("ZeroTraceDiary");

    await fhevm.initializeCLIApi();

    const signers = await ethers.getSigners();
    const signer = signers[0];

    const decrypted = await fhevm.userDecrypt(
      FhevmType.eaddress,
      taskArguments.handle,
      diaryDeployment.address,
      signer,
    );

    console.log(`Decrypted address: ${decrypted}`);
  });
