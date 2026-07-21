export const privateFpcTokenName = "Private Fee Juice";

export const privateFpcTokenSymbol = "pFJ";

// Canonical PrivateFPC v5.0.1 (salt 0, deployer 0, no constructor args) — address is chain-independent.
// Deployed privately by design: the instance is never published on-chain, so it can't be fetched from
// the node — we pin the class id and derive the instance from the artifact (registry-backed) instead.
export const CANONICAL_PRIVATE_FPC_ADDRESS = "0x1966fc6084e79aa92a5395d11149ee8cd87e8c43081e05294e7824f7b2927181";

export const CANONICAL_PRIVATE_FPC_CLASS_ID = "0x032bc73c22b1d0ab26cce0c99d7ab71f0078962f9a92b060cc9c5cb87e4cfb08";
