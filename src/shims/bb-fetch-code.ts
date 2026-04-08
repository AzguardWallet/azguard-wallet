/**
 * Replacement for @aztec/bb.js fetchCode browser module.
 *
 * The original uses dynamic import() to load embedded WASM data URIs as a fallback
 * when wasmPath is not provided. Chrome MV3 service workers forbid import() at runtime.
 *
 * This shim replaces the import() fallback with a fetch() to the known WASM asset path.
 * The WASM files are copied to /assets/ by vite-plugin-static-copy from libs/@aztec/bb.js/.
 */
// @ts-expect-error — pako has no types in this context
import pako from "pako"

const DEFAULT_WASM_PATH = "/assets/barretenberg.wasm.gz"

export async function fetchCode(multithreaded: boolean, wasmPath?: string): Promise<ArrayBuffer> {
	const basePath = wasmPath ?? DEFAULT_WASM_PATH
	const suffix = multithreaded ? "-threads" : ""
	const filePath = basePath.split("/").slice(0, -1).join("/")
	const fileNameWithExtensions = basePath.split("/").pop()!
	const [fileName, ...extensions] = fileNameWithExtensions.split(".")
	const url = `${filePath}/${fileName}${suffix}.${extensions.join(".")}`

	const res = await fetch(url)
	const maybeCompressedData = await res.arrayBuffer()
	const buffer = new Uint8Array(maybeCompressedData)

	const isGzip = buffer[0] === 0x1f && buffer[1] === 0x8b && buffer[2] === 0x08
	if (isGzip) {
		return pako.ungzip(buffer).buffer
	}
	return buffer.buffer
}
