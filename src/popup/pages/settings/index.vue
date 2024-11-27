<script setup>
/** Components */
import Navigation from "../../components/Navigation.vue"

/** Store */
import { useAppStore } from "@/stores/app.store"
const appStore = useAppStore()

const router = useRouter()

if (!appStore.isLogined) router.push("/popup/auth")
</script>

<template>
	<Flex direction="column" gap="12" :class="$style.wrapper">
		<Text
			size="13"
			weight="600"
			color="secondary"
			style="line-height: 16px"
		>
			Settings
		</Text>

		<Flex direction="column" justify="between" :class="$style.wallet">
			<Flex justify="between">
				<Icon name="vault" size="24" color="blue" />

				<Button type="secondary" size="mini">Edit</Button>
			</Flex>

			<Flex justify="between" align="end">
				<Flex direction="column" gap="6">
					<Text size="13" weight="600" color="primary">
						My Vault
					</Text>
					<Text size="12" weight="600" color="tertiary" selectable>
						0xABCD ... ABCD
					</Text>
				</Flex>
			</Flex>
		</Flex>

		<Flex direction="column" gap="8">
			<Flex align="center" justify="between" :class="$style.item">
				<Flex direction="column" gap="6">
					<Text size="14" weight="600" color="primary">
						General
					</Text>
					<Text size="13" weight="500" color="tertiary">
						Select theme, set up notifications
					</Text>
				</Flex>

				<Icon
					name="chevron"
					size="16"
					color="tertiary"
					:class="$style.item_icon"
				/>
			</Flex>

			<RouterLink to="/popup/settings/dappSessions">
				<Flex align="center" justify="between" :class="$style.item">
					<Flex direction="column" gap="6">
						<Text size="14" weight="600" color="primary">
							Dapp Sessions
						</Text>
						<Text size="13" weight="500" color="tertiary">
							Connect dapps and manage their sessions
						</Text>
					</Flex>

					<Icon
						name="chevron"
						size="16"
						color="tertiary"
						:class="$style.item_icon"
					/>
				</Flex>
			</RouterLink>

			<RouterLink to="/popup/settings/developer">
				<Flex align="center" justify="between" :class="$style.item">
					<Flex direction="column" gap="6">
						<Text size="14" weight="600" color="primary">
							Developer
						</Text>
						<Text size="13" weight="500" color="tertiary">
							Modify networks, endpoints, etc
						</Text>
					</Flex>

					<Icon
						name="chevron"
						size="16"
						color="tertiary"
						:class="$style.item_icon"
					/>
				</Flex>
			</RouterLink>

			<Flex align="center" justify="between" :class="$style.item">
				<Flex direction="column" gap="6">
					<Text size="14" weight="600" color="primary">
						Security
					</Text>
					<Text size="13" weight="500" color="tertiary">
						Password and account managemenet
					</Text>
				</Flex>

				<Icon
					name="chevron"
					size="16"
					color="tertiary"
					:class="$style.item_icon"
				/>
			</Flex>
		</Flex>

		<Navigation />
	</Flex>
</template>

<style module>
.wrapper {
	flex: 1;

	background: #fff;
	box-shadow: 0 0 0 1px var(--gray-5);

	border-top-left-radius: 24px;
	border-top-right-radius: 24px;

	padding: 20px 24px 24px 24px;
}

.wallet {
	min-height: 140px;

	background: linear-gradient(transparent, var(--gray-3));
	border-radius: 12px;
	box-shadow: inset 0 0 0 1px var(--gray-10);

	padding: 16px;
}

.item {
	border-radius: 12px;
	box-shadow: inset 0 0 0 1px var(--gray-10);
	cursor: pointer;

	padding: 12px;

	transition: all 0.2s var(--bezier);

	&:hover {
		background: var(--gray-3);

		& .item_icon {
			transform: rotate(-90deg) translateY(3px);
		}
	}

	&:active {
		background: var(--gray-5);
	}
}

.item_icon {
	transform: rotate(-90deg);

	transition: transform 0.2s var(--bezier);
}
</style>
