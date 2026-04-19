<script setup>
/** Vendor */
import BN from "bignumber.js"

/** Utils */
import { balanceFormatted } from "@/utils/amount.js"
import { capitalize } from "@/utils/string"

/** Composables */
import { useToast } from "@/composables/toast.js"
const { openToast } = useToast()

/** Store */
import { useCacheStore } from "@/stores/cache.store"
const cacheStore = useCacheStore()

const router = useRouter()

const props = defineProps({
	tokenBalance: {
		type: Object,
		required: false,
	},
})

const showFullBalance = ref({
	private: false,
	public: false,
})
const privateBalance = computed(() => {
	if (!props.tokenBalance) return 0

	const decimals = new BN(10).pow(props.tokenBalance?.token?.decimals || 0)
	const balance = new BN(props.tokenBalance.privateBalance || 0).dividedBy(decimals)

	return balanceFormatted(balance, showFullBalance.value.private ? undefined : 30)
})
const publicBalance = computed(() => {
	if (!props.tokenBalance) return 0

	const decimals = new BN(10).pow(props.tokenBalance?.token?.decimals || 0)
	const balance = new BN(props.tokenBalance.publicBalance || 0).dividedBy(decimals)

	return balanceFormatted(balance, showFullBalance.value.public ? undefined : 30)
})

const isCopied = ref(false)
const handleCopyBalance = (target) => {
	const balance = target === "private" ? privateBalance.value : publicBalance.value

	isCopied.value = true
	window.navigator.clipboard.writeText(balance.value)
	openToast({ label: `${capitalize(target)} balance is copied`, icon: "copy" })
	setTimeout(() => {
		isCopied.value = false
	}, 2500)
}

const handleShowFullBalances = async () => {
	showFullBalance.value.private = !showFullBalance.value.private
	showFullBalance.value.public = !showFullBalance.value.public
	await nextTick()
}
const handleOpenSendPopup = (target) => {
	cacheStore.preselectedBalanceType = target
	const tokenId = props.tokenBalance?.token?.id
	router.push({ path: "/popup/send", query: tokenId ? { tokenId } : {} })
}
</script>

<template>
	<Flex direction="column" gap="12" :class="$style.wrapper">
		<Flex align="end" justify="between" gap="20">
			<Text size="13" weight="600" color="secondary">Balances</Text>

			<Text
				v-if="privateBalance.slashed || publicBalance.slashed || showFullBalance.public"
				@click="handleShowFullBalances"
				size="12"
				weight="600"
				color="tertiary"
				:class="['clickable', $style.txt_button]"
			>
				Show full
			</Text>
		</Flex>

		<Flex direction="column" gap="4">
			<Flex
				@click="handleOpenSendPopup('private')"
				wide
				align="center"
				gap="12"
				data-testid="send-from-private"
				:class="[$style.item, !tokenBalance?.token?.hasPrivateTransfers && $style.disabled]"
			>
				<Flex wide direction="column" gap="6">
					<Text size="13" weight="600" color="primary" data-testid="private-balance-value" :class="$style.balance_text">
						{{ privateBalance.value }}
					</Text>
					<Text size="11" weight="500" color="tertiary"> Private Balance </Text>
				</Flex>

				<Icon
					@click.stop="handleCopyBalance('private')"
					name="copy"
					size="14"
					color="tertiary"
					:class="$style.right_icon"
				/>
			</Flex>

			<Flex
				@click="handleOpenSendPopup('public')"
				wide
				align="center"
				gap="12"
				data-testid="send-from-public"
				:class="[$style.item, !tokenBalance?.token?.hasPublicTransfers && $style.disabled]"
			>
				<Flex wide direction="column" gap="6">
					<Text size="13" weight="600" color="primary" data-testid="public-balance-value" :class="$style.balance_text">
						{{ publicBalance.value }}
					</Text>
					<Text size="11" weight="500" color="tertiary"> Public Balance </Text>
				</Flex>

				<Icon
					@click.stop="handleCopyBalance('public')"
					name="copy"
					size="14"
					color="tertiary"
					:class="$style.right_icon"
				/>
			</Flex>
		</Flex>
	</Flex>
</template>

<style module>
.wrapper {
	position: relative;
}

.item {
	cursor: pointer;
	background: var(--nulo-surface-high);

	padding: 10px 16px 10px 10px;

	transition: all 0.2s var(--bezier);

	&:hover {
		background: var(--nulo-surface-low);
	}

	&:active {
		background: var(--nulo-surface-high);
	}

	&.disabled {
		opacity: 0.5;
		pointer-events: none;
	}
}

.txt_button {
	transition: all 0.2s var(--bezier);

	&:hover {
		color: var(--txt-secondary);
	}
}

.balance_text {
	white-space: wrap;
	word-break: break-word;
	line-height: 1.4;
}

.right_icon {
	position: relative;

	&:hover {
		fill: var(--txt-primary);
	}
}
</style>
