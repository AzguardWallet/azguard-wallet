<route lang="json">
{
	"meta": {
		"isAuthRequired": true
	}
}
</route>

<script setup>
/** Components */
import NetworkBadge from "@/popup/components/modules/general/NetworkBadge.vue"

/** Utils */
import { managers } from "@/utils/core"
import { getChainPosition } from "@/components/ui/utils"
import { stringCompare } from "@/utils/string"

/** Composables */
import { useToast } from "@/composables/toast"
const { openToast } = useToast()

/** Store */
import { useAppStore } from "@/stores/app.store"
import { usePopupStore } from "@/stores/popup.store"
import { useCacheStore } from "@/stores/cache.store"
const appStore = useAppStore()
const popupStore = usePopupStore()
const cacheStore = useCacheStore()

const networks = computed(() =>
	[...appStore.networks].sort((a, b) => {
		const chainPos = getChainPosition(a.chainId) - getChainPosition(b.chainId)
		return chainPos ? chainPos : stringCompare(a.name, b.name)
	}),
)

const handleSelectNetwork = (target) => {
	if (appStore.network.id === target.id) return
	managers.network.setDefault(target.id)
	appStore.network = target
	chrome.storage.local.set({ [`nulo:ui:lastActiveNetwork@${appStore.profile.id}`]: target.id })
}

const handleEdit = (target) => {
	cacheStore.networkToEditIdx = target.id
	popupStore.open("edit_network")
}

const handleDelete = (target) => {
	if (appStore.networks.length === 1) return

	cacheStore.confirm.confirm_text = "Yes, delete network"
	cacheStore.confirm.confirm_color = "red"
	cacheStore.confirm.title = "Delete this network?"
	cacheStore.confirm.description = "By confirming this action, the selected network will be permanently deleted from your wallet"
	cacheStore.confirm.callback = async () => {
		await appStore.removeNetwork(target)

		appStore.network = appStore.networks[0]
		managers.network.setDefault(appStore.network.id)
		chrome.storage.local.set({ [`nulo:ui:lastActiveNetwork@${appStore.profile.id}`]: appStore.network.id })

		openToast({ label: "Network is deleted" })
	}

	popupStore.open("confirm")
}
</script>

<template>
	<Flex direction="column" :class="$style.wrapper">
		<SubPageHeader title="Manage Networks" :backTo="'/popup/settings/general'" />

		<Flex direction="column" gap="16" :class="$style.content">
			<div :class="$style.section_label">
				<span>Networks</span>
				<span :class="$style.section_count">{{ networks.length }}</span>
			</div>

			<ItemsContainer>
				<SettingItem
					v-for="network in networks"
					@click="handleSelectNetwork(network)"
					:title="network.name"
					:icon="appStore.network?.id === network.id ? 'check-circle' : 'circle'"
					:iconFillColor="appStore.network?.id === network.id ? 'primary' : 'tertiary'"
					iconBgColor="transparent"
				>
					<template #right>
						<NetworkBadge :chainId="network.chainId" />

						<Flex align="center" gap="8">
							<Tooltip position="end" delay="350">
								<Icon
									@click.stop="handleEdit(network)"
									name="edit"
									size="14"
									color="tertiary"
									:class="$style.icon_btn"
								/>

								<template #content> Edit network </template>
							</Tooltip>

							<Tooltip position="end" delay="350">
								<Icon
									v-if="appStore.networks.length > 1"
									@click.stop="handleDelete(network)"
									name="close-circle"
									size="14"
									color="tertiary"
									:class="$style.icon_btn"
								/>

								<template #content> Delete network </template>
							</Tooltip>
						</Flex>
					</template>
				</SettingItem>
			</ItemsContainer>

			<Button
				@click="popupStore.open('new_network')"
				wide
				type="secondary"
				size="medium"
				leftIcon="plus-circle"
				leftIconColor="primary"
			>
				<Text size="13">New network</Text>
			</Button>
		</Flex>

	</Flex>
</template>

<style module>
.wrapper {
	flex: 1;
	overflow: auto;
	background: var(--app-bg);
	scrollbar-gutter: stable;
}

.content {
	padding: 16px 24px var(--nav-clearance) 24px;
}

.section_label {
	display: flex;
	align-items: baseline;
	gap: 10px;

	font-family: var(--font-headline);
	font-size: 12px;
	font-weight: 700;
	letter-spacing: 0.1em;
	text-transform: uppercase;
	color: var(--nulo-secondary);
}

.section_count {
	font-family: var(--font-mono);
	font-size: 10px;
	color: var(--nulo-outline);
}

.icon_btn {
	transition: all 0.2s var(--bezier);

	&:hover {
		fill: var(--txt-primary);
	}
}
</style>
