<route lang="json">
{
	"meta": {
		"title": "Manage nodes",
		"isAuthRequired": true
	}
}
</route>

<script setup>
/** Components */
import Navigation from "../../../../components/Navigation.vue"
import Breadcrumbs from "@/components/ui/Settings/Breadcrumbs.vue"
import PageHeader from "@/components/ui/Settings/PageHeader.vue"
import ItemsContainer from "@/components/ui/Settings/ItemsContainer.vue"
import SettingItem from "@/components/ui/Settings/SettingItem.vue"
import NetworkBadge from "@/popup/components/modules/general/NetworkBadge.vue"

/** Utils */
import { managers } from "@/utils/core"

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

const handleSelectNetwork = target => {
	if (appStore.network.id === target.id) return
	managers.network.setDefault(appStore.network.id)
	appStore.network = target
	chrome.storage.local.set({ "azguard:ui:activeNetwork": appStore.network.id })
}

const handleEdit = target => {
	cacheStore.networkToEditIdx = target.id
	popupStore.open("edit_network")
}

const handleDelete = target => {
	if (appStore.networks.length === 1) return

	cacheStore.confirm.confirm_text = "Yes, delete node"
	cacheStore.confirm.confirm_color = "red"
	cacheStore.confirm.description =
		"By confirming this action, the selected node will be permanently deleted from your wallet"
	cacheStore.confirm.callback = async () => {
		await appStore.removeNetwork(target)

		appStore.network = appStore.networks[0]
		managers.network.setDefault(appStore.networks[0].id)
		chrome.storage.local.set({ "azguard:ui:activeNetwork": appStore.network.id })

		openToast({ label: "Network is deleted" })
	}

	popupStore.open("confirm")
}
</script>

<template>
	<Flex direction="column" gap="20" :class="$style.wrapper">
		<Breadcrumbs />

		<Flex direction="column" gap="16">
			<Text size="13" weight="600" color="primary">
				Nodes &nbsp;<Text color="tertiary">{{ appStore.networks.length }} </Text>
			</Text>

			<ItemsContainer>
				<SettingItem
					v-for="network in appStore.networks"
					@click="handleSelectNetwork(network)"
					:title="network.name"
					:icon="appStore.network?.id === network.id ? 'check' : 'n'"
					iconFillColor="blue"
					iconBgColor="transparent"
				>
					<template #right>
						<NetworkBadge :chainId="network.chainId" />

						<Flex align="center" gap="8">
							<Tooltip side="left">
								<Icon name="info" size="14" color="tertiary" />

								<template #content>
									<Flex direction="column" gap="6" align="center">
										<Text> <Text color="secondary">ID:</Text> {{ network.chainId }} </Text>
										<Text> <Text color="secondary">URL:</Text> {{ network.rpcUrl }} </Text>
									</Flex>
								</template>
							</Tooltip>

							<Icon
								@click.stop="handleEdit(network)"
								name="edit"
								size="14"
								color="tertiary"
								:class="$style.icon_btn"
							/>
							<Icon
								v-if="appStore.networks.length > 1"
								@click.stop="handleDelete(network)"
								name="close-circle"
								size="14"
								color="tertiary"
								:class="$style.icon_btn"
							/>
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
				<Text size="13">New node</Text>
			</Button>
		</Flex>

		<Navigation />
	</Flex>
</template>

<style module>
.wrapper {
	flex: 1;

	overflow: auto;

	background: var(--card-bg);
	border-top: 2px solid var(--gray-8);
	box-shadow: inset 0 10px 8px -2px var(--gray-3);

	border-top-left-radius: 24px;
	border-top-right-radius: 24px;

	padding: 20px 24px 80px 24px;
}

.icon_btn {
	transition: all 0.2s var(--bezier);

	&:hover {
		fill: var(--txt-primary);
	}
}
</style>
