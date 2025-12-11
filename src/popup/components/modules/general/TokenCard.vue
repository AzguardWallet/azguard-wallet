<script setup>
/** Vendor */
import BN from "bignumber.js"
import { DateTime } from "luxon"

/** Components */
import SettingItem from "@/components/ui/Settings/SettingItem.vue"

/** Utils */
import { balanceFormatted } from "@/utils/amount.js"

/** Store */
import { useAppStore } from "@/stores/app.store"
const appStore = useAppStore()

const emit = defineEmits(["onRefreshBalance"])
const props = defineProps({
	tokenBalance: {
		type: Object,
		required: false,
	},
	newToken: {
		type: Object,
		required: false,
	},
})

const token = computed(() => props.tokenBalance.token)
const totalBalance = computed(() => {
	const decimals = new BN(10).pow(token.value?.decimals || 0)
	const publicBalance = new BN(props.tokenBalance?.publicBalance || 0).dividedBy(decimals)
	const privateBalance = new BN(props.tokenBalance?.privateBalance || 0).dividedBy(decimals)

	const total = privateBalance.plus(publicBalance)

	return balanceFormatted(total, 10).value
})
const description = computed(() => {
	if (props.tokenBalance?.isMinting) return "Minting more tokens..."
	if (props.tokenBalance?.isUpdating) return "Refreshing balance..."
	if (props.newToken) return "Minting in progress..."

	return token.value?.name || 'unknown'
})

const isHovered = ref(false)

const handleRefreshBalance = async () => {
	if (!props.tokenBalance) return

	emit("onRefreshBalance")
}
</script>

<template>
	<SettingItem
		v-if="tokenBalance"
		:to="`/popup/tokens/${token?.id}`"
		size="large"
		:title="token.symbol"
		:description="description"
		icon="banknote"
		@pointerenter="isHovered = true"
		@pointerleave="isHovered = false"
	>
		<template #icon>
			<Tooltip position="start" :disabled="!tokenBalance?.updatedAt">
				<Icon
					v-if="!(tokenBalance?.isUpdating || tokenBalance?.isMinting)"
					@click.stop="handleRefreshBalance"
					:name="!isHovered ? 'banknote' : 'refresh'"
					size="16"
					color="white"
					:class="$style.icon"
				/>
				<div v-else :class="$style.icon">
					<Spinner size="16" color="--txt-primary" />
				</div>

				<template #content>
					<Text color="secondary">Latest balance refresh - </Text>
					<Text>
						{{ DateTime.fromSeconds(tokenBalance?.updatedAt / 1_000).toRelative({ locale: "en" }) }}
					</Text>
				</template>
			</Tooltip>
		</template>

		<template #right>
			<Flex direction="column" align="end" gap="6">
				<Text size="13" weight="600" color="tertiary" noWrap :class="$style.balance_text">
					<Text color="primary">{{ totalBalance || 0 }}</Text>
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

	<SettingItem
		v-if="newToken"
		size="large"
		:title="newToken.symbol"
		:description="description"
		disabled
		icon="banknote"
		@pointerenter="isHovered = true"
		@pointerleave="isHovered = false"
	>
		<template #icon>
			<div :class="$style.icon">
				<Spinner size="16" color="--txt-primary" />
			</div>
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
