import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { ethers, fhevm } from "hardhat";
import { expect } from "chai";
import { ZeroTraceDiary, ZeroTraceDiary__factory } from "../types";
import { FhevmType } from "@fhevm/hardhat-plugin";

type Fixture = {
  contract: ZeroTraceDiary;
  contractAddress: string;
};

async function deployFixture(): Promise<Fixture> {
  const factory = (await ethers.getContractFactory("ZeroTraceDiary")) as ZeroTraceDiary__factory;
  const contract = (await factory.deploy()) as ZeroTraceDiary;
  const address = await contract.getAddress();

  return { contract, contractAddress: address };
}

describe("ZeroTraceDiary", function () {
  let signer: HardhatEthersSigner;
  let fixture: Fixture;

  before(async function () {
    [signer] = await ethers.getSigners();
  });

  beforeEach(async function () {
    if (!fhevm.isMock) {
      console.warn("ZeroTraceDiary unit tests require the local FHEVM mock");
      this.skip();
    }

    fixture = await deployFixture();
  });

  it("starts with no entries for a user", async function () {
    const count = await fixture.contract.getLocationCount(signer.address);
    expect(count).to.eq(0);
  });

  it("stores itinerary entries with encrypted keys", async function () {
    const wallet = ethers.Wallet.createRandom();
    const dayTag = "2025-02-03";
    const ciphertext = "cipher::morning-commute";

    const encrypted = await fhevm
      .createEncryptedInput(fixture.contractAddress, signer.address)
      .addAddress(wallet.address)
      .encrypt();

    const tx = await fixture.contract
      .connect(signer)
      .recordLocation(dayTag, ciphertext, encrypted.handles[0], encrypted.inputProof);

    await tx.wait();

    const count = await fixture.contract.getLocationCount(signer.address);
    expect(count).to.eq(1);

    const entry = await fixture.contract.getLocationEntry(signer.address, 0);
    expect(entry[0]).to.eq(dayTag);
    expect(entry[1]).to.eq(ciphertext);
    expect(entry[3]).to.be.gt(0);

    const decryptedKey = await fhevm.userDecrypt(
      FhevmType.eaddress,
      entry[2],
      fixture.contractAddress,
      signer,
    );

    expect(decryptedKey).to.eq(wallet.address);
  });
});
