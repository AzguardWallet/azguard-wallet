<script setup>
/** Components */
import ActionButtonsView from "./ActionButtonsView.vue"

/** Store */
import { useAppStore } from "@/stores/app.store"
const appStore = useAppStore()
</script>

<template>
	<Flex direction="column" align="center" gap="32" :class="$style.wrapper">
		<Flex direction="column" align="center" gap="12">
			<Flex align="center" gap="6">
				<Text size="13" weight="600" color="secondary">
					Account Balance
				</Text>
				<Icon name="key-square" size="16" color="tertiary" />
			</Flex>

			<div
				@click="
					appStore.isPrivacyModeEnabled =
						!appStore.isPrivacyModeEnabled
				"
				:class="$style.balance"
			>
				<Text
					v-if="!appStore.isPrivacyModeEnabled"
					size="28"
					weight="500"
					height="100"
					color="primary"
				>
					$0<Text color="secondary" height="100">.00</Text>
				</Text>
				<Flex v-else align="center" gap="4" style="height: 28px">
					<Icon
						v-for="_ in 6"
						name="asterisk"
						size="12"
						color="primary"
					/>
				</Flex>
			</div>

			<Flex
				align="center"
				justify="center"
				gap="6"
				:class="$style.diff_badge"
			>
				<Text size="13" weight="600" color="tertiary">$0.00</Text>
				<Text size="13" weight="600" color="tertiary">/</Text>
				<Text size="13" weight="600" color="tertiary">0.00%</Text>
			</Flex>
		</Flex>

		<ActionButtonsView />
	</Flex>
</template>

<style module>
.wrapper {
	margin: 0 24px;

	padding: 28px 0 16px 0;
}

.balance {
	cursor: pointer;
}

.diff_badge {
	width: fit-content;
	height: 20px;

	border-radius: 50px;
	/* background: rgba(20, 174, 92, 15%); */
	background: var(--gray-5);

	padding: 0 8px;
}

.wallet_name {
	max-width: 100px;

	white-space: nowrap;
	overflow: hidden;
	text-overflow: ellipsis;
}
</style>
