import { inject } from "vitest"
import { test, openPopup, waitForHash } from "../fixtures/extension"
import { importToken } from "../fixtures/helpers"
import type { AztecTestConfig } from "../fixtures/aztec"

const aztecConfig = inject("aztecTestConfig") as AztecTestConfig | undefined
const hasConfig = aztecConfig !== undefined

test.skipIf(!hasConfig)(
	"import token by contract address",
	{ timeout: 60_000 },
	async ({ localNetworkExtension }) => {
		const page = await openPopup(localNetworkExtension)
		await waitForHash(page, "#/popup/general")

		await importToken(page, aztecConfig!.tokenAddress)

		// Token "TestToken" should appear in the tokens list
		await page.waitForSelector("text/TestToken", { visible: true, timeout: 30_000 })
	},
)
