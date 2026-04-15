// Nulo Playground — test dApp for e2e testing
//
// This page will replace the external adhoc-aztec-wallet-test.pages.dev
// once the wallet-sdk connection flow is implemented.
//
// Required interface for e2e tests:
// 1. Show "Ready. Click Connect to start." on load
// 2. "Connect" button initiates wallet-sdk discovery
// 3. Show "Connected!" after successful wallet connection
// 4. Operation buttons: sendTx, simulateTx, registerContract, createAuthWit, batch ops, etc.

const app = document.querySelector<HTMLDivElement>("#app")!

app.innerHTML = `
	<h1>Nulo Playground</h1>
	<p id="status">Ready. Click Connect to start.</p>
	<button id="connect">Connect</button>
	<div id="result"></div>
`

const connectBtn = document.querySelector<HTMLButtonElement>("#connect")!
const status = document.querySelector<HTMLParagraphElement>("#status")!

connectBtn.addEventListener("click", () => {
	// TODO: Implement wallet-sdk discovery flow
	// import { ... } from "@aztec/wallet-sdk"
	status.textContent = "Connecting... (wallet-sdk integration pending)"
})
