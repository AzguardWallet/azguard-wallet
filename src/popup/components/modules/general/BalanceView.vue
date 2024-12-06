<script setup>
/** Components */
import ActionButtonsView from "./ActionButtonsView.vue"

/** Utils */
import { comma } from "@/utils/amount.js"

/** Composables */
import { useToast } from "@/composables/toast.js"
const { openToast } = useToast()

/** Store */
import { useAppStore } from "@/stores/app.store"
const appStore = useAppStore()

const props = defineProps({
	token: {
		type: Object,
		required: false,
	},
})

const balanceEl = useTemplateRef("balanceEl")
const dynamicFontSize = ref(2)

const tokenBalance = computed(() => appStore.balances.find(b => b.token.id === props.token?.id))
const totalTokenBalance = computed(() => {
	if (!tokenBalance.value) return 0

	return (
		(Number.parseFloat(tokenBalance.value.privateBalance) + Number.parseFloat(tokenBalance.value.publicBalance)) /
		10 ** tokenBalance.value.token.decimals
	)
})

const calcDynamicFontSize = () => {
	const aWidth = balanceEl.value.wrapper.getBoundingClientRect().width
	dynamicFontSize.value = Math.min(2, (300 / aWidth) * 2)
}

watch(
	() => totalTokenBalance.value,
	async () => {
		await nextTick()
		calcDynamicFontSize()
	},
)

onMounted(async () => {
	if (!totalTokenBalance.value) return

	calcDynamicFontSize()
})

const isCopied = ref(false)
const handleCopyAddress = () => {
	isCopied.value = true
	window.navigator.clipboard.writeText(appStore.account.address)
	openToast({ label: "Address is copied", icon: "copy" })
	setTimeout(() => {
		isCopied.value = false
	}, 2500)
}
</script>

<template>
	<Flex direction="column" align="center" gap="32" :class="$style.wrapper">
		<Flex direction="column" align="center" gap="20">
			<Flex @click="handleCopyAddress" align="center" gap="6" :class="[$style.badge]">
				<Text size="13" weight="600" color="secondary">
					{{ appStore.account.address.slice(0, 6) }}
					•••
					{{ appStore.account.address.slice(-4) }}
				</Text>
				<Icon :name="isCopied ? 'check-circle' : 'copy'" size="12" :color="isCopied ? 'green' : 'tertiary'" />
			</Flex>

			<Flex direction="column" gap="12" align="center">
				<Text size="13" weight="500" color="body">
					{{ token ? `${token.symbol} Token` : "Account" }} Value
				</Text>

				<Flex
					@click="appStore.isPrivacyModeEnabled = !appStore.isPrivacyModeEnabled"
					justify="center"
					:class="$style.balance"
				>
					<Tooltip :disabled="!!token">
						<Flex align="center" gap="8" ref="balanceEl">
							<Icon
								v-if="!token"
								name="warning"
								size="16"
								color="tertiary"
								:class="$style.warning_icon"
							/>
							<Text v-if="!token" size="32" weight="500" height="100" color="tertiary"> $0.00 </Text>
							<Text
								v-else
								weight="500"
								height="100"
								color="primary"
								tabular
								:style="{ fontSize: `${dynamicFontSize}rem` }"
								:class="$style.amount_wrapper"
							>
								{{ comma(totalTokenBalance, ",", 8) }}
								<Text color="tertiary">{{ token.symbol }}</Text>
							</Text>
						</Flex>

						<template #content>
							Price quotes to calculate the total value of your wallet are planned in the next updates
						</template>
					</Tooltip>
				</Flex>
			</Flex>
		</Flex>

		<ActionButtonsView :token />
	</Flex>
</template>

<style module>
.wrapper {
	position: relative;

	margin: 0 24px;
	padding: 20px 0 16px 0;
}

.balance {
	cursor: pointer;
}

.amount_wrapper {
	white-space: nowrap;
}

.wallet_name {
	max-width: 100px;

	white-space: nowrap;
	overflow: hidden;
	text-overflow: ellipsis;
}

.badge {
	border-radius: 8px;
	background: var(--gray-5);
	cursor: pointer;

	padding: 4px 8px;

	transition: all 0.2s ease;

	&:hover {
		background: var(--gray-10);
	}
}

.warning_icon {
	position: absolute;
	right: -26px;
}
</style>
