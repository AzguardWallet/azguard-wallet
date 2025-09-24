<script setup>
/** Components */
import Popup from "@/components/ui/Popup/Popup.vue"
import PopupCard from "@/components/ui/Popup/PopupCard.vue"
import PopupHeader from "@/components/ui/Popup/PopupHeader.vue"
import FeeSettingsCard from "@/popup/components/modules/send/FeeSettingsCard.vue"

/** Utils */
import { AuthRegistryServiceClient, MAX_REVOKES_PER_TX } from "@/wallet/services/auth-registry/client"
import { sleep } from "@/wallet/utils"

/** Composables */
import { useToast } from "@/composables/toast"
const { openToast } = useToast()

/** Store */
import { useAppStore } from "@/stores/app.store"
import { useCacheStore } from "@/stores/cache.store"
import { usePopupStore } from "@/stores/popup.store"
const appStore = useAppStore()
const cacheStore = useCacheStore()
const popupStore = usePopupStore()

const displaceIdx = computed(() => {
	return popupStore.len - popupStore.popups.revoke_authwits?.order
})

const emit = defineEmits(["onClose"])
const props = defineProps({
	show: Boolean,
})

const authwitsService = new AuthRegistryServiceClient()
authwitsService.onRegistryEnabled.add(onRegistryEnabled)
authwitsService.onRegistryDisabled.add(onRegistryDisabled)
function onRegistryEnabled(account) {
	if (appStore.account?.address === account) {
		isRegistryEnabled.value = true
	}
}
function onRegistryDisabled(account) {
	if (appStore.account?.address === account) {
		isRegistryEnabled.value = false
	}
}

const authwits = ref([])
const chunkedAuthwits = ref([])
const chunkesCount = computed(() => chunkedAuthwits.value.length)
const isRegistryEnabled = ref(undefined)
const isLoading = ref(false)
const error = ref()
const isErrorOccurred = computed(() => !!error.value)

async function fetchRegistryStatus() {
	isLoading.value = true

	try {
		isRegistryEnabled.value = await authwitsService.getRegistryEnabled(appStore.account.address)
	} catch (err) {
		error.value = err
	} finally {
		isLoading.value = false
	}
}

function chunkAuthwits() {
	chunkedAuthwits.value = authwits.value
		.reduce((acc, _, i) => {
			if (i % MAX_REVOKES_PER_TX === 0) {
				acc.push(authwits.value.slice(i, i + MAX_REVOKES_PER_TX))
			}
			return acc
		}, [])
		.map(ch => ({
			ids: ch.map(c => c.id),
			content: ch.map(c => c.content),
			count: ch.length,
			feeSetting: null,
			status: "prepare",
		}))
}

const isAllowedToExecute = computed(() => {
	if (chunkedAuthwits.value.filter(ch => !ch.feeSettings).length) return

	return true
})

async function handleRevokeAuthwits() {
	if (!isAllowedToExecute) return

	isLoading.value = true

	for (const ch of chunkedAuthwits.value) {
		try {
			ch.status = "progress"
			await authwitsService.revokeAuthwits(appStore.network.id, appStore.account.address, ch.ids, ch.feeSettings)
			ch.status = "success"
		} catch (err) {
			ch.status = "error"
			ch.error = err
		}
	}

	isLoading.value = false
	const errors = chunkedAuthwits.value.filter(ch => !!ch.error).map(ch => ch.error)
	if (errors.length) {
		openToast({ label: `Failed to revoke ${errors.length === chunkesCount.value ? '' : 'some '}authwit(s)`, icon: "warning" })
		error.value = errors.join(", ")
	} else {
		openToast({ label: "Authwit(s) successfully revoked" })
		emit("onClose")
	}
}

function showChunkContent(chunk) {
	cacheStore.viewerData = chunk.content
	popupStore.open("data_viewer")
}

watch(
	() => props.show,
	async () => {
		if (props.show) {
			await fetchRegistryStatus()

			authwits.value = cacheStore.preselectedAuthwits
			chunkAuthwits()

			document.addEventListener("keydown", onKeydown)
		} else {
			authwits.value = []
			chunkedAuthwits.value = []
			isRegistryEnabled.value = undefined
			isLoading.value = false
			error.value = null

			authwitsService.disconnect()

			document.removeEventListener("keydown", onKeydown)
		}
	},
)

const onKeydown = e => {
	if (e.key === "Enter") handleRevokeAuthwits()
}
</script>

