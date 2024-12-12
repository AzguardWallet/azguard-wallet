<script setup>
/** Utils */
import { comma, purgeNumber } from "@/utils/amount.js"

/** Store */
import { useAppStore } from "@/stores/app.store"
const appStore = useAppStore()

const props = defineProps({
	token: Object,
})

const balance = computed(() => appStore.balances.filter(Boolean).find(b => b.token.id === props.token.id))
const totalBalance = computed(() => {
	if (!balance.value) return 0

	return (
		(Number.parseFloat(balance.value.privateBalance) + Number.parseFloat(balance.value.publicBalance)) /
		10 ** balance.value.token.decimals
	)
})
</script>

<template>
	<RouterLink :to="`/popup/tokens/${token.id}`">
		<Flex align="center" justify="between" :class="$style.wrapper">
			<Flex align="center" gap="12" :class="$style.left">
				<Flex align="center" justify="center" :class="$style.token_icon">
					<Spinner v-if="appStore.tokenAwaitingBalanceIdx === token.id" size="16" color="--txt-primary" />
					<Icon v-else name="banknote" size="20" color="primary" />
				</Flex>

				<Flex direction="column" gap="6" :class="$style.text">
					<Text size="13" weight="600" color="primary" :class="$style.label">
						{{ token.symbol }}
					</Text>
					<Text size="12" weight="500" color="tertiary" :class="$style.label">
						{{ token.name }}
					</Text>
				</Flex>
			</Flex>

			<Flex direction="column" align="end" gap="6">
				<Text size="13" weight="600" color="primary" noWrap>
					{{ balance ? comma(totalBalance, ",", 8) : 0 }}
					<Text color="tertiary">{{ token.symbol }}</Text>
				</Text>

				<Tooltip position="end">
					<Flex align="center" gap="4">
						<Text size="12" weight="500" color="tertiary"> $0.00 </Text>
						<Icon name="warning" size="12" color="tertiary" />
					</Flex>

					<template #content> No quotes available at the moment </template>
				</Tooltip>
			</Flex>
		</Flex>
	</RouterLink>
</template>

<style module>
.wrapper {
	border: 1px solid var(--border);
	box-shadow: 0 1px 2px transparent;
	border-radius: 12px;
	cursor: pointer;

	padding: 12px;

	transition: all 0.2s var(--bezier);

	&:hover {
		border-color: var(--border-hovered);
		box-shadow: 0 1px 2px var(--shadow-5);
		background: var(--gray-3);
	}
}

.left {
	overflow: hidden;
}

.text {
	overflow: hidden;
}

.label {
	overflow: hidden;
	text-overflow: ellipsis;
}

.token_icon {
	min-width: 32px;
	min-height: 32px;

	border-radius: 8px;
	background: var(--gray-5);
	box-sizing: border-box;
}
</style>
