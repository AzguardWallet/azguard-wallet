<script setup lang="ts">
/** Vendor */
import { onMounted, onUnmounted } from "vue"
import { hashToEmoji } from "@aztec/wallet-sdk/crypto"

/** Services */
import { DappSessionServiceClient, type DappSession } from "@/wallet/services/dapp-session/client"

const router = useRouter()

const session = ref<DappSession>()
const emojis = ref("")
const isReconnect = ref(false)
const alwaysTrust = ref(false)

const dappSessionService = new DappSessionServiceClient()

const handleConfirm = async () => {
	if (alwaysTrust.value && session.value) {
		await dappSessionService.setTrustedVerification(session.value.id, true)
	}
	closeWindow()
}

const closeWindow = () => {
	chrome.windows.getCurrent(undefined, (window) => {
		if (window.id) {
			chrome.windows.remove(window.id)
		}
	})
}

onMounted(async () => {
	dappSessionService.connect()

	const sessionId = router.currentRoute.value.query.sessionId as string
	isReconnect.value = router.currentRoute.value.query.isReconnect === "true"

	if (!sessionId) {
		closeWindow()
		return
	}

	try {
		session.value = await dappSessionService.getDappSession(sessionId)
		if (session.value?.verificationHash) {
			emojis.value = hashToEmoji(session.value.verificationHash)
		}
	} catch {
		closeWindow()
	}
})

onUnmounted(() => {
	dappSessionService.disconnect()
})
</script>

<template>
	<Flex v-if="session" direction="column" align="center" justify="between" :class="$style.wrapper">
		<Flex direction="column" align="center" gap="16">
			<Flex align="center" justify="center" gap="8" :style="{ paddingTop: '8px' }">
				<Text size="16" weight="600" color="primary">
					{{ isReconnect ? "Reconnected" : "Connection established" }}
				</Text>
			</Flex>

			<Flex direction="column" align="center" gap="4">
				<Icon name="dapp" size="48" color="blue" />
				<Text size="13" weight="600" color="primary">
					{{ session.dappMetadata.name ?? "Unknown DApp" }}
				</Text>
				<Text size="12" weight="600" color="tertiary">
					{{ session.dappMetadata.url }}
				</Text>
			</Flex>

			<Flex v-if="emojis" direction="column" align="center" gap="12">
				<EmojiGrid :emojis="emojis" />

				<Text size="12" color="secondary" :style="{ textAlign: 'center', lineHeight: '1.3', padding: '0 12px' }">
					Verify these emojis match what the app displays to confirm a secure connection
				</Text>
			</Flex>
		</Flex>

		<Flex direction="column" wide gap="12" :style="{ padding: '0 0 12px 0' }">
			<Flex
				align="center"
				gap="8"
				:class="$style.trust_toggle"
				@click="alwaysTrust = !alwaysTrust"
			>
				<Flex
					align="center"
					justify="center"
					:class="[$style.checkbox, alwaysTrust && $style.checked]"
				>
					<Icon v-if="alwaysTrust" name="check" size="10" color="inverse" />
				</Flex>
				<Text size="12" color="secondary">Always trust this app (skip verification on reconnect)</Text>
			</Flex>

			<Button @click="handleConfirm" wide type="primary" size="medium">
				<Text size="13" color="inverse">OK</Text>
			</Button>
		</Flex>
	</Flex>
</template>

<style module>
.wrapper {
	flex: 1;
	overflow: auto;

	background: var(--card-bg);
	box-shadow: 0 0 0 1px var(--gray-5);

	border-top-left-radius: 24px;
	border-top-right-radius: 24px;

	padding: 10px 24px 12px 24px;
}

.trust_toggle {
	cursor: pointer;
	padding: 8px 4px;
	border-radius: 8px;
	transition: background 0.15s ease;

	&:hover {
		background: var(--gray-3);
	}
}

.checkbox {
	width: 16px;
	height: 16px;
	min-width: 16px;
	border-radius: 4px;
	border: 1.5px solid var(--gray-20);
	transition: all 0.15s ease;
}

.checked {
	background: var(--blue);
	border-color: var(--blue);
}
</style>
