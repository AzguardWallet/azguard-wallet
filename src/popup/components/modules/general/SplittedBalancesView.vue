<script setup>
/** Vendor */
import BN from "@/utils/bn.js"

/** Utils */
import { balanceFormatted, comma } from "@/utils/amount.js"

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
	
	return balanceFormatted(balance, showFullBalance.value.private ? 100 : 20)
})
const pubicBalance = computed(() => {
	if (!tokenBalance.value) return 0

	const decimals = new BN(10).pow(tokenBalance.value?.token?.decimals || 0)
	const balance = new BN(tokenBalance.value.publicBalance || 0).dividedBy(decimals)
	
	return balanceFormatted(balance, showFullBalance.value.public ? 100 : 20)
})
const handleOpenSendPopup = target => {
	cacheStore.preselectedBalanceType = target
	popupStore.open("send")
}
</script>

<template>
	<Flex direction="column" gap="12" :class="$style.wrapper">
		<Text size="13" weight="600" color="secondary">Balances</Text>

		<Flex direction="column" gap="4">
			<Flex
				@click="handleOpenSendPopup('private')"
				wide
				align="center"
				gap="12"
				:class="[$style.item, $style.left, !token?.hasPrivateTransfers && $style.disabled]"
			>
				<Flex wide direction="column" gap="6">
					<Text size="13" weight="600" color="primary">
						{{ privateBalance.value }}
					</Text>
					<Text size="11" weight="500" color="tertiary"> Private Balance </Text>
				</Flex>

				<Flex align="center" justify="center" :class="$style.left_icon">
					<Icon name="key-square" size="16" color="tertiary" />
				</Flex>
			</Flex>

			<Flex
				@click="handleOpenSendPopup('public')"
				wide
				align="center"
				gap="12"
				:class="[$style.item, $style.right, !token?.hasPublicTransfers && $style.disabled]"
			>
				<Flex wide direction="column" gap="6">
					<Text size="13" weight="600" color="primary">
						{{ pubicBalance.value }}
					</Text>
					<Text size="11" weight="500" color="tertiary"> Public Balance </Text>
				</Flex>

				<Flex align="center" justify="center" :class="$style.left_icon">
					<Icon name="face" size="16" color="tertiary" />
				</Flex>
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

.left_icon {
	position: relative;
}
</style>
