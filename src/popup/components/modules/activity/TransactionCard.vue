<script setup>
/** Vendor */
import BN from "bignumber.js"
import { DateTime } from "luxon"

/** Services */
import { OriginType, TxStatus } from "@/wallet/services/transaction/client"
import { ConfigServiceClient } from "@/wallet/services/config/client"

/** Utils */
import { balanceFormatted } from "@/utils/amount.js"
import { getTransactionExplorerUrl } from "@/wallet/constants/explorers"

/** Store */
import { useAppStore } from "@/stores/app.store"
const appStore = useAppStore()

const props = defineProps({
	tx: {
		type: Object,
	},
})

const configService = new ConfigServiceClient()
const config = ref({ blockExplorerEnabled: true })

onMounted(async () => {
	const configProps = await configService.getProps()
	config.value = Object.fromEntries(configProps.map((p) => [p.key, p.value]))
})

onBeforeUnmount(() => {
	configService.disconnect()
})

const call = computed(() => props.tx.calls[0])
const type = computed(() => {
	if (call.value.method.startsWith("transfer")) return "transfer"
	if (call.value.method.startsWith("mint_to_")) return "mint"
	return "tx"
})
const transfer = computed(() => (call.value?.transfers ? call.value.transfers[0] : null))
const token = computed(() => transfer.value?.token)
const transferAmount = computed(() => {
	if (transfer.value) {
		const decimals = new BN(10).pow(token.value?.decimals || 0)
		return balanceFormatted(new BN((transfer.value.amount || 0)).dividedBy(decimals), 8).value
	}

	return 0
})

const mintAmount = computed(() => {
	if (type.value !== "mint") return 0

	const decimals = new BN(10).pow(props.tx?.origin?.type === OriginType.UI ? 8 : 0)
	let amount = new BN(0)
	for (const c of props.tx.calls) {
		amount = amount.plus(new BN(c.args.at(-1) || 0))
	}

	return balanceFormatted(amount.dividedBy(decimals), 8).value
})

const icon = computed(() => {
	if (type.value === "transfer") return "arrow-narrow-up-right"
	if (type.value === "mint") return "faucet"
	return "zap"
})

const statusIcon = computed(() => {
	if (props.tx.status === TxStatus.Pending) return "clock-circle"
	if (props.tx.status === TxStatus.Success) return "check-circle"
	return "close-circle"
})

const statusColor = computed(() => {
	if (props.tx.status === TxStatus.Pending) return "gray"
	if (props.tx.status === TxStatus.Success) return "green"
	return "red"
})

const title = computed(() => {
	if (type.value === "transfer") return "Transfer"
	if (type.value === "mint") return "Mint"
	return "Transaction"
})

const explorerUrl = computed(() => {
	if (!config.value.blockExplorerEnabled) return null
	if (!appStore.network?.chainId) return null

	return getTransactionExplorerUrl(
		appStore.network.chainId,
		appStore.network.selectedExplorerId,
		props.tx.hash
	)
})
</script>

<template>
	<Flex align="center" justify="between" :class="$style.wrapper">
		<Flex align="center" gap="12">
			<Flex align="center" justify="center" :class="$style.activity_icon">
				<Icon :name="icon" size="16" color="primary" />

				<Icon :name="statusIcon" size="14" :color="statusColor" :class="$style.check_icon" />
			</Flex>

			<Flex direction="column" gap="6">
				<Text size="13" weight="600" color="primary">
					{{ title }}
				</Text>
				<Text size="12" weight="500" color="tertiary">
					{{ DateTime.fromSeconds(tx.updatedAt / 1_000).toFormat("LLL dd, HH:mm") }}
				</Text>
			</Flex>
		</Flex>

		<Flex align="center" gap="8">
			<Flex v-if="type === 'transfer' && token" align="center" :class="$style.amount_badge">
				<Text size="12" weight="600" color="primary">
					{{ transferAmount }}
					<Text color="tertiary">&nbsp;{{ token?.symbol }}</Text>
				</Text>
			</Flex>
			<Flex v-if="type === 'mint'" align="center" :class="$style.amount_badge">
				<Text size="12" weight="600" color="primary">
					{{ mintAmount }}
				</Text>
			</Flex>
		</Flex>

		<a
			v-if="explorerUrl"
			:href="explorerUrl"
			target="_blank"
			rel="noopener noreferrer"
			@click.stop
			:class="$style.explorer_link"
		>
			Explorer
		</a>
	</Flex>
</template>

<style module>
.wrapper {
	position: relative;
	cursor: pointer;
	border-radius: 8px;

	padding: 8px;

	transition: all 0.2s var(--bezier);

	&:hover {
		background: var(--gray-3);
	}

	&:active {
		background: var(--gray-5);
	}
}

.activity_icon {
	position: relative;

	width: 32px;
	height: 32px;

	border-radius: 50%;
	background: linear-gradient(var(--gray-8), var(--gray-3));
}

.check_icon {
	position: absolute;
	top: -8px;
	right: -8px;

	box-sizing: content-box;
	border: 3px solid var(--card-bg);
	border-radius: 50%;
}

.amount_badge {
	background: var(--gray-5);
	border-radius: 6px;

	padding: 4px 6px;
}

.explorer_link {
	position: absolute;
	bottom: 8px;
	right: 8px;
	z-index: 10;

	font-size: 11px;
	font-weight: 500;
	color: var(--blue);
	text-decoration: none;

	transition: all 0.2s var(--bezier);

	&:hover {
		text-decoration: underline;
	}
}
</style>
