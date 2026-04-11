/**
 * Timeout-wrapped fetch for Aztec node RPC calls.
 *
 * The Aztec SDK's default fetch (`makeFetch([1, 2, 3], false)`) has retry
 * logic but NO per-request timeout. If the node is unresponsive, each
 * attempt (and its retries) hang forever — freezing the PXE and the
 * entire wallet.
 *
 * This module mirrors the SDK's `defaultFetch` exactly (jsonStringify,
 * NoRetryError for 4xx) but adds a per-request AbortController timeout.
 * It then wraps with the SDK's own `retry` + `makeBackoff` for retries.
 */

import { jsonStringify } from "@aztec/foundation/json-rpc"
import { NoRetryError, makeBackoff, retry } from "@aztec/foundation/retry"

/** Default timeout per individual HTTP request (ms). */
const DEFAULT_REQUEST_TIMEOUT_MS = 60_000

/**
 * JSON-RPC fetch signature expected by `createAztecNodeClient`.
 */
type JsonRpcFetch = (
	host: string,
	body: unknown,
	extraHeaders?: Record<string, string>,
	noRetry?: boolean,
) => Promise<{ response: unknown; headers: { get: (header: string) => string | null | undefined } }>

/**
 * Single-attempt fetch with timeout. Mirrors the SDK's `defaultFetch` but
 * adds an AbortController that fires after `timeoutMs`.
 */
function fetchOnce(timeoutMs: number): JsonRpcFetch {
	return async (host, body, extraHeaders = {}, noRetry = false) => {
		const controller = new AbortController()
		const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

		try {
			let resp: Response
			try {
				resp = await fetch(host, {
					method: "POST",
					body: jsonStringify(body),
					headers: { "content-type": "application/json", ...extraHeaders },
					signal: controller.signal,
				})
			} catch (err: unknown) {
				if (err instanceof DOMException && err.name === "AbortError") {
					throw new Error(`Request to ${host} timed out after ${timeoutMs}ms`)
				}
				throw new Error(`Error fetching from host ${host}: ${err}`)
			}

			let responseJson
			try {
				responseJson = await resp.json()
			} catch {
				if (!resp.ok) throw new Error(resp.statusText)
				throw new Error(`Failed to parse body as JSON`)
			}

			if (!resp.ok) {
				const errorMessage = `Error ${resp.status} from server ${host}: ${responseJson.error?.message ?? resp.statusText}`
				if (noRetry || (resp.status >= 400 && resp.status < 500)) {
					throw new NoRetryError(errorMessage)
				} else {
					throw new Error(errorMessage)
				}
			}

			return { response: responseJson, headers: resp.headers }
		} finally {
			clearTimeout(timeoutId)
		}
	}
}

/**
 * Create a JSON-RPC fetch function with per-request timeout AND retry logic.
 *
 * Matches the SDK's `makeFetch([1, 2, 3], false)` behavior:
 * - Retries with exponential backoff on 5xx / network errors
 * - Stops immediately on 4xx (NoRetryError)
 * - Adds per-request timeout via AbortController (the SDK lacks this)
 */
export function makeFetchWithTimeout(timeoutMs: number = DEFAULT_REQUEST_TIMEOUT_MS): JsonRpcFetch {
	const once = fetchOnce(timeoutMs)
	return async (host, body, extraHeaders = {}, noRetry) => {
		return await retry(
			() => once(host, body, extraHeaders, noRetry ?? false),
			`JsonRpcClient request to ${host}`,
			makeBackoff([1, 2, 3]),
			undefined,
			false,
		)
	}
}
