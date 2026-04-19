<script setup>
/** Components */
import TransactionAwaitingCard from "../activity/TransactionAwaitingCard.vue"
import TransactionCard from "../activity/TransactionCard.vue"

/** Vendor */
import BN from "bignumber.js"

/** Services */
import { TaskServiceClient } from "@/wallet/services/task/client"
import { ContentKind, TaskStatus } from "@/wallet/services/task/spec"
import { TokenServiceClient } from "@/wallet/services/token/client"
import { OriginType } from "@/wallet/services/transaction/spec"

/** Utils */
import { balanceFormatted } from "@/utils/amount.js"
import { humanizeMethodName } from "@/utils/tx-enrichment"

/** Store */
import { useAppStore } from "@/stores/app.store"
const appStore = useAppStore()

const props = defineProps({
	token: {
		type: Object,
	},
})

const router = useRouter()

const recentTransactions = computed(() => {
	const source = props.token
		? appStore.transactions.filter((t) => t.calls?.some((c) => c.contract === props.token?.contract))
		: appStore.transactions
	return source.slice(0, 3)
})
const isTokenAwaitingTx = computed(() => {
	return props.token
		? appStore.awaitingTransactions.findIndex((t) => t.account === appStore.account.address && t.contract === props.token.contract) > -1
		: false
})
const awaitingAccountTxs = computed(() => {
	return appStore.awaitingTransactions.filter((t) => t.account === appStore.account?.address)
})

/** Unified in-flight task: covers both dapp-initiated (ExecuteOperation) and
 *  UI-initiated (Transfer) sends. The backend emits task+subtasks with progress
 *  labels; we surface them through a single awaiting card with live subtitle. */
const executingTask = ref(null)
const executingSubtasks = ref([])

/** Tokens lookup — UI Transfer tasks carry a tokenId; we resolve to symbol +
 *  decimals so the awaiting card can mirror TransactionCard (icon + amount). */
const tokens = ref([])
const tokenService = new TokenServiceClient()
async function loadTokens() {
	if (!appStore.profile || !appStore.network) return
	tokens.value = await tokenService.getTokens(appStore.profile.id, appStore.network.chainId)
}

function tokenById(id) {
	return tokens.value.find((t) => t.id === id)
}

const isUiTransfer = computed(() => executingTask.value?.content?.kind === ContentKind.Transfer)

const executingProgressTitle = computed(() => {
	if (!executingTask.value) return ""
	if (isUiTransfer.value) {
		const token = tokenById(executingTask.value.content.tokenId)
		return token?.symbol || "Transfer"
	}
	// Dapp path
	const name = executingTask.value.origin?.name || "Transaction"
	const method = executingTask.value.content?.primaryMethod
	if (method) return `${name} · ${humanizeMethodName(method)}`
	return name
})
const executingProgressSubtitle = computed(() => {
	const active = executingSubtasks.value.find((s) => s.status === TaskStatus.Processing)
	return active ? `${active.content.label}...` : "Preparing..."
})
const executingAmount = computed(() => {
	if (!isUiTransfer.value) return null
	const token = tokenById(executingTask.value.content.tokenId)
	if (!token) return null
	const decimals = new BN(10).pow(token.decimals || 0)
	return balanceFormatted(new BN(String(executingTask.value.content.amount)).dividedBy(decimals), 8).value
})
const executingAmountSymbol = computed(() => {
	if (!isUiTransfer.value) return null
	return tokenById(executingTask.value.content.tokenId)?.symbol || null
})

const taskService = new TaskServiceClient()
taskService.onTaskCreated.add(onExecutingTaskCreated)
taskService.onTaskUpdated.add(onExecutingTaskUpdated)
taskService.onTaskDeleted.add(onExecutingTaskDeleted)

function isExecutingTask(task) {
	if (task.finishedAt) return false
	// Dapp-initiated send operation
	if (
		task.content.kind === ContentKind.ExecuteOperation &&
		task.origin?.type === OriginType.DAPP &&
		(task.content.operationKind === "send_transaction" || task.content.operationKind === "aztec_sendTx")
	) {
		// Token-mode pages skip dapp tasks (TransferContent carries the token id we'd
		// filter on; ExecuteOperation can't be cheaply scoped to a single token here).
		if (props.token) return false
		return true
	}
	// UI-initiated transfer — must match active account AND (in token-mode) the page's token.
	if (task.content.kind === ContentKind.Transfer && task.origin?.type === OriginType.UI) {
		if (task.content.senderAddress !== appStore.account?.address) return false
		if (props.token && task.content.tokenId !== props.token.id) return false
		return true
	}
	return false
}
function onExecutingTaskCreated(task) {
	if (isExecutingTask(task)) {
		executingTask.value = task
		executingSubtasks.value = task.subtasks || []
		return
	}
	if (task.parentId && executingTask.value && task.parentId === executingTask.value.id) {
		executingSubtasks.value.push(task)
	}
}
function onExecutingTaskUpdated(task) {
	if (executingTask.value && task.id === executingTask.value.id) {
		if (task.finishedAt) {
			executingTask.value = null
			executingSubtasks.value = []
		} else {
			executingTask.value = task
		}
		return
	}
	if (task.parentId && executingTask.value && task.parentId === executingTask.value.id) {
		const idx = executingSubtasks.value.findIndex((s) => s.id === task.id)
		if (idx !== -1) {
			executingSubtasks.value[idx] = task
		} else {
			executingSubtasks.value.push(task)
		}
	}
}
function onExecutingTaskDeleted(task) {
	if (executingTask.value && task.id === executingTask.value.id) {
		executingTask.value = null
		executingSubtasks.value = []
	}
}

