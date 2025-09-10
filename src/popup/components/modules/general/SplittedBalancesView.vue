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
import { useAppStore } from "@/stores/app.store"
import { usePopupStore } from "@/stores/popup.store"
import { useCacheStore } from "@/stores/cache.store"
const appStore = useAppStore()
const popupStore = usePopupStore()
const cacheStore = useCacheStore()

const props = defineProps({
	token: {
		type: Object,
		required: false,
	},
})

const tokenBalance = computed(() => {
	return appStore.balances.find(b => b.token.id == props.token?.id)
})

const showFullBalance = ref({
	private: false,
	public: false,
})
const privateBalance = computed(() => {
	if (!tokenBalance.value) return 0

	const decimals = new BN(10).pow(tokenBalance.value?.token?.decimals || 0)
	const balance = new BN(tokenBalance.value.privateBalance || 0).dividedBy(decimals)
	
	return balanceFormatted(balance, showFullBalance.value.private ? undefined : 30)
})
const publicBalance = computed(() => {
	if (!tokenBalance.value) return 0

	const decimals = new BN(10).pow(tokenBalance.value?.token?.decimals || 0)
	const balance = new BN(tokenBalance.value.publicBalance || 0).dividedBy(decimals)

	return balanceFormatted(balance, showFullBalance.value.public ? undefined : 30)
})

const isCopied = ref(false)
const handleCopyBalance = (target) => {
	const balance = target === 'private' ? privateBalance.value : publicBalance.value
	
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
const handleOpenSendPopup = target => {
	cacheStore.preselectedBalanceType = target
	popupStore.open("send")
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
				:class="[$style.item, $style.left, !token?.hasPrivateTransfers && $style.disabled]"
			>
				<Flex wide direction="column" gap="6">
					<Text size="13" weight="600" color="primary" :class="$style.balance_text">
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
				:class="[$style.item, $style.right, !token?.hasPublicTransfers && $style.disabled]"
			>
				<Flex wide direction="column" gap="6">
					<Text size="13" weight="600" color="primary" :class="$style.balance_text">
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
	background: var(--gray-5);

	padding: 10px 16px 10px 10px;

	transition: all 0.2s var(--bezier);

	&:hover {
		background: var(--gray-3);
	}

	&:active {
		background: var(--gray-5);
	}

	&.left {
		border-radius: 8px 8px 4px 4px;
	}

	&.right {
		border-radius: 4px 4px 8px 8px;
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
