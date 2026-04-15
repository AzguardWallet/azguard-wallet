<script setup>
/** Vendor */
import BN from "bignumber.js"
import { DateTime } from "luxon"

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
const decimals = computed(() => new BN(10).pow(token.value?.decimals || 0))
const publicBal = computed(() => new BN(props.tokenBalance?.publicBalance || 0).dividedBy(decimals.value))
const privateBal = computed(() => new BN(props.tokenBalance?.privateBalance || 0).dividedBy(decimals.value))
const totalBalance = computed(() => balanceFormatted(privateBal.value.plus(publicBal.value), 10).value)
const privateFormatted = computed(() => balanceFormatted(privateBal.value, 6).value)
const publicFormatted = computed(() => balanceFormatted(publicBal.value, 6).value)
const hasPrivate = computed(() => !privateBal.value.isZero())
const hasPublic = computed(() => !publicBal.value.isZero())
const description = computed(() => {
	if (props.tokenBalance?.isMinting) return "Minting more tokens..."
	if (props.tokenBalance?.isUpdating) return "Refreshing balance..."
	if (props.newToken) return "Minting in progress..."

	return token.value?.name || "unknown"
})

const isHovered = ref(false)

const handleRefreshBalance = async () => {
	if (!props.tokenBalance) return

	emit("onRefreshBalance")
}
</script>

<template>
	<RouterLink
		v-if="tokenBalance"
		:to="`/popup/tokens/${token?.id}`"
		data-testid="tokens-card"
		:class="$style.row"
		@pointerenter="isHovered = true"
		@pointerleave="isHovered = false"
	>
		<Flex direction="column" gap="2">
			<span :class="$style.symbol">{{ token.symbol }}</span>
			<span :class="$style.type_label">PRIVATE / PUBLIC</span>
		</Flex>

		<Flex direction="column" align="end" gap="2">
			<span :class="$style.amount">{{ totalBalance || 0 }}</span>
			<span :class="$style.detail">
				<template v-if="hasPrivate">{{ privateFormatted }} PRIVATE</template>
				<template v-if="hasPrivate && hasPublic"> / </template>
				<template v-if="hasPublic">{{ publicFormatted }} PUBLIC</template>
				<template v-if="!hasPrivate && !hasPublic">0 PRIVATE / 0 PUBLIC</template>
			</span>
		</Flex>
	</RouterLink>

	<Flex v-if="newToken" align="center" justify="between" :class="[$style.row, $style.minting]">
		<Flex direction="column" gap="2">
			<span :class="$style.symbol">{{ newToken.symbol }}</span>
			<span :class="$style.type_label">MINTING...</span>
		</Flex>
		<Spinner size="14" color="--txt-tertiary" />
	</Flex>
</template>

<style module>
.row {
	display: flex;
	align-items: center;
	justify-content: space-between;

	padding: 16px 0;
	cursor: pointer;
	text-decoration: none;

	transition: background 0.2s var(--bezier);

	&:hover {
		background: rgba(29, 27, 26, 0.5);
	}
}

.minting {
	opacity: 0.5;
	pointer-events: none;
}

.symbol {
	font-family: var(--font-headline);
	font-weight: 700;
	font-size: 14px;
	letter-spacing: -0.02em;
	color: var(--txt-primary);
}

.type_label {
	font-family: var(--font-mono);
	font-size: 10px;
	text-transform: uppercase;
	color: var(--nulo-secondary);
}

.amount {
	font-family: var(--font-mono);
	font-size: 14px;
	font-weight: 500;
	color: var(--txt-primary);
}

.detail {
	font-family: var(--font-mono);
	font-size: 10px;
	color: var(--nulo-outline);
}
</style>
