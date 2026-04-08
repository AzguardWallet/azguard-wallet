// Override detect-node to always return false in the extension context.
// The node-polyfills process shim makes the real detect-node think we're
// in Node.js, which causes @aztec/foundation's pino logger to use
// pino.transport() (Node worker threads) instead of the browser transport.

export default false
