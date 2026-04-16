<route lang="json">
{
	"meta": {
		"title": "Authwits",
		"isAuthRequired": true
	}
}
</route>

<script setup>
/** Components */
import { Dropdown } from "@/components/ui/Dropdown"
import Navigation from "../../../../../components/Navigation.vue"

/** Utils */
import { AuthRegistryServiceClient } from "@/wallet/services/auth-registry/client"
import { capitalize, stringCompare } from "@/utils/string"

/** Composables */
import { useToast } from "@/composables/toast.js"
const { openToast } = useToast()

/** Store */
import { useAppStore } from "@/stores/app.store"
import { usePopupStore } from "@/stores/popup.store"
import { useCacheStore } from "@/stores/cache.store"
const appStore = useAppStore()
const popupStore = usePopupStore()
const cacheStore = useCacheStore()

const authwits = ref([])
const filteredAuthwits = computed(() => {
	const res = [...authwits.value].sort((a, b) => {
		const contentA = a.content
		const contentB = b.content

		const kindPos = stringCompare(contentA.kind, contentB.kind)

		if (kindPos) return kindPos

		switch (contentA.kind) {
			case "call":
				return stringCompare(contentA.caller, contentB.caller)
			case "encoded_call":
				return stringCompare(contentA.caller, contentB.caller)
			case "intent":
				return stringCompare(contentA.consumer, contentB.consumer)
			case "message_hash":
				return 1

			default:
				return 1
		}
	})

	const term = searchTerm.value.trim().toLowerCase()
	if (!term) return res

	return res.filter((aw) => {
		const content = aw.content

		return (
			content.kind.toLowerCase().includes(term) ||
			aw.kindName.toLowerCase().includes(term) ||
			(content.caller ?? content.consumer ?? "").toLowerCase().includes(term) ||
			(content.contract ?? content.to ?? "").toLowerCase().includes(term) ||
			(content.method ?? content.selector ?? "").toLowerCase().includes(term)
		)
	})
})

const isFetchingAuthwits = ref(false)
const isRegistryEnabled = ref(true)
const isFetchingRegistryStatus = ref(false)

const error = ref()
const isErrorOccurred = computed(() => !!error.value)

const searchTerm = ref("")

const authwitsService = new AuthRegistryServiceClient()
authwitsService.onAuthwitAdded.add(onAuthwitAdded)
authwitsService.onAuthwitDeleted.add(onAuthwitDeleted)
authwitsService.onRegistryEnabled.add(onRegistryEnabled)
authwitsService.onRegistryDisabled.add(onRegistryDisabled)
function onAuthwitAdded(authwit) {
	const idx = authwits.value.findIndex((aw) => aw.id === authwit.id)
	if (idx === -1) {
		authwits.value.push(authwit)
		return
	}

	authwits.value[idx] = authwit
}
function onAuthwitDeleted(authwit) {
	authwits.value = authwits.value.filter((aw) => aw.id !== authwit.id)
}
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

async function fetchAuthwits(isRefetching) {
	if (isRefetching) openToast({ label: "Fetching authwits again", icon: "zap" })

	isFetchingAuthwits.value = true

	try {
		authwits.value = (await authwitsService.getAuthwits(appStore.account.address))?.map((aw) => {
			return {
				...aw,
				kindName: aw.content.kind
					.split("_")
					.map((k) => capitalize(k))
					.join(" "),
			}
		})
	} catch (err) {
		error.value = err
	} finally {
		isFetchingAuthwits.value = false
	}
}

async function fetchRegistryStatus() {
	isFetchingRegistryStatus.value = true

	try {
		isRegistryEnabled.value = await authwitsService.getRegistryEnabled(appStore.account.address)
	} catch (err) {
		error.value = err
	} finally {
		isFetchingRegistryStatus.value = false
	}
}

function changeAuthwitsRegistry() {
	popupStore.open("change_authwits_registry")
}

function revokeAuthwits(aw) {
	if (!aw) {
		cacheStore.preselectedAuthwits = authwits.value
	} else {
		cacheStore.preselectedAuthwits = [aw]
	}
	popupStore.open("revoke_authwits")
}

const handleOpenAuthwit = (aw) => {
	cacheStore.viewerData = aw.content
	popupStore.open("data_viewer")
}

watch(
	() => appStore.account,
	() => {
		fetchAuthwits()
		fetchRegistryStatus()
	},
)

