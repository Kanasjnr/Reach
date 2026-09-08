// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {Reach} from "../src/Reach.sol";

/// @notice Deploys Reach. Reads config from env vars so the same script
/// runs unchanged for testnet and mainnet — set USDC_ADDRESS to Arc's real USDC
/// address (0x3600000000000000000000000000000000000000, confirmed via Arc docs
/// during planning) before running against a live network.
contract Deploy is Script {
    function run() external returns (Reach rail) {
        address usdc = vm.envAddress("USDC_ADDRESS");
        address treasury = vm.envAddress("TREASURY_ADDRESS");
        address admin = vm.envAddress("ADMIN_ADDRESS");
        uint16 feeBps = uint16(vm.envOr("FEE_BPS", uint256(50))); // default 0.50%
        uint256 minAmount = vm.envOr("MIN_AMOUNT", uint256(1e6)); // default $1 USDC

        vm.startBroadcast();
        rail = new Reach(usdc, treasury, feeBps, minAmount, admin);
        vm.stopBroadcast();

        console.log("Reach deployed at:", address(rail));
        console.log("  token (USDC):", usdc);
        console.log("  treasury:", treasury);
        console.log("  admin:", admin);
        console.log("  feeBps:", feeBps);
        console.log("  minAmount:", minAmount);
    }
}
