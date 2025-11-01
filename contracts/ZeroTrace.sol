// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {FHE, eaddress, externalEaddress} from "@fhevm/solidity/lib/FHE.sol";
import {SepoliaConfig} from "@fhevm/solidity/config/ZamaConfig.sol";

/**
 * @title ZeroTrace
 * @notice Stores encrypted travel itineraries per user using FHE for key protection.
 * @dev Each itinerary entry contains an encrypted location string and an encrypted
 *      ephemeral EVM address used by the frontend as the symmetric key.
 */
contract ZeroTrace is SepoliaConfig {
    struct LocationEntry {
        string dayTag;
        string encryptedLocation;
        eaddress encryptionKey;
        uint256 createdAt;
    }

    mapping(address => LocationEntry[]) private _entries;

    event LocationRecorded(address indexed user, uint256 indexed entryId, string dayTag, uint256 timestamp);

    /**
     * @notice Record a new encrypted itinerary entry.
     * @param dayTag Human-readable identifier for the day (e.g. "2025-02-01").
     * @param encryptedLocation Ciphertext of the location string encrypted by the frontend.
     * @param encryptedKey Encrypted ephemeral EVM address used to encrypt the itinerary string.
     * @param inputProof Zama relayer proof allowing the contract to import the encrypted key.
     */
    function recordLocation(
        string calldata dayTag,
        string calldata encryptedLocation,
        externalEaddress encryptedKey,
        bytes calldata inputProof
    ) external {
        eaddress storedKey = FHE.fromExternal(encryptedKey, inputProof);

        LocationEntry memory entry = LocationEntry({
            dayTag: dayTag,
            encryptedLocation: encryptedLocation,
            encryptionKey: storedKey,
            createdAt: block.timestamp
        });

        _entries[msg.sender].push(entry);

        FHE.allowThis(storedKey);
        FHE.allow(storedKey, msg.sender);

        emit LocationRecorded(msg.sender, _entries[msg.sender].length - 1, dayTag, block.timestamp);
    }

    /**
     * @notice Get the total itinerary entries for a user.
     * @param user Address whose entries are requested.
     * @return count Total number of itineraries stored.
     */
    function getLocationCount(address user) external view returns (uint256 count) {
        count = _entries[user].length;
    }

    /**
     * @notice Read a specific itinerary entry.
     * @param user Address whose entry is being read.
     * @param index Index of the entry to retrieve.
     * @return dayTag Human readable tag for the itinerary day.
     * @return encryptedLocation Ciphertext produced off-chain.
     * @return encryptionKey Encrypted ephemeral address handle.
     * @return createdAt Block timestamp when the entry was stored.
     */
    function getLocationEntry(
        address user,
        uint256 index
    )
        external
        view
        returns (string memory dayTag, string memory encryptedLocation, eaddress encryptionKey, uint256 createdAt)
    {
        require(index < _entries[user].length, "Invalid index");

        LocationEntry storage entry = _entries[user][index];
        return (entry.dayTag, entry.encryptedLocation, entry.encryptionKey, entry.createdAt);
    }
}
