// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IAccessControl} from "@openzeppelin/contracts/access/IAccessControl.sol";
import {Reach} from "../src/Reach.sol";

/// @dev Minimal 6-decimal ERC20 standing in for USDC on Arc.
contract MockUSDC is ERC20 {
    constructor() ERC20("Mock USDC", "USDC") {}

    function decimals() public pure override returns (uint8) {
        return 6;
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

contract ReachTest is Test {
    Reach rail;
    MockUSDC usdc;

    address admin = makeAddr("admin");
    address treasury = makeAddr("treasury");
    address sender = makeAddr("sender");
    address receiver = makeAddr("receiver");

    uint16 constant FEE_BPS = 50; // 0.50%
    uint256 constant MIN_AMOUNT = 1e6; // $1 USDC
    uint16 constant NO_FEE_CAP = type(uint16).max; // "accept whatever the live fee is"

    function setUp() public {
        usdc = new MockUSDC();
        rail = new Reach(address(usdc), treasury, FEE_BPS, MIN_AMOUNT, admin);

        usdc.mint(sender, 1_000e6);
        vm.prank(sender);
        usdc.approve(address(rail), type(uint256).max);
    }

    // --- happy path ---

    function test_send_movesNetToReceiverAndFeeToTreasury() public {
        uint256 amount = 200e6;
        (uint256 expectedFee, uint256 expectedNet) = rail.quote(amount);

        vm.prank(sender);
        rail.send(receiver, amount, NO_FEE_CAP, bytes32("corridor-a"));

        assertEq(usdc.balanceOf(receiver), expectedNet);
        assertEq(usdc.balanceOf(treasury), expectedFee);
        assertEq(usdc.balanceOf(sender), 1_000e6 - amount);
        assertEq(usdc.balanceOf(address(rail)), 0, "contract must never hold a balance");
    }

    function test_send_feeRoundsDownInUsersFavor() public view {
        // 101 * 50 / 10_000 = 0.505 -> truncates to 0, i.e. rounds down, never up
        (uint256 fee, uint256 net) = rail.quote(101);
        assertEq(fee, 0);
        assertEq(net, 101);
    }

    function test_send_emitsRemittanceSent() public {
        uint256 amount = 50e6;
        (uint256 fee, uint256 net) = rail.quote(amount);

        vm.expectEmit(true, true, false, true, address(rail));
        emit Reach.RemittanceSent(sender, receiver, amount, fee, net, bytes32("memo"));

        vm.prank(sender);
        rail.send(receiver, amount, NO_FEE_CAP, bytes32("memo"));
    }

    function test_send_succeedsExactlyAtMinAmountBoundary() public {
        vm.prank(sender);
        rail.send(receiver, MIN_AMOUNT, NO_FEE_CAP, bytes32(0)); // exactly at the floor, must not revert
        assertGt(usdc.balanceOf(receiver), 0);
    }

    // --- threat-table row: amount too small (dust-send griefing) ---

    function test_send_revertsBelowMinAmount() public {
        vm.prank(sender);
        vm.expectRevert(
            abi.encodeWithSelector(Reach.AmountTooSmall.selector, MIN_AMOUNT - 1, MIN_AMOUNT)
        );
        rail.send(receiver, MIN_AMOUNT - 1, NO_FEE_CAP, bytes32(0));
    }

    // --- threat-table row: zero address / self-address receiver ---

    function test_send_revertsOnZeroAddressReceiver() public {
        vm.prank(sender);
        vm.expectRevert(
            abi.encodeWithSelector(Reach.InvalidReceiver.selector, address(0))
        );
        rail.send(address(0), 10e6, NO_FEE_CAP, bytes32(0));
    }

    /// @dev Bug found during review: sending to the contract's own address used to be
    /// possible, and would leave funds recoverable only via admin-gated rescueTokens —
    /// a user's mistake becoming something only the admin could fix. Now rejected outright.
    function test_send_revertsWhenReceiverIsTheContractItself() public {
        vm.prank(sender);
        vm.expectRevert(
            abi.encodeWithSelector(Reach.InvalidReceiver.selector, address(rail))
        );
        rail.send(address(rail), 10e6, NO_FEE_CAP, bytes32(0));
    }

    // --- new: caller's fee-cap protection (quote-to-execution race) ---

    /// @dev Bug found during review: send() used to read feeBps live with no way for the
    /// caller to bound it — a fee change between a wallet's displayed quote and the
    /// transaction actually mining would silently charge whatever was live at execution.
    function test_send_revertsWhenLiveFeeExceedsCallerMax() public {
        vm.prank(admin);
        rail.setFeeBps(100); // fee moves to 1% after the user "saw" 0.5% in their wallet

        vm.prank(sender);
        vm.expectRevert(
            abi.encodeWithSelector(Reach.FeeExceedsCallerMax.selector, uint16(100), FEE_BPS)
        );
        rail.send(receiver, 50e6, FEE_BPS, bytes32(0)); // caller still only accepts 0.5%
    }

    function test_send_succeedsWhenLiveFeeEqualsCallerMax() public {
        vm.prank(sender);
        rail.send(receiver, 50e6, FEE_BPS, bytes32(0)); // exactly at the boundary, must not revert
        assertGt(usdc.balanceOf(receiver), 0);
    }

    // --- threat-table row: fee-rug via admin (hardcoded cap) ---

    function test_setFeeBps_revertsAboveHardcodedCap() public {
        // Cache the view call before expectRevert/prank — calling rail.MAX_FEE_BPS()
        // here would itself be "the next call" and silently consume the prank below.
        uint16 cap = rail.MAX_FEE_BPS();
        vm.expectRevert(abi.encodeWithSelector(Reach.FeeTooHigh.selector, cap + 1, cap));
        vm.prank(admin);
        rail.setFeeBps(cap + 1);
    }

    function test_constructor_revertsAboveHardcodedFeeCap() public {
        vm.expectRevert(
            abi.encodeWithSelector(Reach.FeeTooHigh.selector, 201, 200)
        );
        new Reach(address(usdc), treasury, 201, MIN_AMOUNT, admin);
    }

    // --- threat-table row: admin-only governance functions ---

    function test_setFeeBps_revertsForNonAdmin() public {
        bytes32 role = rail.ADMIN_ROLE(); // cached first — see note in the cap test above
        vm.expectRevert(
            abi.encodeWithSelector(IAccessControl.AccessControlUnauthorizedAccount.selector, sender, role)
        );
        vm.prank(sender);
        rail.setFeeBps(100);
    }

    function test_pause_revertsForNonAdmin() public {
        bytes32 role = rail.ADMIN_ROLE();
        vm.expectRevert(
            abi.encodeWithSelector(IAccessControl.AccessControlUnauthorizedAccount.selector, sender, role)
        );
        vm.prank(sender);
        rail.pause();
    }

    // --- threat-table row: pause only ever gates new sends ---

    function test_pause_blocksNewSends() public {
        vm.prank(admin);
        rail.pause();

        vm.prank(sender);
        vm.expectRevert();
        rail.send(receiver, 10e6, NO_FEE_CAP, bytes32(0));
    }

    function test_unpause_restoresSending() public {
        vm.prank(admin);
        rail.pause();
        vm.prank(admin);
        rail.unpause();

        vm.prank(sender);
        rail.send(receiver, 10e6, NO_FEE_CAP, bytes32(0)); // does not revert
        assertGt(usdc.balanceOf(receiver), 0);
    }

    // --- threat-table row: insufficient allowance/balance must revert, not partially send ---

    function test_send_revertsOnInsufficientAllowance() public {
        vm.prank(sender);
        usdc.approve(address(rail), 5e6); // less than amount below

        vm.prank(sender);
        vm.expectRevert();
        rail.send(receiver, 10e6, NO_FEE_CAP, bytes32(0));

        assertEq(usdc.balanceOf(receiver), 0, "no partial send on revert");
    }

    // --- rescueTokens: recovering funds mistakenly sent directly to the contract ---

    function test_rescueTokens_recoversAccidentalDirectTransfer() public {
        // Someone sends USDC straight to the contract, bypassing send() entirely —
        // the contract has no way to prevent this (a plain ERC20 transfer doesn't
        // call back into the recipient), so it must be recoverable, not stuck forever.
        vm.prank(sender);
        usdc.transfer(address(rail), 25e6);
        assertEq(usdc.balanceOf(address(rail)), 25e6);

        vm.prank(admin);
        rail.rescueTokens(address(usdc), treasury, 25e6);

        assertEq(usdc.balanceOf(address(rail)), 0);
        assertEq(usdc.balanceOf(treasury), 25e6);
    }

    function test_rescueTokens_revertsForNonAdmin() public {
        bytes32 role = rail.ADMIN_ROLE();
        vm.expectRevert(
            abi.encodeWithSelector(IAccessControl.AccessControlUnauthorizedAccount.selector, sender, role)
        );
        vm.prank(sender);
        rail.rescueTokens(address(usdc), sender, 1e6);
    }

    function test_rescueTokens_revertsOnZeroAddressDestination() public {
        vm.prank(admin);
        vm.expectRevert(Reach.ZeroAddress.selector);
        rail.rescueTokens(address(usdc), address(0), 1e6);
    }

    // --- fuzz: quote() never lets fee exceed the gross amount, for any feeBps up to the cap ---

    function testFuzz_quote_feePlusNetAlwaysEqualsGross(uint256 amount, uint16 fee) public {
        amount = bound(amount, 0, 1_000_000_000e6);
        fee = uint16(bound(fee, 0, rail.MAX_FEE_BPS()));

        vm.prank(admin);
        rail.setFeeBps(fee);

        (uint256 f, uint256 net) = rail.quote(amount);
        assertEq(f + net, amount, "fee + net must always reconstruct the gross amount exactly");
        assertLe(f, amount, "fee can never exceed the amount sent");
    }

    // --- fuzz: send() never succeeds when the live fee exceeds what the caller accepted ---

    function testFuzz_send_neverExceedsCallerAcceptedFee(uint16 liveFee, uint16 callerMax) public {
        liveFee = uint16(bound(liveFee, 0, rail.MAX_FEE_BPS()));
        callerMax = uint16(bound(callerMax, 0, rail.MAX_FEE_BPS()));

        vm.prank(admin);
        rail.setFeeBps(liveFee);

        vm.prank(sender);
        if (liveFee > callerMax) {
            vm.expectRevert(
                abi.encodeWithSelector(Reach.FeeExceedsCallerMax.selector, liveFee, callerMax)
            );
            rail.send(receiver, 100e6, callerMax, bytes32(0));
        } else {
            rail.send(receiver, 100e6, callerMax, bytes32(0)); // must not revert
        }
    }
}
