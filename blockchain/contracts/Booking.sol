// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract BookingContract {
    error NotOwner();
    error NotAuthorizedRecorder();
    error InvalidInput();

    address public owner;
    mapping(address => bool) public authorizedRecorders;

    event BookingCreated(
        address indexed recorder,
        bytes32 indexed guestNameHash,
        bytes32 indexed roomNameHash,
        uint64 checkIn,
        uint64 checkOut,
        uint128 total,
        bytes32 bookingRef
    );

    event RecorderAuthorizationUpdated(address indexed recorder, bool allowed);

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    modifier onlyAuthorizedRecorder() {
        if (!authorizedRecorders[msg.sender]) revert NotAuthorizedRecorder();
        _;
    }

    constructor() {
        owner = msg.sender;
        authorizedRecorders[msg.sender] = true;
        emit RecorderAuthorizationUpdated(msg.sender, true);
    }

    function setRecorder(address recorder, bool allowed) external onlyOwner {
        if (recorder == address(0)) revert InvalidInput();
        authorizedRecorders[recorder] = allowed;
        emit RecorderAuthorizationUpdated(recorder, allowed);
    }

    function createBooking(
        bytes32 guestNameHash,
        bytes32 roomNameHash,
        uint64 checkIn,
        uint64 checkOut,
        uint128 total,
        bytes32 bookingRef
    ) external onlyAuthorizedRecorder {
        if (guestNameHash == bytes32(0) || roomNameHash == bytes32(0) || bookingRef == bytes32(0)) revert InvalidInput();
        if (checkOut <= checkIn || total == 0) revert InvalidInput();

        emit BookingCreated(msg.sender, guestNameHash, roomNameHash, checkIn, checkOut, total, bookingRef);
    }
}