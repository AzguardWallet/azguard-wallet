<route lang="json">
{
	"meta": {
		"isAuthRequired": false,
		"requiresProfile": false
	}
}
</route>

<script setup>
import { onMounted } from "vue"
import { PasskeyServiceClient } from "@/wallet/services/passkey/client"
import { PASSKEY_PRF_LABEL } from "@/wallet/services/passkey/spec"
import { getRandomHex } from "@/wallet/utils"

const route = useRoute()

const passkey = new PasskeyServiceClient()

const encodeBase64 = (buf) => Buffer.from(new Uint8Array(buf)).toString("base64")
const decodeBase64 = (b64) => Uint8Array.from(Buffer.from(b64, "base64"))

const handlePasskeyCreate = async (requestId) => {
	const challenge = crypto.getRandomValues(new Uint8Array(32))
	const te = new TextEncoder()
	const prfInput = await crypto.subtle.digest("SHA-256", te.encode(PASSKEY_PRF_LABEL))
	const publicKey = {
		challenge,
		rp: {
			name: "Azguard Wallet",
			id: "azguardwallet.io"
		},
		user: {
			id: crypto.getRandomValues(new Uint8Array(16)),
			name: `profile-${getRandomHex(6)}`,
			displayName: "Azguard Profile",
		},
		pubKeyCredParams: [{ type: "public-key", alg: -7 }],
		authenticatorSelection: {
			residentKey: "required",
			userVerification: "required",
			requireResidentKey: true,
		},
		attestation: "none",
		timeout: 60_000,
		extensions: { prf: { eval: { first: new Uint8Array(prfInput) } } },
	}
	const credential = await navigator.credentials.create({ publicKey })
	const ext = credential?.getClientExtensionResults?.()
	const prf = ext?.prf?.results?.first
	const rawId = (credential)?.rawId
	if (!rawId || !prf) throw new Error("Passkey PRF not available")
	await passkey.resolvePasskeyRequest(requestId, { id: encodeBase64(rawId), prf: encodeBase64(prf) })
}

const handlePasskeyGet = async (requestId, pending) => {
	const challenge = crypto.getRandomValues(new Uint8Array(32))
	const te = new TextEncoder()
	const prfInput = await crypto.subtle.digest("SHA-256", te.encode(PASSKEY_PRF_LABEL))
	const publicKey = {
		challenge,
		rpId: "azguardwallet.io",
		userVerification: "required",
		timeout: 60_000,
		extensions: { prf: { eval: { first: new Uint8Array(prfInput) } } },
	}
	if (pending.credentialId) {
		const id = decodeBase64(pending.credentialId)
		publicKey.allowCredentials = [{ id, type: "public-key" }]
	}
	const assertion = await navigator.credentials.get({ publicKey })
	const ext = assertion?.getClientExtensionResults?.()
	const prf = ext?.prf?.results?.first
	const rawId = (assertion)?.rawId
	if (!rawId || !prf) throw new Error("Passkey PRF not available")
	await passkey.resolvePasskeyRequest(requestId, { id: encodeBase64(rawId), prf: encodeBase64(prf) })
}

const run = async () => {
	const requestId = route.query.requestId
	if (!requestId) {
		window.close()
		return
	}
	try {
		passkey.connect()
		const pending = await passkey.getPendingRequest(requestId)

		if (pending.mode === "create") {
			await handlePasskeyCreate(requestId)
		} else {
			await handlePasskeyGet(requestId, pending)
		}
	} catch (e) {
		try { await passkey.rejectPasskeyRequest(route.query.requestId, (e?.message ?? "Cancelled")) } catch {}
	} finally {
		passkey.disconnect()
		window.close()
	}
}

onMounted(() => { run() })
</script>

<template>
	<Flex align="center" justify="center" style="height: 100vh">
		<Text size="14" weight="600" color="primary"> Waiting for passkey... </Text>
	</Flex>
</template>
