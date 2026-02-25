async function main() {
  const Booking = await ethers.getContractFactory("BookingContract");
  const booking = await Booking.deploy();
  await booking.deployed();
  console.log("BookingContract deployed to:", booking.address);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});