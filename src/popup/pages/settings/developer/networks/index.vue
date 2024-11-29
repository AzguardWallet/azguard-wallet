<script setup>
/** Components */
import Navigation from "../../../../components/Navigation.vue"

/** Utils */
import { managers } from "@/utils/core"

/** Store */
import { useAppStore } from "@/stores/app.store"
const appStore = useAppStore()

const router = useRouter()

if (!appStore.isLogined) router.push("/popup/auth")

const handleEdit = () => {}

const handleDelete = async (network) => {
	await managers.network.deleteNetwork(network.id)
	appStore.networks = appStore.networks.filter(n => n.id !== network.id)
}
</script>

<template>
	<Flex direction="column" gap="12" :class="$style.wrapper">
		<Flex align="center" gap="8">
			<RouterLink to="/popup/settings/developer">
				<Text
					size="13"
					weight="600"
					color="tertiary"
					style="line-height: 16px"
				>
					Developer
				</Text>
			</RouterLink>
			<Text color="support">•</Text>
			<Text
				size="13"
				weight="600"
				color="tertiary"
				style="line-height: 16px"
			>
				Networks
			</Text>
		</Flex>

		<Flex direction="column" gap="16">
			<Text size="16" weight="600" color="primary">Networks</Text>

			<Flex direction="column" gap="6">
				<Flex
					v-for="network in appStore.networks"
					@click="appStore.network = network.id"
					align="center"
					justify="between"
					:class="$style.network"
				>
					<Flex align="center" gap="8">
						<Icon
							:name="
								appStore.network == network.id
									? 'check-circle'
									: 'globe'
							"
							size="16"
							:color="
								appStore.network === network.id
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
					link="/popup/settings/developer/networks/new"
					wide
					type="secondary"
					size="medium"
					leftIcon="plus-circle"
					leftIconColor="blue"
				>
					<Text size="13">Add network</Text>
				</Button>
			</Flex>
		</Flex>

		<Navigation />
	</Flex>
</template>

<style module>
.wrapper {
	flex: 1;

	background: var(--card-bg);
	box-shadow: 0 0 0 1px var(--gray-5);

	border-top-left-radius: 24px;
	border-top-right-radius: 24px;

	padding: 20px 24px 24px 24px;
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
