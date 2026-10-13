export const privateFpcTokenName = "Private Fee Juice";

export const privateFpcTokenSymbol = "pFJ";

// PrivateFPC (salt 0, deployer 0, no args), chain-independent. Deployed
// unpublished — the node can't serve the instance, so pin the class id and derive.
// TODO: `v6-private-fpc` provisional pins from our own v6.0.0-rc.3 build of the upstream source. No
// canonical v6 build exists yet. Replace both once upstream publishes one.
export const CANONICAL_PRIVATE_FPC_ADDRESS = "0x0901d17a9d13f1fbd834a03156066b6806dd2bd77c11ca1836db47176b740e41";

export const CANONICAL_PRIVATE_FPC_CLASS_ID = "0x032dafee7c0b4dcecf31b7af9563001804ebdd6386b33ea42b892620a14789d3";