const handleSelectTx = (tx) => {
	router.push(`/popup/tx/${tx.hash}`)
}

onMounted(async () => {
	await loadTokens()

	// Newest-first replay — otherwise concurrent tasks could surface the older one.
	const allTasks = await taskService.getTasks()
	const matching = allTasks.filter((t) => isExecutingTask(t)).sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0))
	const activeExec = matching[0]
	if (activeExec) {
		executingTask.value = activeExec
		executingSubtasks.value = activeExec.subtasks || []
	}
})
onBeforeUnmount(() => {
	taskService.disconnect()
	tokenService.disconnect()
})
</script>

<template>
	<Flex v-if="token && (executingTask || isTokenAwaitingTx || recentTransactions.length)" direction="column" gap="16">
		<Flex align="end" justify="between" :class="$style.section_header">
			<span :class="$style.header_title">RECENT TRANSACTIONS</span>
			<span @click="router.push('/popup/activity')" :class="$style.archive_link">View Archives</span>
		</Flex>

		<div :class="$style.list">
			<TransactionAwaitingCard
				v-if="executingTask"
				:title="executingProgressTitle"
				:subtitle="executingProgressSubtitle"
				:icon="isUiTransfer ? 'arrow-narrow-up-right' : null"
				:amount="executingAmount"
				:amountSymbol="executingAmountSymbol"
			/>
			<TransactionAwaitingCard v-else-if="isTokenAwaitingTx" />
			<TransactionCard v-for="tx in recentTransactions" :key="tx.hash" :tx="tx" @click="handleSelectTx(tx)" />
		</div>
	</Flex>
	<Flex v-else-if="!token && (executingTask || recentTransactions.length || awaitingAccountTxs.length)" direction="column" gap="16">
		<Flex align="end" justify="between" :class="$style.section_header">
			<span :class="$style.header_title">RECENT TRANSACTIONS</span>
			<span @click="router.push('/popup/activity')" :class="$style.archive_link">View Archives</span>
		</Flex>

		<div :class="$style.list">
			<TransactionAwaitingCard
				v-if="executingTask"
				:title="executingProgressTitle"
				:subtitle="executingProgressSubtitle"
				:icon="isUiTransfer ? 'arrow-narrow-up-right' : null"
				:amount="executingAmount"
				:amountSymbol="executingAmountSymbol"
			/>
			<TransactionAwaitingCard v-else-if="awaitingAccountTxs.length" />
			<TransactionCard v-for="tx in recentTransactions" :key="tx.hash" :tx="tx" @click="handleSelectTx(tx)" />
		</div>
	</Flex>
	<Flex v-else-if="token" direction="column" gap="16">
		<Flex align="end" justify="between" :class="$style.section_header">
			<span :class="$style.header_title">RECENT TRANSACTIONS</span>
		</Flex>

		<div :class="$style.empty_state">
			<span :class="$style.empty_headline">NOTHING HERE YET</span>
			<span :class="$style.empty_sub">Send or receive {{ token.symbol }} to see activity.</span>
		</div>
	</Flex>
</template>

<style module>
.section_header {
	padding-bottom: 8px;
	border-bottom: 1px solid rgba(74, 70, 63, 0.2);
}

.header_title {
	font-family: var(--font-headline);
	font-size: 12px;
	font-weight: 700;
	letter-spacing: 0.1em;
	text-transform: uppercase;
	color: var(--nulo-secondary);
}

.archive_link {
	font-family: var(--font-headline);
	font-size: 10px;
	font-weight: 700;
	letter-spacing: 0.1em;
	text-transform: uppercase;
	color: var(--nulo-outline);
	cursor: pointer;

	transition: color 0.2s var(--bezier);

	&:hover {
		color: var(--nulo-accent);
	}
}

.list {
	display: flex;
	flex-direction: column;
	gap: 4px;
}

.empty_state {
	display: flex;
	flex-direction: column;
	align-items: center;
	gap: 8px;

	padding: 32px 16px;
	border: 1px dashed var(--nulo-border);

	text-align: center;
}

.empty_headline {
	font-family: var(--font-headline);
	font-size: 14px;
	font-weight: 700;
	letter-spacing: 0.1em;
	text-transform: uppercase;
	color: var(--nulo-secondary);
}

.empty_sub {
	font-family: var(--font-mono);
	font-size: 11px;
	line-height: 1.4;
	color: var(--nulo-outline);
}
</style>
