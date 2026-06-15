<script setup lang="ts">
/** Vendor */
import { onBeforeMount, onMounted, onUnmounted } from "vue"

/** Components */
import EmojiGrid from "@/popup/components/modules/capabilities/EmojiGrid.vue"

/** Utils */
import { getErrorData } from "@/wallet/utils/errors"

/** Services */
import { VerificationPayload, DappInteractionServiceClient } from "@/wallet/services/dapp-interaction/client"

/** Store */
import { useAppStore } from "@/stores/app.store"
const appStore = useAppStore()

const router = useRouter()

const requestId = ref<string>()
const payload = ref<VerificationPayload>()

const dappName = computed(() => payload.value?.params.dappMetadata.name ?? "Unknown DApp")
const dappUrl = computed(() => payload.value?.params.dappMetadata.url)
const verificationHash = computed(() => payload.value?.params.verificationHash ?? null)

const initRequest = async () => {
	try {
		requestId.value = router.currentRoute.value.query.requestId?.toString()
		if (!requestId.value) {
			throw new Error("Invalid interaction request id")
		}
		payload.value = (await interactionService.getInteractionPayload(requestId.value)) as VerificationPayload
	} catch (error) {
		console.error(getErrorData(error))
	}
}

const resolveWith = (action: "match" | "mismatch") => {
	return interactionService.resolveInteraction(requestId.value!, { action })
}

const confirmMatch = async () => {
	await resolveWith("match")
	closeWindow()
}

const reportMismatch = async () => {
	await resolveWith("mismatch")
	closeWindow()
}

/** Closing the window without an explicit choice counts as a passive "match" */
const resolvePassive = () => {
	resolveWith("match")
}

const onInteractionCancelled = (_requestId: string) => {
	// The dApp confirmed the connection (or the session ended) — verification window is no longer needed
	if (requestId.value === _requestId) {
		resolvePassive()
		closeWindow()
	}
}

const closeWindow = () => {
	window.removeEventListener("beforeunload", resolvePassive)
	chrome.windows.getCurrent(undefined, window => {
		if (window.id) {
			chrome.windows.remove(window.id)
		}
	})
}

const interactionService = new DappInteractionServiceClient()
interactionService.onInteractionCancelled.add(onInteractionCancelled)

onBeforeMount(async () => {
	if (!appStore.isLogined) {
		setTimeout(() => {
			appStore.pageAwaitingAuth = router.currentRoute.value.fullPath
			router.push({
				path: "/popup/auth",
			})
		}, 100)
	}
})

onMounted(async () => {
	interactionService.connect()
	await initRequest()
	window.addEventListener("beforeunload", resolvePassive)
})

onUnmounted(() => {
	interactionService.disconnect()
	window.removeEventListener("beforeunload", resolvePassive)
})
</script>

<template>
	<Flex v-if="appStore.isLogined" direction="column" justify="between" :class="$style.wrapper">
		<Flex direction="column" align="center" gap="16">
			<Flex align="center" justify="center" :style="{ paddingTop: '8px' }">
				<Text size="16" weight="600" color="primary">Verify connection</Text>
			</Flex>

			<Flex direction="column" align="center" gap="4">
				<Text size="13" weight="600" color="primary">{{ dappName }}</Text>
				<Text v-if="dappUrl" size="13" color="secondary">{{ dappUrl }}</Text>
			</Flex>

			<EmojiGrid v-if="verificationHash" :hash="verificationHash" size="large" />

			<Flex direction="column" align="center" gap="6" :class="$style.description">
				<Text size="13" color="primary">Compare these emojis with the ones shown in the dapp</Text>
				<Text size="12" color="secondary">
					If they don't match, someone may be intercepting the connection
				</Text>
			</Flex>
		</Flex>

		<Flex align="center" justify="between" gap="12" :style="{ marginTop: '16px' }">
			<Button @click="reportMismatch" wide type="secondary" size="medium">
				<Text size="13" color="red">Don't match</Text>
			</Button>

			<Button @click="confirmMatch" wide type="primary" size="medium">
				<Text size="13" color="inverse">They match</Text>
			</Button>
		</Flex>
	</Flex>
</template>

<style module>
.wrapper {
	overflow: auto;
	flex: 1;

	background: var(--card-bg);
	box-shadow: 0 0 0 1px var(--gray-5);

	border-top-left-radius: 24px;
	border-top-right-radius: 24px;

	padding: 10px 24px 12px 24px;
}

.description {
	text-align: center;
	line-height: 1.4;

	padding: 0 8px;
}
</style>
