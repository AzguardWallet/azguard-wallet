<script setup>
/** Components */
import SettingItem from "@/components/ui/Settings/SettingItem.vue"

/** Utils */
import { comma, purgeNumber } from "@/utils/amount.js"
import { managers } from "@/utils/core.js"

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

const isHovered = ref(false)

const handleRefreshBalance = () => {
	console.log(managers)
}
</script>

<template>
	<SettingItem
		:to="`/popup/tokens/${token.id}`"
		size="large"
		:title="token.symbol"
		:description="token.name"
		:loading="appStore.tokenAwaitingBalanceIdx === token.id"
		icon="banknote"
		@pointerenter="isHovered = true"
		@pointerleave="isHovered = false"
	>
		<template #icon>
			<Icon
				@click.stop="handleRefreshBalance"
				:name="!isHovered ? 'banknote' : 'refresh'"
				size="16"
				color="white"
				:class="$style.icon"
			/>
		</template>

		<template #right>
			<Flex direction="column" align="end" gap="6">
				<Text size="13" weight="600" color="tertiary" noWrap :class="$style.balance_text">
					<Text color="primary">{{ balance ? comma(totalBalance, ",", 8) : 0 }}</Text>
					<Text :class="$style.symbol_wrapper">&nbsp;{{ token.symbol }}</Text>
				</Text>

				<Tooltip position="end">
					<Flex align="center" gap="4">
						<Text size="12" weight="500" color="tertiary"> $0.00 </Text>
						<Icon name="warning" size="12" color="tertiary" />
					</Flex>

					<template #content> No quotes available at the moment </template>
				</Tooltip>
			</Flex>
		</template>
	</SettingItem>
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

.balance_text {
	display: flex;

	text-align: end;
}

.icon {
	box-sizing: content-box;
	border-radius: 8px;
	background: var(--gray-15);

	padding: 5px;

	transition: all 0.2s var(--bezier);

	&:hover {
		background: var(--gray-20);
	}
}

.symbol_wrapper {
	display: block;

	max-width: 80px;

	overflow: hidden;
	text-overflow: ellipsis;
}
</style>