onMounted(async () => {
	if (appStore.account && appStore.isLogined) {
		await fetchAuthwits()
		await fetchRegistryStatus()
	}
})

onBeforeUnmount(() => {
	authwitsService.disconnect()
})
</script>

<template>
	<Flex v-if="appStore.isLogined" direction="column" gap="20" :class="$style.wrapper">
		<Breadcrumbs>
			<template #right>
				<Dropdown>
					<Icon name="settings" color="secondary" size="14" :class="$style.btn" />

					<template #popup>
						<DropdownItem @click="changeAuthwitsRegistry">
							<Flex align="center" gap="8">
								<Icon name="lock" size="14" color="secondary" />
								{{ `${isRegistryEnabled ? 'Disable' : 'Enable'} authwits registry` }}
							</Flex>
						</DropdownItem>
						<DropdownItem @click="revokeAuthwits()" :disabled="!authwits.length">
							<Flex align="center" gap="8">
								<Icon name="close-circle" size="14" color="secondary" />
								Revoke all authwits
							</Flex>
						</DropdownItem>
					</template>
				</Dropdown>
			</template>
		</Breadcrumbs>

		<Flex direction="column" gap="16" wide>
			<Flex v-if="!isRegistryEnabled" align="center" justify="center" gap="6" wide :class="$style.warning">
				<Icon name="warning" color="orange" size="14" />
				<Text size="13" color="secondary">Account authwits registry
					<Text size="13" color="orange"> disabled</Text>
				</Text>
			</Flex>
			<Input
				v-if="authwits.length"
				v-model="searchTerm"
				icon="search"
				placeholder="Search by kind, address or function"
				clearable
				@clear="searchTerm = ''"
			/>

			<Banner v-if="isFetchingAuthwits" isLoading> Fetching authwits </Banner>

			<Tooltip v-else-if="isErrorOccurred" wide>
				<Banner :action="{ name: 'Try again', callback: () => fetchAuthwits(true) }" variant="error" wide>
					Something went wrong
				</Banner>

				<template #content>
					{{ error }}
				</template>
			</Tooltip>
			
			<Flex v-else-if="filteredAuthwits.length" direction="column" gap="8">
				<Flex v-for="aw in filteredAuthwits" @click="handleOpenAuthwit(aw)" direction="column" gap="6" :class="$style.card">
					<Flex align="center" justify="between" gap="12" wide>
						<Text size="14" weight="600" color="primary" :class="$style.row"> {{ aw.kindName ?? 'Custom Authwit' }} </Text>

						<Tooltip position="end">
							<Icon @click.stop="revokeAuthwits(aw)" name="close-circle" color="secondary" size="16" :class="$style.icon" />

							<template #content>
								Revoke authwit
							</template>
						</Tooltip>
					</Flex>

					<div :class="$style.divider" />

					<Flex v-if="aw.content.kind === 'call'" direction="column" gap="8">
						<Flex align="center" gap="4" wide :class="$style.content">
							<Text size="13" color="tertiary"> Caller: </Text>
							<AddressDisplay size="13" color="tertiary" weight="600" :address="aw.content.caller" full />
							<!-- <Text size="13" color="tertiary" weight="600"> {{ aw.content.caller }} </Text> -->
						</Flex>
						<Flex align="center" gap="4" wide :class="$style.content">
							<Text size="13" color="tertiary"> Contract: </Text>
							<AddressDisplay size="13" color="tertiary" weight="600" :address="aw.content.contract" full />
							<!-- <Text size="13" color="tertiary" weight="600"> {{ aw.content.contract }} </Text> -->
						</Flex>
						<Flex align="center" gap="4" wide :class="$style.content">
							<Text size="13" color="tertiary"> Method: </Text>
							<Text size="13" color="tertiary" weight="600"> {{ aw.content.method }} </Text>
						</Flex>
					</Flex>
					<Flex v-else-if="aw.content.kind === 'encoded_call'" direction="column" gap="8">
						<Flex align="center" gap="4" wide :class="$style.content">
							<Text size="13" color="tertiary"> Caller: </Text>
							<AddressDisplay size="13" color="tertiary" weight="600" :address="aw.content.caller" full />
							<!-- <Text size="13" color="tertiary" weight="600"> {{ aw.content.caller }} </Text> -->
						</Flex>
						<Flex align="center" gap="4" wide :class="$style.content">
							<Text size="13" color="tertiary"> To: </Text>
							<AddressDisplay size="13" color="tertiary" weight="600" :address="aw.content.to" full />
							<!-- <Text size="13" color="tertiary" weight="600"> {{ aw.content.to }} </Text> -->
						</Flex>
						<Flex align="center" gap="4" wide :class="$style.content">
							<Text size="13" color="tertiary"> Selector: </Text>
							<Text size="13" color="tertiary" weight="600"> {{ aw.content.selector }} </Text>
						</Flex>
					</Flex>
					<Flex v-else-if="aw.content.kind === 'intent'" direction="column" gap="8">
						<Flex align="center" gap="4" wide :class="$style.content">
							<Text size="13" color="tertiary"> Consumer: </Text>
							<AddressDisplay size="13" color="tertiary" weight="600" :address="aw.content.consumer" full />
							<!-- <Text size="13" color="tertiary" weight="600"> {{ aw.content.consumer }} </Text> -->
						</Flex>
						<Flex align="start" gap="4" wide :class="[$style.content_fix_lines, $style.content_2_lines]">
							<Text size="13" color="tertiary"> intent: </Text>
							<Text size="13" color="tertiary" weight="600"> {{ aw.content.intent.join(',\u00A0') }} </Text>
						</Flex>
					</Flex>
					<Flex v-else-if="aw.content.kind === 'message_hash'" direction="column" gap="8">
						<Flex align="start" gap="4" wide :class="[$style.content_fix_lines, $style.content_3_lines]">
							<Text size="13" color="tertiary"> Hash: </Text>
							<Text size="13" color="tertiary" weight="600"> {{ aw.content.messageHash }} </Text>
						</Flex>
					</Flex>
				</Flex>
			</Flex>

			<Flex v-else-if="filteredAuthwits.length === 0 && searchTerm" align="center" justify="center" gap="8" :style="{marginTop: '24px'}">
				<Text size="13" weight="600" color="tertiary"> No authwits found </Text>
			</Flex>

			<Banner v-else> So far, it's empty </Banner>
		</Flex>

		<Navigation />
	</Flex>
