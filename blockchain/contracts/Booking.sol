// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract BookingContract {
    struct Booking {
        address user;
        string guestName;
        string roomName;
        uint256 checkIn;
        uint256 checkOut;
        uint256 total;
    }

    event BookingCreated(
        address indexed user,
        string guestName,
        string roomName,
        uint256 checkIn,
        uint256 checkOut,
        uint256 total
    );

    function createBooking(
        string calldata guestName,
        string calldata roomName,
        uint256 checkIn,
        uint256 checkOut,
        uint256 total
    ) external {
        emit BookingCreated(msg.sender, guestName, roomName, checkIn, checkOut, total);
    }
}