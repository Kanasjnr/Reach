// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IAccessControl} from "@openzeppelin/contracts/access/IAccessControl.sol";
import {Reach} from "../src/Reach.sol";

/// @dev Minimal 6-decimal ERC20 standing in for USDC or EURC on Arc — both are
/// Circle-issued, standard, 6-decimal stablecoins, so one mock shape covers both.
contract MockStablecoin is ERC20 {
    constructor(string memory name, string memory symbol) ERC20(name, symbol) {}

    function decimals() public pure override returns (uint8) {
        return 6;
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

contract ReachTest is Test {
    Reach rail;
    MockStablecoin usdc;
    MockStablecoin eurc;
    MockStablecoin notAllowed; // a token deliberately never added to the allowlist

    address admin = makeAddr("admin");
    address treasury = makeAddr("treasury");
    address sender = makeAddr("sender");
    address receiver = makeAddr("receiver");

    uint16 constant FEE_BPS = 50; // 0.50%
    uint256 constant MIN_AMOUNT = 1e6; // $1-equivalent
    uint16 constant NO_FEE_CAP = type(uint16).max; // "accept whatever the live fee is"

    function setUp() public {
        usdc = new MockStablecoin("Mock USDC", "USDC");
        eurc = new MockStablecoin("Mock EURC", "EURC");
        notAllowed = new MockStablecoin("Sketchy Token", "SKETCH");

        address[] memory initialTokens = new address[](2);
        initialTokens[0] = address(usdc);
        initialTokens[1] = address(eurc);
        rail = new Reach(initialTokens, treasury, FEE_BPS, MIN_AMOUNT, admin);

        usdc.mint(sender, 1_000e6);
        eurc.mint(sender, 1_000e6);
        notAllowed.mint(sender, 1_000e6);

        vm.startPrank(sender);
        usdc.approve(address(rail), type(uint256).max);
        eurc.approve(address(rail), type(uint256).max);
        notAllowed.approve(address(rail), type(uint256).max);
        vm.stopPrank();
    }

    // --- happy path, per allowed token ---

    function test_send_movesNetToReceiverAndFeeToTreasury_forUSDC() public {
        _assertSendWorks(usdc, 200e6);
    }

    function test_send_movesNetToReceiverAndFeeToTreasury_forEURC() public {
        _assertSendWorks(eurc, 80e6);
    }

    function _assertSendWorks(MockStablecoin tok, uint256 amount) internal {
        (uint256 expectedFee, uint256 expectedNet) = rail.quote(amount);

        vm.prank(sender);
        rail.send(receiver, address(tok), amount, NO_FEE_CAP, bytes32("corridor-a"));

        assertEq(tok.balanceOf(receiver), expectedNet);
        assertEq(tok.balanceOf(treasury), expectedFee);
        assertEq(tok.balanceOf(address(rail)), 0, "contract must never hold a balance");
    }

    function test_send_feeRoundsDownInUsersFavor() public view {
        // 101 * 50 / 10_000 = 0.505 -> truncates to 0, i.e. rounds down, never up
        (uint256 fee, uint256 net) = rail.quote(101);
        assertEq(fee, 0);
        assertEq(net, 101);
    }

    function test_send_emitsRemittanceSentWithCorrectToken() public {
        uint256 amount = 50e6;
        (uint256 fee, uint256 net) = rail.quote(amount);

        vm.expectEmit(true, true, true, true, address(rail));
        emit Reach.RemittanceSent(sender, receiver, address(eurc), amount, fee, net, bytes32("memo"));

        vm.prank(sender);
        rail.send(receiver, address(eurc), amount, NO_FEE_CAP, bytes32("memo"));
    }

    function test_send_succeedsExactlyAtMinAmountBoundary() public {
        vm.prank(sender);
        rail.send(receiver, address(usdc), MIN_AMOUNT, NO_FEE_CAP, bytes32(0));
        assertGt(usdc.balanceOf(receiver), 0);
    }

    // --- the allowlist is the actual safety boundary — the core of this session's change ---

    function test_send_revertsForNonAllowlistedToken() public {
        vm.prank(sender);
        vm.expectRevert(
            abi.encodeWithSelector(Reach.TokenNotAllowed.selector, address(notAllowed))
        );
        rail.send(receiver, address(notAllowed), 10e6, NO_FEE_CAP, bytes32(0));
    }

    function test_setAllowedToken_adminCanAddNewToken() public {
        vm.prank(admin);
        rail.setAllowedToken(address(notAllowed), true);

        vm.prank(sender);
        rail.send(receiver, address(notAllowed), 10e6, NO_FEE_CAP, bytes32(0)); // no longer reverts
        assertGt(notAllowed.balanceOf(receiver), 0);
    }

    function test_setAllowedToken_adminCanRemoveExistingToken() public {
        vm.prank(admin);
        rail.setAllowedToken(address(eurc), false);

        vm.prank(sender);
        vm.expectRevert(abi.encodeWithSelector(Reach.TokenNotAllowed.selector, address(eurc)));
        rail.send(receiver, address(eurc), 10e6, NO_FEE_CAP, bytes32(0));

        // USDC is unaffected — removing one allowed token doesn't touch the other
        vm.prank(sender);
        rail.send(receiver, address(usdc), 10e6, NO_FEE_CAP, bytes32(0));
    }

    function test_setAllowedToken_revertsForNonAdmin() public {
        bytes32 role = rail.ADMIN_ROLE();
        vm.expectRevert(
            abi.encodeWithSelector(IAccessControl.AccessControlUnauthorizedAccount.selector, sender, role)
        );
        vm.prank(sender);
        rail.setAllowedToken(address(notAllowed), true);
    }

    function test_setAllowedToken_revertsOnZeroAddress() public {
        vm.prank(admin);
        vm.expectRevert(Reach.ZeroAddress.selector);
        rail.setAllowedToken(address(0), true);
    }

    function test_constructor_revertsOnZeroAddressInInitialTokens() public {
        address[] memory tokens = new address[](2);
        tokens[0] = address(usdc);
        tokens[1] = address(0);

        vm.expectRevert(Reach.ZeroAddress.selector);
        new Reach(tokens, treasury, FEE_BPS, MIN_AMOUNT, admin);
    }

    function test_constructor_worksWithEmptyInitialTokens() public {
        // Deploying with no tokens allowlisted yet, then adding one via setAllowedToken,
        // is a valid path — must not revert just because the array is empty.
        address[] memory none = new address[](0);
        Reach freshRail = new Reach(none, treasury, FEE_BPS, MIN_AMOUNT, admin);
        assertFalse(freshRail.allowedTokens(address(usdc)));
    }

    // --- threat-table row: amount too small (dust-send griefing) ---

    function test_send_revertsBelowMinAmount() public {
        vm.prank(sender);
        vm.expectRevert(
            abi.encodeWithSelector(Reach.AmountTooSmall.selector, MIN_AMOUNT - 1, MIN_AMOUNT)
        );
        rail.send(receiver, address(usdc), MIN_AMOUNT - 1, NO_FEE_CAP, bytes32(0));
    }

    // --- threat-table row: zero address / self-address receiver ---

    function test_send_revertsOnZeroAddressReceiver() public {
        vm.prank(sender);
        vm.expectRevert(
            abi.encodeWithSelector(Reach.InvalidReceiver.selector, address(0))
        );
        rail.send(address(0), address(usdc), 10e6, NO_FEE_CAP, bytes32(0));
    }

    function test_send_revertsWhenReceiverIsTheContractItself() public {
        vm.prank(sender);
        vm.expectRevert(
            abi.encodeWithSelector(Reach.InvalidReceiver.selector, address(rail))
        );
        rail.send(address(rail), address(usdc), 10e6, NO_FEE_CAP, bytes32(0));
    }

    // --- caller's fee-cap protection (quote-to-execution race) ---

    function test_send_revertsWhenLiveFeeExceedsCallerMax() public {
        vm.prank(admin);
        rail.setFeeBps(100); // fee moves to 1% after the user "saw" 0.5% in their wallet

        vm.prank(sender);
        vm.expectRevert(
            abi.encodeWithSelector(Reach.FeeExceedsCallerMax.selector, uint16(100), FEE_BPS)
        );
        rail.send(receiver, address(usdc), 50e6, FEE_BPS, bytes32(0)); // caller still only accepts 0.5%
    }

    function test_send_succeedsWhenLiveFeeEqualsCallerMax() public {
        vm.prank(sender);
        rail.send(receiver, address(usdc), 50e6, FEE_BPS, bytes32(0)); // exactly at the boundary
        assertGt(usdc.balanceOf(receiver), 0);
    }

    // --- threat-table row: fee-rug via admin (hardcoded cap) ---

    function test_setFeeBps_revertsAboveHardcodedCap() public {
        uint16 cap = rail.MAX_FEE_BPS();
        vm.expectRevert(abi.encodeWithSelector(Reach.FeeTooHigh.selector, cap + 1, cap));
        vm.prank(admin);
        rail.setFeeBps(cap + 1);
    }

    function test_constructor_revertsAboveHardcodedFeeCap() public {
        address[] memory tokens = new address[](1);
        tokens[0] = address(usdc);
        vm.expectRevert(abi.encodeWithSelector(Reach.FeeTooHigh.selector, 201, 200));
        new Reach(tokens, treasury, 201, MIN_AMOUNT, admin);
    }

    // --- threat-table row: admin-only governance functions ---

    function test_setFeeBps_revertsForNonAdmin() public {
        bytes32 role = rail.ADMIN_ROLE();
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
        rail.send(receiver, address(usdc), 10e6, NO_FEE_CAP, bytes32(0));
    }

    function test_unpause_restoresSending() public {
        vm.prank(admin);
        rail.pause();
        vm.prank(admin);
        rail.unpause();

        vm.prank(sender);
        rail.send(receiver, address(usdc), 10e6, NO_FEE_CAP, bytes32(0));
        assertGt(usdc.balanceOf(receiver), 0);
    }

    // --- threat-table row: insufficient allowance/balance must revert, not partially send ---

    function test_send_revertsOnInsufficientAllowance() public {
        vm.prank(sender);
        usdc.approve(address(rail), 5e6); // less than amount below

        vm.prank(sender);
        vm.expectRevert();
        rail.send(receiver, address(usdc), 10e6, NO_FEE_CAP, bytes32(0));

        assertEq(usdc.balanceOf(receiver), 0, "no partial send on revert");
    }

    // --- rescueTokens: recovering funds mistakenly sent directly to the contract ---

    function test_rescueTokens_recoversAccidentalDirectTransfer() public {
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
            rail.send(receiver, address(usdc), 100e6, callerMax, bytes32(0));
        } else {
            rail.send(receiver, address(usdc), 100e6, callerMax, bytes32(0));
        }
    }

    // --- fuzz: send() only ever succeeds for a token actually on the allowlist ---

    function testFuzz_send_revertsForAnyNonAllowlistedToken(address randomToken) public {
        vm.assume(randomToken != address(usdc) && randomToken != address(eurc));
        vm.assume(randomToken != address(0) && randomToken != address(rail));

        vm.prank(sender);
        vm.expectRevert(abi.encodeWithSelector(Reach.TokenNotAllowed.selector, randomToken));
        rail.send(receiver, randomToken, 10e6, NO_FEE_CAP, bytes32(0));
    }
}
