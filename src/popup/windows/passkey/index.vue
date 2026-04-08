<route lang="json">
{
	"meta": {
		"isAuthRequired": false,
		"isPasskeyInteraction": true
	}
}
</route>

<script setup lang="ts">
import { onMounted } from "vue"
import { PasskeyServiceClient } from "@/wallet/services/passkey/client"
import { PASSKEY_PRF_LABEL, type PasskeyCredentialData, type PasskeyRequest, PASSKEY_TIMEOUT } from "@/wallet/services/passkey/spec"
import { getErrorMessage } from "@/wallet/utils/errors"

const route = useRoute()

const passkey = new PasskeyServiceClient()

function encodeBase64(buf: BufferSource): string {
	const bytes = buf instanceof ArrayBuffer ? new Uint8Array(buf) : new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength)
	return Buffer.from(bytes).toString("base64")
}

const decodeBase64 = (b64: string) => Uint8Array.from(Buffer.from(b64, "base64"))

const handlePasskeyCreate = async (requestId: string, request: PasskeyRequest) => {
	if (request.mode !== "create") throw new Error("Invalid request mode")
	const challenge = crypto.getRandomValues(new Uint8Array(32))
	const te = new TextEncoder()
	const prfInput = await crypto.subtle.digest("SHA-256", te.encode(PASSKEY_PRF_LABEL))
	const userHandle = Uint8Array.from(Buffer.from(request.userHandle, "hex"))
	const publicKey: PublicKeyCredentialCreationOptions = {
		challenge,
		rp: {
			name: "Vibeguard",
			id: "azguardwallet.io", // Keep RP ID to not break existing passkeys
		},
		user: {
			id: userHandle,
			name: `profile-${request.userHandle}`,
			displayName: "Vibeguard Profile",
		},
		pubKeyCredParams: [{ type: "public-key", alg: -7 }],
		authenticatorSelection: {
			residentKey: "required",
			userVerification: "required",
			requireResidentKey: true,
		},
		// attestation: "direct",
		timeout: PASSKEY_TIMEOUT,
		extensions: { prf: { eval: { first: new Uint8Array(prfInput) } } },
	}
	const credential = await navigator.credentials.create({ publicKey })
	if (!credential) throw new Error("Failed to create passkey credential")
	if (!(credential instanceof PublicKeyCredential)) throw new Error("Unexpected credential type")
	const ext = credential.getClientExtensionResults()
	if (!ext.prf) throw new Error("Passkey PRF not available")

	const isPrfEnabledOnCreation = ext.prf.enabled
	if (isPrfEnabledOnCreation) {
		if (!ext.prf.results) throw new Error("Passkey PRF has no results")
		const prfResult = ext.prf.results.first
		const rawId = credential.rawId
		const passkeyCredentialData: PasskeyCredentialData = {
			id: encodeBase64(rawId),
			prf: encodeBase64(prfResult),
			userHandle: request.userHandle,
		}
		await passkey.resolvePasskeyRequest(requestId, passkeyCredentialData)
	} else {
		const rawIdB64 = encodeBase64(credential.rawId)
		await handlePasskeyGet(requestId, { mode: "get", credentialId: rawIdB64 } as PasskeyRequest)
	}
}

const handlePasskeyGet = async (requestId: string, request: PasskeyRequest) => {
	if (request.mode !== "get") throw new Error("Invalid request mode")
	const challenge = crypto.getRandomValues(new Uint8Array(32))
	const te = new TextEncoder()
	const prfInput = await crypto.subtle.digest("SHA-256", te.encode(PASSKEY_PRF_LABEL))
	const publicKey: PublicKeyCredentialRequestOptions = {
		challenge,
		rpId: "azguardwallet.io",
		userVerification: "required",
		timeout: PASSKEY_TIMEOUT,
		extensions: { prf: { eval: { first: new Uint8Array(prfInput) } } },
	}
	if (request.credentialId) {
		const id = decodeBase64(request.credentialId)
		publicKey.allowCredentials = [{ id, type: "public-key" }]
	}
	const assertion = await navigator.credentials.get({ publicKey })
	if (!assertion) throw new Error("Failed to get passkey assertion")
	if (!(assertion instanceof PublicKeyCredential)) throw new Error("Unexpected assertion type")
	const ext = assertion.getClientExtensionResults()
	if (!ext.prf) throw new Error("Passkey PRF not available")
	if (!ext.prf.results) throw new Error("Passkey PRF has no results")
	const prfResult = ext.prf.results.first
	const rawId = assertion?.rawId
	if (!rawId || !prfResult) throw new Error("Passkey PRF not available")
	if (!(assertion.response instanceof AuthenticatorAssertionResponse)) throw new Error("Unexpected assertion response type")
	const userHandleOption = assertion.response.userHandle
	const passkeyCredentialData: PasskeyCredentialData = {
		id: encodeBase64(rawId),
		prf: encodeBase64(prfResult),
		userHandle: userHandleOption ? Buffer.from(userHandleOption).toString("hex") : undefined,
	}
	await passkey.resolvePasskeyRequest(requestId, passkeyCredentialData)
}

const run = async () => {
	const requestId = route.query.requestId
	if (!requestId) {
		window.close()
		return
	}
	try {
		passkey.connect()
		const request = await passkey.getPendingRequest(requestId)

		if (request.mode === "create") {
			await handlePasskeyCreate(requestId, request)
		} else {
			await handlePasskeyGet(requestId, request)
		}
	} catch (e) {
		passkey.rejectPasskeyRequest(requestId, getErrorMessage(e))
	} finally {
		passkey.disconnect()
		window.close()
	}
}

onMounted(() => {
	run()
})
</script>

<template>
	<Flex align="center" justify="center" :class="$style.wrapper">
		<Text size="14" weight="600" color="primary"> Waiting for passkey... </Text>
	</Flex>
</template>

<style module>
.wrapper {
	height: 100%;
}
</style>
