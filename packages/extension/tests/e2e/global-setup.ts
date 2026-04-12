import { fileURLToPath } from "node:url"
import path from "node:path"
import fs from "node:fs"
import { execSync, spawn, type ChildProcess } from "node:child_process"
import type { TestProject } from "vitest/node"
import {
	type AztecTestConfig,
	checkNodeHealth,
	waitForLocalNode,
	createTestWallet,
	deployTestToken,
	createSponsoredFeeOptions,
	LOCAL_NODE_URL,
} from "./fixtures/aztec"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const EXTENSION_PATH = path.resolve(__dirname, "../../dist/chrome")
const CONFIG_PATH = path.resolve(__dirname, ".test-config.json")
const AZTEC_BIN = path.resolve(process.env.HOME || "~", ".aztec/current/node_modules/.bin/aztec")

let nodeProcess: ChildProcess | null = null
let weStartedNode = false

export default async function setup(project: TestProject) {
	// Kill orphan Chrome processes from previous test runs
	try {
		execSync('pkill -f "chrome.*--test-type" 2>/dev/null || true', { stdio: "ignore" })
		execSync('pkill -f "Google Chrome for Testing" 2>/dev/null || true', { stdio: "ignore" })
	} catch {}

	// Guard: ensure extension is built
	const manifest = path.join(EXTENSION_PATH, "manifest.json")
	if (!fs.existsSync(manifest)) {
		throw new Error(`Extension not found at ${EXTENSION_PATH}\nRun "bun run build" or "bun run dev" first.`)
	}
	project.provide("extensionPath", EXTENSION_PATH)

	// Check if local node is already running
	const nodeAlreadyRunning = await checkNodeHealth(LOCAL_NODE_URL)

	if (nodeAlreadyRunning) {
		console.log("[e2e-setup] Local Aztec node already running at", LOCAL_NODE_URL)
		weStartedNode = false
	} else {
		// Auto-start the local network
		console.log("[e2e-setup] Starting local Aztec network...")
		if (!fs.existsSync(AZTEC_BIN)) {
			console.warn("[e2e-setup] aztec CLI not found at", AZTEC_BIN, "— skipping network setup")
			project.provide("aztecTestConfig", undefined)
			return
		}

		nodeProcess = spawn(AZTEC_BIN, ["start", "--local-network"], {
			stdio: "pipe",
			detached: true, // Process group for cleanup
			env: { ...process.env },
		})
		weStartedNode = true

		// Log node output for debugging (can be removed later)
		nodeProcess.stdout?.on("data", (data: Buffer) => {
			const line = data.toString().trim()
			if (line.includes("Aztec") || line.includes("ready") || line.includes("error")) {
				console.log("[aztec-node]", line.slice(0, 200))
			}
		})
		nodeProcess.stderr?.on("data", (data: Buffer) => {
			const line = data.toString().trim()
			if (line.includes("error") || line.includes("Error")) {
				console.error("[aztec-node]", line.slice(0, 200))
			}
		})

		// Wait for node to become healthy
		try {
			await waitForLocalNode(LOCAL_NODE_URL, 90_000)
			console.log("[e2e-setup] Local Aztec node is ready")
		} catch (error) {
			console.error("[e2e-setup] Failed to start local node:", error)
			killNodeProcess()
			project.provide("aztecTestConfig", undefined)
			return
		}
	}

	// Deploy test contracts
	try {
		console.log("[e2e-setup] Deploying test contracts...")
		const { wallet, accounts, cleanup } = await createTestWallet(LOCAL_NODE_URL)
		const minterAddress = accounts[0]
		const { paymentMethod, address: sponsoredFpcAddress } = await createSponsoredFeeOptions(wallet)
		const feeOptions = { paymentMethod }

		const tokenAddress = await deployTestToken(wallet, minterAddress, feeOptions)

		const config: AztecTestConfig = {
			nodeUrl: LOCAL_NODE_URL,
			tokenAddress,
			sponsoredFpcAddress,
			minterAddress: minterAddress.toString(),
		}

		// Write config for test files to read
		fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2))
		console.log("[e2e-setup] Test contracts deployed:", JSON.stringify(config, null, 2))

		await cleanup()
		project.provide("aztecTestConfig", config)
	} catch (error) {
		console.error("[e2e-setup] Failed to deploy test contracts:", error)
		project.provide("aztecTestConfig", undefined)
	}
}

export async function teardown() {
	// Clean up config file
	try {
		fs.unlinkSync(CONFIG_PATH)
	} catch {
		// ignore
	}

	// Only kill the node if we started it
	killNodeProcess()

	// Clean up orphan Chrome processes
	try {
		execSync('pkill -f "chrome.*--test-type" 2>/dev/null || true', { stdio: "ignore" })
		execSync('pkill -f "Google Chrome for Testing" 2>/dev/null || true', { stdio: "ignore" })
	} catch {}
}

function killNodeProcess() {
	if (!nodeProcess || !weStartedNode) return

	console.log("[e2e-setup] Stopping local Aztec node...")
	try {
		// Kill the entire process group
		if (nodeProcess.pid) {
			process.kill(-nodeProcess.pid, "SIGTERM")
		}
	} catch {
		try {
			nodeProcess.kill("SIGKILL")
		} catch {
			// ignore
		}
	}
	nodeProcess = null
}

// Clean up on unexpected exit
process.on("SIGINT", killNodeProcess)
process.on("SIGTERM", killNodeProcess)
process.on("exit", killNodeProcess)

declare module "vitest" {
	export interface ProvidedContext {
		extensionPath: string
		aztecTestConfig?: AztecTestConfig
	}
}
