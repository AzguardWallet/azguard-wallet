/**
 * Aztec SDK helpers for E2E tests.
 *
 * Uses EmbeddedWallet to deploy contracts and mint tokens on the local Aztec network.
 * Designed to run as a singleton per test file (file-scoped fixture).
 */
import { tmpdir } from "node:os"
import { join } from "node:path"
import { randomBytes } from "node:crypto"
import { rmSync } from "node:fs"

import { createAztecNodeClient, waitForNode } from "@aztec/aztec.js/node"
import { AztecAddress } from "@aztec/aztec.js/addresses"
import { Fr } from "@aztec/aztec.js/fields"
import { getContractInstanceFromInstantiationParams } from "@aztec/aztec.js/contracts"
import { EmbeddedWallet } from "@aztec/wallets/embedded"
import { registerInitialLocalNetworkAccountsInWallet } from "@aztec/wallets/testing"
import { SponsoredFeePaymentMethod } from "@aztec/aztec.js/fee"
import { SponsoredFPCContractArtifact } from "@aztec/noir-contracts.js/SponsoredFPC"
import { TokenContract } from "@defi-wonderland/aztec-standards/dist/src/artifacts/Token.js"

export const LOCAL_NODE_URL = "http://localhost:8080"
const SPONSORED_FPC_SALT = 0n

export interface AztecTestConfig {
	nodeUrl: string
	tokenAddress: string
	sponsoredFpcAddress: string
	/** Hex-encoded minter account address */
	minterAddress: string
}

/** Check if the local Aztec node is reachable and responding. */
export async function checkNodeHealth(url = LOCAL_NODE_URL): Promise<boolean> {
	try {
		const node = createAztecNodeClient(url)
		await node.getNodeInfo()
		return true
	} catch {
		return false
	}
}

/** Wait for the local node to become healthy (with timeout). */
export async function waitForLocalNode(url = LOCAL_NODE_URL, timeoutMs = 60_000): Promise<void> {
	const node = createAztecNodeClient(url)
	const start = Date.now()
	while (Date.now() - start < timeoutMs) {
		try {
			await node.getNodeInfo()
			return
		} catch {
			await new Promise((r) => setTimeout(r, 2_000))
		}
	}
	throw new Error(`Local Aztec node at ${url} did not become healthy within ${timeoutMs}ms`)
}

/** Create an EmbeddedWallet connected to the local node. Returns wallet + cleanup function. */
export async function createTestWallet(url = LOCAL_NODE_URL) {
	const node = createAztecNodeClient(url)
	await waitForNode(node)

	const dataDirectory = join(tmpdir(), `vibeguard-e2e-${randomBytes(8).toString("hex")}`)
	const wallet = await EmbeddedWallet.create(node, {
		pxeConfig: { dataDirectory, proverEnabled: false },
	})

	const accounts = await registerInitialLocalNetworkAccountsInWallet(wallet)

	const cleanup = async () => {
		await wallet.stop()
		try {
			rmSync(dataDirectory, { recursive: true, force: true })
		} catch {
			// ignore cleanup errors
		}
	}

	return { wallet, accounts, node, cleanup }
}

/** Deploy a Token contract with a minter address. Returns the token contract address. */
export async function deployTestToken(
	wallet: InstanceType<typeof EmbeddedWallet>,
	minterAddress: AztecAddress,
	feeOptions: { paymentMethod: SponsoredFeePaymentMethod },
): Promise<string> {
	const { contract } = await TokenContract.deployWithOpts(
		{ method: "constructor_with_minter", wallet },
		"TestToken",
		"TST",
		18,
		minterAddress,
	).send({ fee: feeOptions, from: minterAddress })

	return contract.address.toString()
}

/** Get the Sponsored FPC address (deterministic from salt=0). */
export async function getSponsoredFpcAddress(): Promise<string> {
	const instance = await getContractInstanceFromInstantiationParams(SponsoredFPCContractArtifact, {
		salt: new Fr(SPONSORED_FPC_SALT),
	})
	return instance.address.toString()
}

/** Create Sponsored fee payment options. Registers the SponsoredFPC with the wallet's PXE first. */
export async function createSponsoredFeeOptions(wallet: InstanceType<typeof EmbeddedWallet>) {
	const instance = await getContractInstanceFromInstantiationParams(SponsoredFPCContractArtifact, {
		salt: new Fr(SPONSORED_FPC_SALT),
	})

	// Register the SponsoredFPC contract so the wallet can use it for fee payment
	try {
		await wallet.registerContract(instance, SponsoredFPCContractArtifact)
	} catch {
		// Already registered — ignore
	}

	const paymentMethod = new SponsoredFeePaymentMethod(instance.address)
	return { paymentMethod, address: instance.address.toString() }
}

/** Mint public tokens to an address. Waits for the balance to be readable via the test wallet's PXE. */
export async function mintPublicTokens(
	wallet: InstanceType<typeof EmbeddedWallet>,
	tokenAddress: string,
	toAddress: string,
	amount: bigint,
	minterAddress: string,
	feeOptions: { paymentMethod: SponsoredFeePaymentMethod },
): Promise<void> {
	const token = await TokenContract.at(AztecAddress.fromString(tokenAddress), wallet)
	await token.methods
		.mint_to_public(AztecAddress.fromString(toAddress), amount)
		.send({ fee: feeOptions, from: AztecAddress.fromString(minterAddress) })

	// Verify the mint is visible by reading the balance from the test wallet's PXE.
	// This ensures the state has settled before the extension tries to read it.
	const to = AztecAddress.fromString(toAddress)
	const balance = await token.methods.balance_of_public(to).simulate({ from: AztecAddress.fromString(minterAddress) })
	console.log(`[mintPublicTokens] Verified on-chain public balance: ${balance}`)
	if (balance === 0n) {
		throw new Error(`Mint appeared to succeed but balance_of_public returned 0 for ${toAddress}`)
	}
}

/** Mint private tokens to an address. */
export async function mintPrivateTokens(
	wallet: InstanceType<typeof EmbeddedWallet>,
	tokenAddress: string,
	toAddress: string,
	amount: bigint,
	minterAddress: string,
	feeOptions: { paymentMethod: SponsoredFeePaymentMethod },
): Promise<void> {
	const token = await TokenContract.at(AztecAddress.fromString(tokenAddress), wallet)
	await token.methods
		.mint_to_private(AztecAddress.fromString(toAddress), amount)
		.send({ fee: feeOptions, from: AztecAddress.fromString(minterAddress) })
}
