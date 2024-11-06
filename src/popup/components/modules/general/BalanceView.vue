<script setup>
/** Store */
import { useAppStore } from "@/stores/app.store"
const appStore = useAppStore()

const isBalanceHovered = ref(false)
</script>

<template>
	<Flex
		@mouseenter="isBalanceHovered = true"
		@mouseleave="isBalanceHovered = false"
		direction="column"
		gap="12"
		:class="$style.wrapper"
	>
		<Transition name="opacity" mode="out-in">
			<Flex v-if="!isBalanceHovered" align="center" gap="4">
				<Text size="13" weight="600" color="secondary">
					Total Balance
				</Text>
				<Icon name="" size="16" color="orange" />
			</Flex>
			<Flex v-else align="center" gap="4">
				<Icon name="vault" size="16" color="blue" />
				<Text
					size="13"
					weight="600"
					color="secondary"
					:class="$style.wallet_name"
				>
					{{ appStore._wallet.name }}
				</Text>
			</Flex>
		</Transition>

		<div
			@click="
				appStore.isPrivacyModeEnabled = !appStore.isPrivacyModeEnabled
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
				$7,705<Text color="secondary" height="100">.52</Text>
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
			<Text size="12" weight="600" color="green">$5.71</Text>
			<Text size="12" weight="600" color="green">/</Text>
			<Text size="12" weight="600" color="green">+2.61%</Text>
		</Flex>
	</Flex>
</template>

<style module>
.wrapper {
	margin: 0 24px;
	padding-bottom: 24px;
}

.balance {
	cursor: pointer;
}

.diff_badge {
	width: fit-content;
	height: 20px;

	border-radius: 50px;
	background: rgba(20, 174, 92, 15%);

	padding: 0 8px;
}

.wallet_name {
	max-width: 100px;

	white-space: nowrap;
	overflow: hidden;
	text-overflow: ellipsis;
}
</style>
