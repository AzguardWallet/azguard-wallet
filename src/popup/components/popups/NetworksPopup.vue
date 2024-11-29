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
			<Flex
				wide
				direction="column"
				justify="between"
				gap="16"
				:class="$style.wrapper"
			>
				<Flex direction="column" gap="16">
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
					</Flex>
				</Flex>

				<Flex direction="column" gap="16">
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

					<Text
						size="12"
						weight="500"
						color="tertiary"
						height="140"
						align="center"
					>
						Default networks
						<Text color="secondary">Mainnet</Text> &
						<Text color="secondary">Testnet</Text> cannot be edited
						or deleted, you can only edit custom networks.
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
