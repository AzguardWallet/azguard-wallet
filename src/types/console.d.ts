export declare global {
	interface Console {
		_trace: typeof console.trace
		_debug: typeof console.debug
		_log: typeof console.log
		_info: typeof console.info
		_warn: typeof console.warn
		_error: typeof console.error
	}

	interface Window {
		ontrace?: typeof console.trace
		ondebug?: typeof console.debug
		onlog?: typeof console.log
		oninfo?: typeof console.info
		onwarn?: typeof console.warn
		onerror?: typeof console.error
	}
}
