export const reachAbi = [
  {
    type: "function",
    name: "send",
    stateMutability: "nonpayable",
    inputs: [
      { name: "receiver", type: "address" },
      { name: "tokenAddr", type: "address" },
      { name: "amount", type: "uint256" },
      { name: "maxFeeBps", type: "uint16" },
      { name: "memo", type: "bytes32" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "quote",
    stateMutability: "view",
    inputs: [{ name: "amount", type: "uint256" }],
    outputs: [
      { name: "fee", type: "uint256" },
      { name: "netAmount", type: "uint256" },
    ],
  },
  {
    type: "function",
    name: "feeBps",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint16" }],
  },
  {
    type: "function",
    name: "minAmount",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
  // Without these, viem can't decode a revert into a readable error — it just
  // dumps the raw 4-byte selector at the user instead of e.g. "AmountTooSmall".
  { type: "error", name: "ZeroAddress", inputs: [] },
  { type: "error", name: "InvalidReceiver", inputs: [{ name: "receiver", type: "address" }] },
  { type: "error", name: "TokenNotAllowed", inputs: [{ name: "token", type: "address" }] },
  {
    type: "error",
    name: "AmountTooSmall",
    inputs: [
      { name: "amount", type: "uint256" },
      { name: "minAmount", type: "uint256" },
    ],
  },
  {
    type: "error",
    name: "FeeTooHigh",
    inputs: [
      { name: "requested", type: "uint16" },
      { name: "max", type: "uint16" },
    ],
  },
  {
    type: "error",
    name: "FeeExceedsCallerMax",
    inputs: [
      { name: "current", type: "uint16" },
      { name: "maxAccepted", type: "uint16" },
    ],
  },
  {
    type: "event",
    name: "RemittanceSent",
    inputs: [
      { name: "sender", type: "address", indexed: true },
      { name: "receiver", type: "address", indexed: true },
      { name: "token", type: "address", indexed: true },
      { name: "grossAmount", type: "uint256", indexed: false },
      { name: "fee", type: "uint256", indexed: false },
      { name: "netAmount", type: "uint256", indexed: false },
      { name: "memo", type: "bytes32", indexed: false },
    ],
  },
] as const;

export const erc20Abi = [
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "allowance",
    stateMutability: "view",
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
    ],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "approve",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ type: "bool" }],
  },
] as const;
