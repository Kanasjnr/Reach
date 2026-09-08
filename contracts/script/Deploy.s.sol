// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {Reach} from "../src/Reach.sol";

/// @notice Deploys Reach with USDC and EURC allowlisted from the start. Reads config
/// from env vars so the same script runs unchanged for testnet and mainnet — set
/// USDC_ADDRESS / EURC_ADDRESS to Arc's real token addresses before running against a
/// live network. Confirmed during planning (Arc testnet):
///   USDC: 0x3600000000000000000000000000000000000000 (native gas token)
///   EURC: 0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a
contract Deploy is Script {
    function run() external returns (Reach rail) {
        address usdc = vm.envAddress("USDC_ADDRESS");
        address eurc = vm.envAddress("EURC_ADDRESS");
        address treasury = vm.envAddress("TREASURY_ADDRESS");
        address admin = vm.envAddress("ADMIN_ADDRESS");
        uint16 feeBps = uint16(vm.envOr("FEE_BPS", uint256(50))); // default 0.50%
        uint256 minAmount = vm.envOr("MIN_AMOUNT", uint256(1e6)); // default $1-equivalent

        address[] memory initialTokens = new address[](2);
        initialTokens[0] = usdc;
        initialTokens[1] = eurc;

        vm.startBroadcast();
        rail = new Reach(initialTokens, treasury, feeBps, minAmount, admin);
        vm.stopBroadcast();

        console.log("Reach deployed at:", address(rail));
        console.log("  allowed token (USDC):", usdc);
        console.log("  allowed token (EURC):", eurc);
        console.log("  treasury:", treasury);
        console.log("  admin:", admin);
        console.log("  feeBps:", feeBps);
        console.log("  minAmount:", minAmount);
    }
}
