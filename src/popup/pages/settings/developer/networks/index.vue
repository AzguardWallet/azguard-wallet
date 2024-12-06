<route lang="json">
{
	"meta": {
		"isAuthRequired": true
	}
}
</route>

<script setup>
/** Components */
import Navigation from "../../../../components/Navigation.vue"

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
	appStore.network = target
	managers.network.setDefault(appStore.network.id)
	chrome.storage.local.set({ "azguard:ui:activeNetwork": appStore.network.id })
}

const handleEdit = target => {
	cacheStore.networkToEditIdx = target.id
	popupStore.open("edit_network")
}

const handleDelete = target => {
	if (appStore.networks.length === 1) return

	cacheStore.confirm.description =
		"By confirming this action, the selected network will be permanently deleted from the list"
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
	<Flex direction="column" gap="12" :class="$style.wrapper">
		<Flex align="center" gap="8">
			<RouterLink to="/popup/settings">
				<Text size="13" weight="600" color="tertiary" style="line-height: 16px"> Settings </Text>
			</RouterLink>
			<Text color="support">•</Text>
			<RouterLink to="/popup/settings/developer">
				<Text size="13" weight="600" color="tertiary" style="line-height: 16px"> Developer </Text>
			</RouterLink>
			<Text color="support">•</Text>
			<Text size="13" weight="600" color="tertiary" style="line-height: 16px"> Networks </Text>
		</Flex>

		<Flex direction="column" gap="16">
			<Text size="16" weight="600" color="primary">Networks</Text>

			<Flex v-if="appStore.network" direction="column" gap="6">
				<Flex
					v-for="network in appStore.networks"
					@click="handleSelectNetwork(network)"
					align="center"
					justify="between"
					:class="$style.network"
				>
					<Flex align="center" gap="10">
						<Icon
							:name="appStore.network.id == network.id ? 'check-circle' : 'globe'"
							size="16"
							:color="appStore.network.id === network.id ? 'green' : 'tertiary'"
						/>

						<Text size="14" weight="600" color="primary">
							{{ network.name }}
						</Text>

						<Badge variant="purple">
							<Text size="11" weight="700"> Custom </Text>
						</Badge>
					</Flex>

					<Flex align="center" gap="14" :class="$style.icons">
						<Flex align="center" gap="8">
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
								size="16"
								color="tertiary"
								:class="$style.icon_btn"
							/>
						</Flex>

						<Tooltip position="end">
							<Icon name="info" size="16" color="tertiary" />

							<template #content>
								<Flex direction="column" gap="6" align="center">
									<Text> <Text color="secondary">Chain ID:</Text> {{ network.chainId }} </Text>
									<Text> <Text color="secondary">RPC Link:</Text> {{ network.rpcUrl }} </Text>
								</Flex>
							</template>
						</Tooltip>
					</Flex>
				</Flex>
			</Flex>

			<Button
				@click="popupStore.open('new_network')"
				wide
				type="secondary"
				size="medium"
				leftIcon="plus-circle"
				leftIconColor="primary"
			>
				<Text size="13">Add network</Text>
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
	box-shadow: 0 0 0 1px var(--gray-5);

	border-top-left-radius: 24px;
	border-top-right-radius: 24px;

	padding: 20px 24px 80px 24px;
}

.network {
	border-radius: 12px;
	cursor: pointer;
	box-shadow: inset 0 0 0 1px var(--border), 0 1px 2px var(--shadow-5);

	padding: 12px;

	transition: all 0.2s var(--bezier);

	&:hover {
		background: var(--gray-3);
		box-shadow: inset 0 0 0 1px var(--border-hovered), 0 1px 2px var(--shadow-10);

		& .icons {
			opacity: 1;
		}
	}

	&:active {
		background: var(--gray-5);
	}
}

.icons {
	opacity: 0;

	transition: all 0.2s var(--bezier);
}

.icon_btn {
	transition: all 0.2s var(--bezier);

	&:hover {
		fill: var(--txt-primary);
	}
}
</style>
