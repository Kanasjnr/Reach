// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";

/// @notice Atomic push-payment router for Reach. Pulls the sender's token in a single
/// transaction and forwards it directly to the receiver and the treasury nothing is
/// ever held in this contract's own balance between transactions. No escrow, no claim
/// step: a send either fully succeeds or fully reverts.
contract Reach is ReentrancyGuard, Pausable, AccessControl {
    using SafeERC20 for IERC20;

    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    uint16 public constant MAX_FEE_BPS = 200; // hard cap: 2% — admin can never set fees above this

    /// @notice The settlement token (USDC on Arc).
    IERC20 public immutable token;

    address public treasury;
    uint16 public feeBps;
    uint256 public minAmount;

    event RemittanceSent(
        address indexed sender,
        address indexed receiver,
        uint256 grossAmount,
        uint256 fee,
        uint256 netAmount,
        bytes32 memo
    );
    event TreasuryUpdated(address indexed newTreasury);
    event FeeUpdated(uint16 newFeeBps);
    event MinAmountUpdated(uint256 newMinAmount);
    event TokensRescued(address indexed token, address indexed to, uint256 amount);

    error ZeroAddress();
    error InvalidReceiver(address receiver);
    error AmountTooSmall(uint256 amount, uint256 minAmount);
    error FeeTooHigh(uint16 requested, uint16 max);
    error FeeExceedsCallerMax(uint16 current, uint16 maxAccepted);

    constructor(
        address _token,
        address _treasury,
        uint16 _feeBps,
        uint256 _minAmount,
        address _admin
    ) {
        if (_token == address(0) || _treasury == address(0) || _admin == address(0)) {
            revert ZeroAddress();
        }
        if (_feeBps > MAX_FEE_BPS) revert FeeTooHigh(_feeBps, MAX_FEE_BPS);

        token = IERC20(_token);
        treasury = _treasury;
        feeBps = _feeBps;
        minAmount = _minAmount;

        _grantRole(DEFAULT_ADMIN_ROLE, _admin);
        _grantRole(ADMIN_ROLE, _admin);
    }

    /// @notice Send `amount` of `token` to `receiver` in one atomic transaction.
    /// @param maxFeeBps Caller's protection against the fee changing between when their
    /// wallet displayed a quote and when this transaction actually mines — reverts rather
    /// than silently charging more than the sender agreed to. Pass `type(uint16).max` to
    /// skip the check (accept whatever the live fee is) if the caller doesn't care.
    /// @dev Two direct transferFrom calls (net to receiver, fee to treasury) rather than
    /// routing through this contract's own balance — the contract never custodies funds,
    /// even momentarily. Reverts entirely if either leg fails; there is no partial send.
    function send(address receiver, uint256 amount, uint16 maxFeeBps, bytes32 memo)
        external
        whenNotPaused
        nonReentrant
    {
        if (receiver == address(0) || receiver == address(this)) {
            revert InvalidReceiver(receiver);
        }
        if (amount < minAmount) revert AmountTooSmall(amount, minAmount);
        if (feeBps > maxFeeBps) revert FeeExceedsCallerMax(feeBps, maxFeeBps);

        (uint256 fee, uint256 netAmount) = quote(amount);

        token.safeTransferFrom(msg.sender, receiver, netAmount);
        if (fee > 0) {
            token.safeTransferFrom(msg.sender, treasury, fee);
        }

        emit RemittanceSent(msg.sender, receiver, amount, fee, netAmount, memo);
    }

    /// @notice Preview the fee/net split for a given gross amount, without sending.
    /// Single source of truth for the fee formula — the frontend reads this instead of
    /// re-implementing the math client-side. Fee always rounds down, in the user's favor.
    function quote(uint256 amount) public view returns (uint256 fee, uint256 netAmount) {
        fee = (amount * feeBps) / 10_000;
        netAmount = amount - fee;
    }

    // --- admin: governance knobs, all capped or zero-address-guarded ---

    function setTreasury(address newTreasury) external onlyRole(ADMIN_ROLE) {
        if (newTreasury == address(0)) revert ZeroAddress();
        treasury = newTreasury;
        emit TreasuryUpdated(newTreasury);
    }

    function setFeeBps(uint16 newFeeBps) external onlyRole(ADMIN_ROLE) {
        if (newFeeBps > MAX_FEE_BPS) revert FeeTooHigh(newFeeBps, MAX_FEE_BPS);
        feeBps = newFeeBps;
        emit FeeUpdated(newFeeBps);
    }

    function setMinAmount(uint256 newMinAmount) external onlyRole(ADMIN_ROLE) {
        minAmount = newMinAmount;
        emit MinAmountUpdated(newMinAmount);
    }

    /// @dev Only ever gates new sends. Never blocks anything else, because there is
    /// nothing else to block — no escrow, no funds in flight to trap (see contract-level
    /// notice above).
    function pause() external onlyRole(ADMIN_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(ADMIN_ROLE) {
        _unpause();
    }

    /// @notice Recover ERC20 tokens that ended up at this contract's address by mistake
    /// (e.g. a raw wallet transfer instead of calling `send`). Not part of normal
    /// operation — `send` never leaves a balance here — this exists purely as a safety
    /// valve for user error, since a plain ERC20 transfer can't be blocked by this
    /// contract and would otherwise be permanently stuck.
    function rescueTokens(address tokenAddr, address to, uint256 amount)
        external
        onlyRole(ADMIN_ROLE)
    {
        if (to == address(0)) revert ZeroAddress();
        IERC20(tokenAddr).safeTransfer(to, amount);
        emit TokensRescued(tokenAddr, to, amount);
    }
}
