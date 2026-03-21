const { expect } = require("chai");

const hashText = (value) => ethers.utils.keccak256(ethers.utils.toUtf8Bytes(value));

const bookingPayload = {
  guestNameHash: hashText("Guest"),
  roomNameHash: hashText("Standard Room"),
  checkIn: 1711000000,
  checkOut: 1711086400,
  total: 1500,
  bookingRef: ethers.utils.solidityKeccak256(
    ["bytes32", "bytes32", "uint64", "uint64", "uint128"],
    [hashText("Guest"), hashText("Standard Room"), 1711000000, 1711086400, 1500]
  ),
};

describe("BookingContract", function () {
  async function deployFixture() {
    const [owner, recorder, attacker] = await ethers.getSigners();
    const Booking = await ethers.getContractFactory("BookingContract");
    const contract = await Booking.deploy();
    await contract.deployed();
    return { contract, owner, recorder, attacker };
  }

  it("authorizes deployer as recorder by default", async function () {
    const { contract, owner } = await deployFixture();
    expect(await contract.owner()).to.equal(owner.address);
    expect(await contract.authorizedRecorders(owner.address)).to.equal(true);
  });

  it("allows owner to set recorder", async function () {
    const { contract, recorder } = await deployFixture();
    await expect(contract.setRecorder(recorder.address, true))
      .to.emit(contract, "RecorderAuthorizationUpdated")
      .withArgs(recorder.address, true);
    expect(await contract.authorizedRecorders(recorder.address)).to.equal(true);
  });

  it("rejects non-owner recorder updates", async function () {
    const { contract, attacker, recorder } = await deployFixture();
    await expect(contract.connect(attacker).setRecorder(recorder.address, true)).to.be.reverted;
  });

  it("rejects booking creation from unauthorized address", async function () {
    const { contract, attacker } = await deployFixture();
    await expect(
      contract.connect(attacker).createBooking(
        bookingPayload.guestNameHash,
        bookingPayload.roomNameHash,
        bookingPayload.checkIn,
        bookingPayload.checkOut,
        bookingPayload.total,
        bookingPayload.bookingRef
      )
    ).to.be.reverted;
  });

  it("rejects invalid booking payloads", async function () {
    const { contract } = await deployFixture();
    await expect(contract.createBooking(ethers.constants.HashZero, bookingPayload.roomNameHash, bookingPayload.checkIn, bookingPayload.checkOut, bookingPayload.total, bookingPayload.bookingRef)).to.be.reverted;
    await expect(contract.createBooking(bookingPayload.guestNameHash, ethers.constants.HashZero, bookingPayload.checkIn, bookingPayload.checkOut, bookingPayload.total, bookingPayload.bookingRef)).to.be.reverted;
    await expect(contract.createBooking(bookingPayload.guestNameHash, bookingPayload.roomNameHash, bookingPayload.checkOut, bookingPayload.checkOut, bookingPayload.total, bookingPayload.bookingRef)).to.be.reverted;
    await expect(contract.createBooking(bookingPayload.guestNameHash, bookingPayload.roomNameHash, bookingPayload.checkOut, bookingPayload.checkIn, bookingPayload.total, bookingPayload.bookingRef)).to.be.reverted;
    await expect(contract.createBooking(bookingPayload.guestNameHash, bookingPayload.roomNameHash, bookingPayload.checkIn, bookingPayload.checkOut, 0, bookingPayload.bookingRef)).to.be.reverted;
    await expect(contract.createBooking(bookingPayload.guestNameHash, bookingPayload.roomNameHash, bookingPayload.checkIn, bookingPayload.checkOut, bookingPayload.total, ethers.constants.HashZero)).to.be.reverted;
  });

  it("emits booking event and tracks gas", async function () {
    const { contract } = await deployFixture();
    const guestNameHash = hashText("Alice");
    const roomNameHash = hashText("Deluxe Room");
    const checkIn = 1711000000;
    const checkOut = 1711086400;
    const total = 2800;
    const bookingRef = ethers.utils.solidityKeccak256(
      ["bytes32", "bytes32", "uint64", "uint64", "uint128"],
      [guestNameHash, roomNameHash, checkIn, checkOut, total]
    );
    const tx = await contract.createBooking(guestNameHash, roomNameHash, checkIn, checkOut, total, bookingRef);
    const receipt = await tx.wait();

    const event = receipt.events.find((e) => e.event === "BookingCreated");
    expect(event).to.not.equal(undefined);
    expect(event.args.guestNameHash).to.equal(guestNameHash);
    expect(event.args.roomNameHash).to.equal(roomNameHash);

    // Reduced gas target after replacing dynamic string logs with compact hashes.
    expect(receipt.gasUsed.toNumber()).to.be.lessThan(70000);
  });
});
