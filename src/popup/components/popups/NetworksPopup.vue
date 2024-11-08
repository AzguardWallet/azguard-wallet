<script setup>
/** Components */
import Popup from "@/components/ui/Popup/Popup.vue"
import PopupCard from "@/components/ui/Popup/PopupCard.vue"

/** Store */
import { useAppStore } from "@/stores/app.store"
const appStore = useAppStore()

const emit = defineEmits(["onClose"])

const router = useRouter()

const handleEdit = () => {}

const handleDelete = (target) => {
	appStore.removeNetwork(target)
}

const handleAddNetwork = () => {
	emit("onClose")
	router.push("/popup/settings/developer/networks/new")
}
</script>

<template>
	<Popup @onClose="emit('onClose')">
		<PopupCard>
			<Flex wide direction="column" gap="16" :class="$style.wrapper">
				<Text size="14" weight="600" color="primary">
					Select network
				</Text>

				<Flex direction="column" gap="6">
					<Flex
						v-for="network in appStore.networks"
						@click="appStore.network = network"
						align="center"
						justify="between"
						:class="$style.network"
					>
						<Flex align="center" gap="8">
							<Icon
								:name="
									appStore.network.id === network.id
										? 'check-circle'
										: 'globe'
								"
								size="16"
								:color="
									appStore.network.id === network.id
										? 'green'
										: 'tertiary'
								"
							/>
							<Text size="14" weight="600" color="primary">
								{{ network.name }}
							</Text>
						</Flex>

						<Flex
							v-if="network.type === 'custom'"
							align="center"
							gap="8"
							:class="$style.icons"
						>
							<Icon
								@click="handleEdit(network)"
								name="edit"
								size="14"
								color="tertiary"
							/>
							<Icon
								@click.stop="handleDelete(network)"
								name="close-circle"
								size="16"
								color="tertiary"
							/>
						</Flex>
					</Flex>

					<Button
						@click="handleAddNetwork"
						wide
						type="secondary"
						size="medium"
						leftIcon="plus-circle"
						leftIconColor="blue"
					>
						Add network
					</Button>
				</Flex>

				<Text size="12" weight="500" color="tertiary" height="140">
					Default networks <Text color="secondary">Mainnet</Text> &
					<Text color="secondary">Testnet</Text> cannot be edited or
					deleted, you can only edit custom networks.
				</Text>
			</Flex>
		</PopupCard>
	</Popup>
</template>

<style module>
.wrapper {
	padding: 0 20px 24px 20px;
}

.network {
	border-radius: 12px;
	cursor: pointer;
	box-shadow: inset 0 0 0 1px var(--gray-10), 0 1px 2px var(--gray-5);

	padding: 12px;

	transition: all 0.2s var(--bezier);

	&:hover {
		background: var(--gray-3);

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
