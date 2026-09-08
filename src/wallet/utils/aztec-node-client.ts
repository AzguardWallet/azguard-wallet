import { type AztecNode, createAztecNodeClient } from "@aztec/stdlib/interfaces/client";

export type { AztecNode };

// drpc's mainnet free tier rejects JSON-RPC batches of more than 3 calls
// with HTTP 500. PXE's log scanner builds per-sender batches that grow with
// the number of wallet accounts + contacts, so we cap the HTTP batch here to
// stay within the provider's limit.
const MAX_BATCH_SIZE = 3;

export function createBatchCappedAztecNodeClient(url: string): AztecNode {
    return createAztecNodeClient(url, {}, undefined, 0, MAX_BATCH_SIZE);
}
