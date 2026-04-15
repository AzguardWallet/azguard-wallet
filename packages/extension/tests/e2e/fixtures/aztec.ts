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
import { L1FeeJuicePortalManager } from "@aztec/aztec.js/ethereum"
import { ProtocolContractAddress } from "@aztec/aztec.js/protocol"
import { createExtendedL1Client } from "@aztec/ethereum/client"
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

	const dataDirectory = join(tmpdir(), `nulo-e2e-${randomBytes(8).toString("hex")}`)
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

// ── Fee Juice L1→L2 Bridge ────────────────────────────────────────────

const ANVIL_URL = "http://localhost:8545"
const ANVIL_MNEMONIC = "test test test test test test test test test test test junk"

/** Bridge FeeJuice from L1 (Anvil) to an L2 address. Mints test FJ on L1, deposits to portal.
 *  Note: the L1 FeeAssetHandler has a fixed mint amount of 1000 FJ per call. */
export async function bridgeFeeJuice(node: ReturnType<typeof createAztecNodeClient>, toAddress: string, amount = 1000n * 10n ** 18n) {
	const nodeInfo = await node.getNodeInfo()
	const l1Client = createExtendedL1Client([ANVIL_URL], ANVIL_MNEMONIC, { id: nodeInfo.l1ChainId, name: "anvil" })
	const logger = {
		info: console.log,
		debug: console.log,
		warn: console.warn,
		error: console.error,
		verbose: console.log,
		trace: () => {},
	}
	const portalManager = await L1FeeJuicePortalManager.new(node, l1Client, logger)
	const claim = await portalManager.bridgeTokensPublic(AztecAddress.fromString(toAddress), amount, true)
	console.log(`[bridgeFeeJuice] Bridged ${amount} FJ to ${toAddress}, messageHash: ${claim.messageHash}`)
	return claim
}

/** Wait for an L1→L2 message to be synced on the Aztec node, then wait 2 more blocks. */
export async function waitForL1ToL2Message(
	node: ReturnType<typeof createAztecNodeClient>,
	messageHash: string,
	timeoutMs = 90_000,
): Promise<void> {
	const start = Date.now()
	while (Date.now() - start < timeoutMs) {
		const synced = await node.isL1ToL2MessageSynced(Fr.fromString(messageHash))
		if (synced) {
			console.log(`[waitForL1ToL2Message] Message synced after ${Date.now() - start}ms`)
			break
		}
		await new Promise((r) => setTimeout(r, 2_000))
	}
	// Wait 2 more L2 blocks for the message tree to update
	const currentBlock = await node.getBlockNumber()
	const target = currentBlock + 2
	while ((await node.getBlockNumber()) < target) {
		await new Promise((r) => setTimeout(r, 2_000))
	}
	console.log("[waitForL1ToL2Message] +2 L2 blocks confirmed")
}

/** Claim bridged FeeJuice on L2. Uses SponsoredFPC to pay for the claim tx itself.
 *  Uses ContractFunctionInteraction directly since FeeJuiceContract.at() may not bind to EmbeddedWallet correctly. */
export async function claimFeeJuice(
	wallet: InstanceType<typeof EmbeddedWallet>,
	toAddress: string,
	fromAddress: AztecAddress,
	claim: { claimAmount: bigint; claimSecret: Fr; messageLeafIndex: bigint },
	feeOptions: { paymentMethod: SponsoredFeePaymentMethod },
): Promise<void> {
	const { Contract } = await import("@aztec/aztec.js/contracts")
	const { FeeJuiceArtifact } = await import("@aztec/protocol-contracts/fee-juice")
	const feeJuice = await Contract.at(ProtocolContractAddress.FeeJuice, FeeJuiceArtifact, wallet)
	await feeJuice.methods
		.claim(AztecAddress.fromString(toAddress), claim.claimAmount, claim.claimSecret, claim.messageLeafIndex)
		.send({ fee: feeOptions, from: fromAddress })
	console.log(`[claimFeeJuice] Claimed ${claim.claimAmount} FJ for ${toAddress}`)
}
