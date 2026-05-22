import { createSafeJsonRpcClient, makeFetch } from "@aztec/foundation/json-rpc/client";
import { type AztecNode, AztecNodeApiSchema } from "@aztec/stdlib/interfaces/client";
import { getVersioningResponseHandler } from "@aztec/stdlib/versioning";

export type { AztecNode };

// drpc's mainnet free tier rejects JSON-RPC batches of more than 3 calls
// with HTTP 500. PXE's log scanner builds per-sender batches that grow with
// the number of wallet accounts + contacts, so we cap the HTTP batch here to
// stay within the provider's limit. The SDK's createAztecNodeClient does not
// forward maxBatchSize, so we inline its setup.
// TODO: drop this wrapper once upstream aztec-packages exposes maxBatchSize
// on createAztecNodeClient.
const MAX_BATCH_SIZE = 3;

export function createBatchCappedAztecNodeClient(url: string): AztecNode {
    return createSafeJsonRpcClient(url, AztecNodeApiSchema, {
        namespaceMethods: "node",
        maxBatchSize: MAX_BATCH_SIZE,
        fetch: makeFetch([1, 2, 3], false),
        onResponse: getVersioningResponseHandler({}),
    });
}
