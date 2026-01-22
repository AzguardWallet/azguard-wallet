import { ensurePermissions } from "./general";

const mimeByExtension: Record<string, string> = {
    ".json": "application/json;charset=utf-8",
    ".txt":  "text/plain;charset=utf-8",
    ".zip":  "application/zip",
    ".gz":   "application/gzip",
    ".csv":  "text/csv;charset=utf-8",
    ".html": "text/html;charset=utf-8",
    ".png":  "image/png",
    ".jpg":  "image/jpeg",
    ".jpeg": "image/jpeg",
    ".pdf":  "application/pdf",
}

function getExtension(filename: string): string {
    const dotIndex = filename.lastIndexOf(".");
    return dotIndex !== -1 ? filename.slice(dotIndex).toLowerCase() : "";
}

function resolveMime(filename: string, mime?: string): string {
    if (mime) return mime;

    const ext = getExtension(filename);
    return mimeByExtension[ext] || "text/plain;charset=utf-8";
}

export async function downloadFile({
    data,
    filename,
    mime,
	saveAs = false,
	compressionFormat,
}: {
    data: string;
    filename: string;
    mime?: string;
	saveAs?: boolean;
	compressionFormat?: CompressionFormat;
}): Promise<void> {
    const hasPermission = await ensurePermissions({ permissions: ["downloads"] });
    if (!hasPermission) {
        throw new Error("Permission for downloads not granted by user");
    }

	let blob;
	let finalFilename = filename;
	if (compressionFormat) {
		const compressedData = await compressData(data, compressionFormat);
		const compressedMimeType = getCompressedMimeType(compressionFormat);
		const arrayBuffer = await (compressedData as any).arrayBuffer() as ArrayBuffer;

		blob = new Blob([arrayBuffer], { type: compressedMimeType });
		finalFilename = getCompressedFilename(filename, compressionFormat);
	} else {
		const resolvedMime = resolveMime(filename, mime);
		blob = new Blob([data], { type: resolvedMime });
	}

    const url = URL.createObjectURL(blob);

    try {
        await new Promise<void>((resolve, reject) => {
            chrome.downloads.download(
                {
                    url,
                    filename: finalFilename,
                    saveAs,
                },
                () => {
                    const err = (chrome.runtime as any).lastError;
                    if (err) reject(new Error(err));
                    else resolve();
                }
            );
        });
    } finally {
        URL.revokeObjectURL(url);
    }
}

export async function pickFile(
	accept = ".json,.txt,.gz,.gzip",
	delay = false,
	autoDecompress = true,
): Promise<File> {
    return new Promise((resolve, reject) => {
        const input = document.createElement("input");
        input.type = "file";
        input.accept = accept;
        input.style.display = "none";

        document.body.appendChild(input);

        input.onchange = async () => {
            const file = input.files?.[0];
            document.body.removeChild(input);

			if (!file) {
				reject(new Error("No file selected"));
				return;
			}
            
			const compressionFormat = getCompressionFormat(file?.name);
			if (!compressionFormat || !autoDecompress) {
				resolve(file);
				return;
			}

			try {
				const decompressedBlob = await decompressData(file, compressionFormat);
				const decompressedFile = new File(
					[decompressedBlob],
					file.name.replace(`${getExtension(file.name)}`, ""),
					{
						type: decompressedBlob.type,
						lastModified: file.lastModified,
					}
				);

				resolve(decompressedFile);
			} catch (err) {
				console.warn(`Failed to decompress ${file.name}:`, err instanceof Error ? err.message : err);
				resolve(file);
			}
		};

		if (delay) {
			setTimeout(() => input.click(), 50)
		} else {
			input.click();
		}
    });
}

// Compression / Decompression
const supportedCompressionFormats = ["gzip", "deflate", "deflate-raw"] as const;
type CompressionFormat = typeof supportedCompressionFormats[number];

interface CompressionStream extends GenericTransformStream {
    readonly readable: ReadableStream<Uint8Array>;
    readonly writable: WritableStream<BufferSource>;
}

