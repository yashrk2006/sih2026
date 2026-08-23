// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * DocumentIntegrity — Immutable Hash Anchoring Contract
 *
 * Purpose: Provide a tamper-evident, immutable record that a specific
 * document hash existed at a specific point in time.
 *
 * IMPORTANT:
 * - Only SHA-256 hashes are stored. No document content, filenames, or PII.
 * - Once anchored, a hash cannot be removed or modified.
 * - This contract provides INTEGRITY PROOF, not document storage.
 *
 * Usage:
 *   anchorHash(bytes32 documentHash)    → anchor a hash
 *   isAnchored(bytes32 documentHash)    → check if anchored
 *   getAnchorTimestamp(bytes32)         → get anchor timestamp
 */
contract DocumentIntegrity {
    // Mapping from hash → timestamp of anchoring (0 = not anchored)
    mapping(bytes32 => uint256) private anchorTimestamps;

    // Mapping from hash → address that anchored it
    mapping(bytes32 => address) private anchoredBy;

    // Events
    event HashAnchored(bytes32 indexed documentHash, address indexed anchoredBy, uint256 timestamp);

    // Authorized anchors (only registered system accounts can anchor)
    mapping(address => bool) private authorizedAnchors;
    address public owner;

    modifier onlyOwner() {
        require(msg.sender == owner, "Not authorized: owner only");
        _;
    }

    modifier onlyAuthorized() {
        require(
            authorizedAnchors[msg.sender] || msg.sender == owner,
            "Not authorized to anchor hashes"
        );
        _;
    }

    constructor() {
        owner = msg.sender;
        authorizedAnchors[msg.sender] = true;
    }

    /**
     * @dev Add an authorized anchor account (system wallet).
     */
    function addAuthorizedAnchor(address account) external onlyOwner {
        authorizedAnchors[account] = true;
    }

    /**
     * @dev Anchor a document hash. Can only be done once per hash.
     * @param documentHash SHA-256 hash of the document (as bytes32)
     */
    function anchorHash(bytes32 documentHash) external onlyAuthorized {
        require(documentHash != bytes32(0), "Zero hash not allowed");
        // Allow re-anchoring (idempotent) — the first timestamp is preserved
        if (anchorTimestamps[documentHash] == 0) {
            anchorTimestamps[documentHash] = block.timestamp;
            anchoredBy[documentHash] = msg.sender;
            emit HashAnchored(documentHash, msg.sender, block.timestamp);
        }
    }

    /**
     * @dev Check if a hash has been anchored.
     * @param documentHash SHA-256 hash to check
     * @return true if anchored
     */
    function isAnchored(bytes32 documentHash) external view returns (bool) {
        return anchorTimestamps[documentHash] != 0;
    }

    /**
     * @dev Get the timestamp when a hash was anchored.
     * @param documentHash SHA-256 hash to check
     * @return Unix timestamp (0 if not anchored)
     */
    function getAnchorTimestamp(bytes32 documentHash) external view returns (uint256) {
        return anchorTimestamps[documentHash];
    }

    /**
     * @dev Get the address that anchored a hash.
     */
    function getAnchoredBy(bytes32 documentHash) external view returns (address) {
        return anchoredBy[documentHash];
    }
}
