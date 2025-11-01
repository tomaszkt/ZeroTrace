import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { ethers, fhevm, deployments } from "hardhat";
import { expect } from "chai";
import { FhevmType } from "@fhevm/hardhat-plugin";

describe("ZeroTraceDiarySepolia", function () {
  let signer: HardhatEthersSigner;
  let contractAddress: string;
  let step = 0;
  let steps = 0;

  function progress(message: string) {
    console.log(`${++step}/${steps} ${message}`);
  }

  before(async function () {
    if (fhevm.isMock) {
      console.warn("ZeroTraceDiary Sepolia tests require the Sepolia network");
      this.skip();
    }

    try {
      const deployment = await deployments.get("ZeroTraceDiary");
      contractAddress = deployment.address;
    } catch (error) {
      (error as Error).message += ". Deploy with 'npx hardhat deploy --network sepolia'";
      throw error;
    }

    [signer] = await ethers.getSigners();
  });

  beforeEach(async function () {
    step = 0;
    steps = 0;
  });

  it("records and decrypts a location entry", async function () {
    steps = 8;
    this.timeout(4 * 40000);

    const wallet = ethers.Wallet.createRandom();
    const dayTag = "2025-02-03";
    const ciphertext = "cipher::commute";

    progress("Encrypting ephemeral address...");
    const encrypted = await fhevm
      .createEncryptedInput(contractAddress, signer.address)
      .addAddress(wallet.address)
      .encrypt();

    progress("Sending recordLocation transaction...");
    const contract = await ethers.getContractAt("ZeroTraceDiary", contractAddress);
    const tx = await contract
      .connect(signer)
      .recordLocation(dayTag, ciphertext, encrypted.handles[0], encrypted.inputProof);
    await tx.wait();

    progress("Fetching entry data...");
    const entry = await contract.getLocationEntry(signer.address, 0);

    progress("Decrypting encrypted key...");
    const decrypted = await fhevm.userDecrypt(FhevmType.eaddress, entry[2], contractAddress, signer);
    expect(decrypted).to.eq(wallet.address);

    progress("Checking stored metadata...");
    expect(entry[0]).to.eq(dayTag);
    expect(entry[1]).to.eq(ciphertext);
    expect(entry[3]).to.be.gt(0);

    progress("Verifying count...");
    const count = await contract.getLocationCount(signer.address);
    expect(count).to.be.gte(1);
  });
});
