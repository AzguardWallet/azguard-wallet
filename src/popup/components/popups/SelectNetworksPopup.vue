<script setup>
/** Components */
import NetworkBadge from "@/popup/components/modules/general/NetworkBadge.vue"
import Popup from "@/components/ui/Popup/Popup.vue"
import PopupCard from "@/components/ui/Popup/PopupCard.vue"

/** Store */
import { useCacheStore } from "@/stores/cache.store"
import { usePopupStore } from "@/stores/popup.store"
const cacheStore = useCacheStore()
const popupStore = usePopupStore()

const emit = defineEmits(["onClose"])

const props = defineProps({
	show: Boolean,
})

const displaceIdx = computed(() => {
	return popupStore.len - popupStore.popups.select_network?.order
})

const networks = ref([])

const handleSelectNetwork = (network) => {
	cacheStore.selectedNetwork = network
	emit("onClose")
}

watch(
	() => props.show,
	() => {
		if (props.show) {
			networks.value = cacheStore.proposedNetworks
		}
	}
)
</script>

<template>
	<Popup :show @onClose="emit('onClose')" :displaceIdx=popupStore.popups.select_network?.order>
		<PopupCard :displaceIdx>
			<Flex
				wide
				direction="column"
				justify="between"
				gap="16"
				:class="$style.wrapper"
			>
				<Flex direction="column" gap="16">
					<Flex align="center" justify="start">
						<Text size="14" weight="600" color="primary">
							Select node
						</Text>
					</Flex>
					<Flex direction="column" gap="6">
						<Flex
							v-for="network in networks"
							@click="handleSelectNetwork(network)"
							align="center"
							justify="between"
							:class="$style.network"
						>
							<Flex align="center" gap="10">
								<Icon
									:name="
										cacheStore.selectedNetwork.id === network.id
											? 'check-circle'
											: 'globe'
									"
									size="16"
									:color="
										cacheStore.selectedNetwork.id === network.id
											? 'green'
											: 'tertiary'
									"
								/>

								<Flex direction="column" gap="4">
									<Flex align="center" gap="10">
										<Text size="14" weight="600" color="primary">
											{{ network.name }}
										</Text>

										<NetworkBadge :network="network" />
									</Flex>

									<Text size="13" weight="600" color="tertiary">
										{{ network.rpcUrl }}
									</Text>
								</Flex>
							</Flex>
						</Flex>
					</Flex>
				</Flex>

				<!-- <Flex direction="column" gap="12">
					<Button
						@click="popupStore.open('new_network')"
						wide
						type="secondary"
						size="medium"
						leftIcon="plus-circle"
						leftIconColor="primary"
					>
						Add network
					</Button>

					<Text
						size="12"
						weight="500"
						color="tertiary"
						height="140"
						align="center"
					>
						To add a new network, come up with a unique name and
						provide an RPC link
					</Text>
				</Flex> -->
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
		box-shadow: inset 0 0 0 1px var(--border-hovered),
			0 1px 2px var(--shadow-5);

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
</style>