interface DecompressionStream extends GenericTransformStream {
    readonly readable: ReadableStream<Uint8Array>;
    readonly writable: WritableStream<BufferSource>;
}

declare var CompressionStream: {
    new (format: string): CompressionStream;
}

declare var DecompressionStream: {
    new (format: string): DecompressionStream;
}

function isCompressionStreamSupported(): boolean {
    try {
        new CompressionStream('gzip');
        new DecompressionStream('gzip');
        return true;
    } catch {
        return false;
    }
}

function getCompressedFilename(originalFilename: string, compressionFormat: CompressionFormat): string {
    const extension = getExtension(originalFilename);
    const baseName = extension ? originalFilename.slice(0, -extension.length) : originalFilename;
    
    switch (compressionFormat) {
        case "gzip":
            return `${baseName}.gz`;
        case "deflate":
            return `${baseName}.zz`;
        case "deflate-raw":
            return `${baseName}.df`;
        default:
            return `${originalFilename}.compressed`;
    }
}

function getCompressedMimeType(compressionFormat: CompressionFormat): string {
    switch (compressionFormat) {
        case "gzip":
            return "application/gzip";
        case "deflate":
        case "deflate-raw":
            return "application/octet-stream";
        default:
            return "application/octet-stream";
    }
}

function getCompressionFormat(filename?: string): CompressionFormat | null {
	if (!filename) return null;

	const extension = getExtension(filename);
	switch (extension) {
		case ".gz":
		case ".gzip":
			return "gzip";
		case ".zz":
		case ".deflate":
			return "deflate";
		case ".df":
		case ".raw":
			return "deflate-raw";
	
		default:
			return null;
	}
}

export async function compressData(
    data: string | ArrayBuffer | Blob | ReadableStream,
    format: CompressionFormat,
): Promise<Blob> {
    if (!isCompressionStreamSupported()) {
        throw new Error("Compression Streams API is not supported in this browser version");
    }

    if (!supportedCompressionFormats.includes(format)) {
        throw new Error(`Unsupported compression format: ${format}. Available: ${supportedCompressionFormats.join(", ")}`);
    }

    let inputStream: ReadableStream<Uint8Array>;

    if (typeof data === 'string') {
        const encoder = new TextEncoder();
        const bytes = encoder.encode(data);
        inputStream = new ReadableStream({
            start(controller) {
                controller.enqueue(bytes);
                controller.close();
            }
        });
    } else if (data instanceof ArrayBuffer) {
        inputStream = new ReadableStream({
            start(controller) {
                controller.enqueue(new Uint8Array(data));
                controller.close();
            }
        });
    } else if (data instanceof Blob) {
        inputStream = data.stream();
    } else {
        inputStream = data;
    }

	try {
		const compressionStream = new CompressionStream(format);
		const compressedStream = (inputStream as any).pipeThrough(compressionStream) as ReadableStream<Uint8Array>;
		const response = new Response(compressedStream);
        return await response.blob();
	} catch (err) {
		throw new Error(`Failed to compress data: ${err instanceof Error ? err.message : String(err)}`);
	}
}

export async function decompressData(
    compressedData: Blob | ArrayBuffer,
    format: CompressionFormat,
): Promise<Blob> {
    if (!isCompressionStreamSupported()) {
		throw new Error("Compression Streams API is not supported in this browser version");
    }

    let uint8Array: Uint8Array;
    
    if (compressedData instanceof ArrayBuffer) {
        uint8Array = new Uint8Array(compressedData);
    } else if (compressedData instanceof Blob) {
        const arrayBuffer = await compressedData.arrayBuffer();
        uint8Array = new Uint8Array(arrayBuffer);
    } else {
        throw new Error("Unsupported data type");
    }

    const ds = new DecompressionStream(format);
    const writer = ds.writable.getWriter();
    
    writer.write(uint8Array as BufferSource);
    writer.close();
    
    const decompressedResponse = new Response(ds.readable);
    return await decompressedResponse.blob();
}
