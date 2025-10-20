<route lang="json">
{
	"meta": {
		"isAuthRequired": false,
		"requiresProfile": false
	}
}
</route>

<script setup lang="ts">
import { onMounted } from "vue"
import { PasskeyServiceClient } from "@/wallet/services/passkey/client"
import {
	PASSKEY_PRF_LABEL,
	PasskeyCredentialData,
	PendingPasskeyRequest,
} from "@/wallet/services/passkey/spec"
import { getErrorMessage } from "@/wallet/utils/errors"
import { getRandomHex } from "@/wallet/utils"

const route = useRoute()

const passkey = new PasskeyServiceClient()

function encodeBase64(buf: BufferSource): string {
	const bytes =
		buf instanceof ArrayBuffer
		? new Uint8Array(buf)
		: new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
	return Buffer.from(bytes).toString("base64");
}

const decodeBase64 = (b64: string) => Uint8Array.from(Buffer.from(b64, "base64"))

const handlePasskeyCreate = async (requestId: string) => {
	const challenge = crypto.getRandomValues(new Uint8Array(32))
	const te = new TextEncoder()
	const prfInput = await crypto.subtle.digest("SHA-256", te.encode(PASSKEY_PRF_LABEL))
	const publicKey: PublicKeyCredentialCreationOptions = {
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
		timeout: 60_000,
		extensions: { prf: { eval: { first: new Uint8Array(prfInput) } } },
	}
	const credential = await navigator.credentials.create({ publicKey })
	if (!credential) throw new Error("Failed to create passkey credential")
	if (!(credential instanceof PublicKeyCredential)) throw new Error("Unexpected credential type")
	const ext = credential.getClientExtensionResults()
	if (!ext.prf) throw new Error("Passkey PRF not available")
	if (!ext.prf.enabled) throw new Error("Passkey PRF is not enabled on credential creation")
	if (!ext.prf.results) throw new Error("Passkey PRF has no results")
	const prfResult = ext.prf.results.first
	const rawId = credential.rawId
	const passkeyCredentialData: PasskeyCredentialData = {
		id: encodeBase64(rawId),
		prf: encodeBase64(prfResult),
	}
	await passkey.resolvePasskeyRequest(requestId, passkeyCredentialData)
}

const handlePasskeyGet = async (requestId: string, pending: PendingPasskeyRequest) => {
	const challenge = crypto.getRandomValues(new Uint8Array(32))
	const te = new TextEncoder()
	const prfInput = await crypto.subtle.digest("SHA-256", te.encode(PASSKEY_PRF_LABEL))
	const publicKey: PublicKeyCredentialRequestOptions = {
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
	if (!assertion) throw new Error("Failed to get passkey assertion")
	if (!(assertion instanceof PublicKeyCredential)) throw new Error("Unexpected assertion type")
	const ext = assertion.getClientExtensionResults()
	if (!ext.prf) throw new Error("Passkey PRF not available")
	if (!ext.prf.results) throw new Error("Passkey PRF has no results")
	const prfResult = ext.prf.results.first
	const rawId = (assertion)?.rawId
	if (!rawId || !prfResult) throw new Error("Passkey PRF not available")
	await passkey.resolvePasskeyRequest(requestId, { id: encodeBase64(rawId), prf: encodeBase64(prfResult) })
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
		try { await passkey.rejectPasskeyRequest(route.query.requestId, getErrorMessage(e)) } catch {}
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