<template>
	<Popup :show @onClose="emit('onClose')" :displaceIdx="popupStore.popups.revoke_authwits?.order">
		<PopupCard :displaceIdx>
			<PopupHeader @onClose="emit('onClose')" closable>
				<template #title>
					<Text size="14" weight="600" color="primary">Revoke authwits</Text>
				</template>
			</PopupHeader>

			<Flex direction="column" gap="20" wide :class="$style.wrapper">
				<Banner v-if="!isRegistryEnabled" direction="vertical">
					<template #title>No need to revoke authwits</template>
					<template #description>
						Since Authwits Registry is currently disabled for this account, all issued authwits are already blocked and cannot be executed. 
						You don’t need to spend gas or send a transaction to revoke them — but you can still do it if you want.
					</template>
				</Banner>
				<Banner v-else-if="chunkesCount > 1" direction="vertical">
					<template #title>Multiple transactions required</template>
					<template #description>
						{{ `Due to Aztec protocol limits, only ${MAX_REVOKES_PER_TX} authwits can be revoked in a single transaction. 
						Your authwits have been split into the minimum number of required transactions. 
						Alternatively, you may disable Authwits Registry instead — this will block execution 
						of all current authwits until the registry is enabled again. 
						You can still proceed with revocation if you prefer.` }}
					</template>
				</Banner>
				<Banner v-else-if="chunkesCount === 1" direction="vertical">
					<template #title>Revoke authwits</template>
					<template #description>
						This transaction will revoke the selected authwits. Once revoked, they cannot be executed anymore.
					</template>
				</Banner>

				<template
					v-if="chunkesCount"
					v-for="(ch, i) in chunkedAuthwits"
				>
					<Flex
						direction="column"
						wide
						:class="$style.chunk_card"
					>
						<Flex align="center" justify="between" wide :class="$style.header">
							<Flex align="end" gap="4">
								<Text v-if="chunkesCount > 1" size="13" color="primary"> {{ `#${i + 1}` }} </Text>
								<Text size="13" color="primary">Revoke authwits</Text>
								<Text v-if="ch.count > 1" size="12" color="tertiary"> {{ `(${ch.count})` }} </Text>
							</Flex>
							<Tooltip position="end">
								<Icon @click="showChunkContent(ch)" name="expand" size="16" color="tertiary" :class="$style.fullscreen_icon" />

								<template #content>
									<Text size="12" color="secondary">View authwits content</Text>
								</template>
							</Tooltip>
							
						</Flex>

						<FeeSettingsCard
							:profile="appStore.profile"
							:network="appStore.network"
							:account="appStore.account"
							:modelValue="ch.feeSettings"
							@update:modelValue="
								$event => {
									ch.feeSettings = $event
								}
							"
						/>

						<div v-if="ch.status === 'progress'" :class="[$style.status_line, $style.runner]" />
						<div
							v-else
							:class="[
								$style.status_line,
								(!ch?.status || ch.status === 'prepare') && $style.waiting,
								ch.status === 'success' && $style.success,
								ch.status === 'error' && $style.error,
							]"
						/>
					</Flex>

					<Tooltip v-if="ch.error && chunkesCount > 1" side="top">
						<Flex align="center" gap="6" style="margin-top: -8px;">
							<Icon name="info" size="12" color="red" />
							<Text size="12" weight="500" color="secondary">
								Finished with an error
							</Text>
						</Flex>

						<template #content> {{ ch.error }} </template>
					</Tooltip>

				</template>

				<Flex align="center" direction="column" gap="12">
					<Button
						@click="handleRevokeAuthwits"
						type="primary"
						size="medium"
						wide
						:loading="isLoading"
						:disabled="!isAllowedToExecute || isErrorOccurred"
					>
						Revoke
					</Button>

					<Tooltip v-if="isErrorOccurred" side="top" wide>
						<Flex align="center" justify="start" gap="6" wide>
							<Icon name="info" size="12" color="red" />
							<Text size="12" weight="500" color="secondary">
								An error occurred
							</Text>
						</Flex>

						<template #content> {{ error }} </template>
					</Tooltip>
				</Flex>
			</Flex>
		</PopupCard>
	</Popup>
</template>

<style module>
.wrapper {
	padding: 0 20px 24px 20px;
}

.chunk_card {
	position: relative;

	border-radius: 12px;
	overflow: hidden;
	box-shadow: 0 1px 2px var(--shadow-5), inset 0 0 0 1px var(--border);

	.header {
		padding: 12px;
	}

	.row {
		padding: 0 0 8px 8px;

	}
	
	.fullscreen_icon {
		cursor: pointer;
		&:hover {
			fill: var(--txt-primary);
		}
	}
}

.status_line {
	position: absolute;
	bottom: 0px;
	width: 100%;

	opacity: 1;
	height: 1px;
}

.waiting {
	background: linear-gradient(90deg, rgba(10, 222, 113, 0%) 0%, var(--txt-support), rgba(10, 222, 113, 0%) 100%);
}

.success {
	background: linear-gradient(90deg, rgba(10, 222, 113, 0%) 0%, var(--green), rgba(10, 222, 113, 0%) 100%);
}

.error {
	background: linear-gradient(90deg, rgba(10, 222, 113, 0%) 0%, var(--red), rgba(10, 222, 113, 0%) 100%);
}

.runner {
	width: 100%;
	height: 2px;

	background: linear-gradient(90deg, rgba(7, 106, 205, 0%), var(--blue), rgba(7, 106, 205, 0%));

	animation: runner 2s ease infinite;
	filter: blur(1px);
}

@keyframes runner {
	0% {
		transform: translateX(-200px);
	}

	50% {
		transform: translateX(200px);
	}

	100% {
		transform: translateX(-200px);
	}
}
</style>