</template>

<style module>
.wrapper {
	flex: 1;
	overflow: auto;
	background: var(--app-bg);

	padding: 16px 24px 96px 24px;
}

.btn {
	cursor: pointer;

	transition: all 0.5 ease;

	&:hover {
		transform: scale(1.05);
		fill: var(--txt-primary);
	}
}

.warning {
	padding: 4px;
}

.card {
	border-radius: 12px;
	cursor: pointer;
	box-shadow: inset 0 0 0 1px var(--border), 0 1px 2px var(--shadow-5);

	padding: 12px;

	transition: all 0.2s var(--bezier);

	&:hover {
		background: var(--gray-3);
		box-shadow: inset 0 0 0 1px var(--border-hovered), 0 1px 2px var(--shadow-10);

		& .icon {
			opacity: 1;
		}
	}

	&:active {
		background: var(--gray-5);
	}
}

.icon {
	transition: all 0.5 ease;
	opacity: 0;
	&:hover {
		transform: scale(1.05);
		fill: var(--txt-primary);
	}
}

.badge {
	border-radius: 6px;
	padding: 2px 4px;
	color: var(--txt-inverse);
}

.divider {
	width: 100%;
	height: 1px;

	margin: 4px 0;
	
	background: linear-gradient(
		to right,
		transparent 0%,
		var(--gray-20) 20%,
		var(--gray-20) 80%,
		transparent 100%
	);
}

.row {
	text-overflow: ellipsis;
	overflow: hidden;
	white-space: nowrap;
}

.content {
	max-width: 100%;

	& span:last-child {
		text-overflow: ellipsis;
		overflow: hidden;
		white-space: nowrap;
	}
}

.content_fix_lines {
	max-width: 100%;
	
	& span:last-child {
		line-height: 1.2;

		display: -webkit-box;
		
		white-space: normal;
		overflow: hidden;
		overflow-wrap: anywhere;
		text-overflow: ellipsis;

		box-orient: vertical;

		-webkit-box-orient: vertical;
	}
}
.content_2_lines {
	& span:last-child {
		line-clamp: 2;
		-webkit-line-clamp: 2;
	}
}

.content_3_lines {
	& span:last-child {
		line-clamp: 3;
		-webkit-line-clamp: 3;
	}
}
</style>
