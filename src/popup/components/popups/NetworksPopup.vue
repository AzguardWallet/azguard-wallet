<script setup>
/** Components */
import NetworkBadge from "@/popup/components/modules/general/NetworkBadge.vue"
import Popup from "@/components/ui/Popup/Popup.vue"
import PopupCard from "@/components/ui/Popup/PopupCard.vue"

/** Services */
import { managers } from "@/utils/core.js"

/** Store */
import { useAppStore } from "@/stores/app.store"
import { usePopupStore } from "@/stores/popup.store"
const appStore = useAppStore()
const popupStore = usePopupStore()

const emit = defineEmits(["onClose"])
const props = defineProps({
	show: Boolean,
})

const displaceIdx = computed(() => {
	return popupStore.len - popupStore.popups.networks
})

const router = useRouter()

const handleSelectNetwork = target => {
	if (appStore.network.id === target.id) return
	managers.network.setDefault(appStore.network.id)
	appStore.network = target
	chrome.storage.local.set({ "azguard:ui:activeNetwork": appStore.network.id })

	emit("onClose")
}

const handleManageNetworks = () => {
	router.push("/popup/settings/developer/networks")
	emit("onClose")
}
</script>

<template>
	<Popup :show @onClose="emit('onClose')" :displaceIdx="popupStore.popups.networks">
		<PopupCard :displaceIdx>
			<Flex wide direction="column" justify="between" gap="16" :class="$style.wrapper">
				<Flex direction="column" gap="16">
					<Flex align="center" justify="between">
						<Text size="14" weight="600" color="primary"> Select node </Text>

						<Flex
							@click="handleManageNetworks"
							align="center"
							gap="4"
							:class="['clickable', $style.txt_button]"
						>
							<Text size="13" weight="600" color="tertiary"> Manage node </Text>
							<Icon name="arrow-narrow-up-right" size="12" color="tertiary" />
						</Flex>
					</Flex>
					<Flex direction="column" gap="6">
						<Flex
							v-for="network in appStore.networks"
							@click="handleSelectNetwork(network)"
							align="center"
							justify="between"
							:class="$style.network"
						>
							<Flex align="center" gap="10">
								<Icon
									:name="appStore.network.id === network.id ? 'check-circle' : 'globe'"
									size="16"
									:color="appStore.network.id === network.id ? 'green' : 'tertiary'"
								/>

								<Text size="14" weight="600" color="primary">
									{{ network.name }}
								</Text>

								<NetworkBadge :chainId="network.chainId" />
							</Flex>

							<Tooltip position="end">
								<Icon name="info" size="14" color="tertiary" />

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

				<Flex direction="column" gap="12">
					<Button
						@click="popupStore.open('new_network')"
						wide
						type="secondary"
						size="medium"
						leftIcon="plus-circle"
						leftIconColor="primary"
					>
						Add node
					</Button>

					<Text size="12" weight="500" color="tertiary" height="140" align="center">
						To add a new node, come up with a unique name and provide an RPC link
					</Text>
				</Flex>
			</Flex>
		</PopupCard>
	</Popup>
</template>

<style module>
.wrapper {
	flex: 1;

	padding: 0 20px 24px 20px;
}

.network {
	border-radius: 12px;
	cursor: pointer;
	box-shadow: inset 0 0 0 1px var(--border), 0 1px 2px var(--shadow-5);

	padding: 12px;

	transition: all 0.2s var(--bezier);

	&:hover {
		background: var(--gray-3);
		box-shadow: inset 0 0 0 1px var(--border-hovered), 0 1px 2px var(--shadow-5);

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

.txt_button {
	& span,
	& svg {
		transition: all 0.2s var(--bezier);
	}

	&:hover {
		& span,
		& svg {
			color: var(--txt-secondary);
			fill: var(--txt-secondary);
		}
	}
}
</style>
