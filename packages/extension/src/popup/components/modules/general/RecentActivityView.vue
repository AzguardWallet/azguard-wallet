<script setup>
/** Components */
import TransactionAwaitingCard from "../activity/TransactionAwaitingCard.vue"
import TransactionCard from "../activity/TransactionCard.vue"

/** Services */
import { TaskServiceClient } from "@/wallet/services/task/client"
import { ContentKind, TaskStatus } from "@/wallet/services/task/spec"
import { OriginType } from "@/wallet/services/transaction/spec"

/** Utils */
import { humanizeMethodName } from "@/utils/tx-enrichment"

/** Store */
import { useAppStore } from "@/stores/app.store"
import { useCacheStore } from "@/stores/cache.store"
import { usePopupStore } from "@/stores/popup.store"
const appStore = useAppStore()
const cacheStore = useCacheStore()
const popupStore = usePopupStore()

const props = defineProps({
	token: {
		type: Object,
	},
})

const router = useRouter()

const latestTransaction = computed(() => {
	return props.token
		? appStore.transactions.filter((t) => t.calls?.some((c) => c.contract === props.token?.contract))[0]
		: appStore.transactions[0]
})
const isTokenAwaitingTx = computed(() => {
	return props.token
		? appStore.awaitingTransactions.findIndex((t) => t.account === appStore.account.address && t.contract === props.token.contract) > -1
		: false
})
const awaitingAccountTxs = computed(() => {
	return appStore.awaitingTransactions.filter((t) => t.account === appStore.account?.address)
})

const dappExecutionTask = ref(null)
const dappSubtasks = ref([])
const dappProgressTitle = computed(() => {
	const name = dappExecutionTask.value?.origin?.name || "Transaction"
	const method = dappExecutionTask.value?.content?.primaryMethod
	if (method) return `${name} · ${humanizeMethodName(method)}`
	return name
})
const dappProgressSubtitle = computed(() => {
	const active = dappSubtasks.value.find((s) => s.status === TaskStatus.Processing)
	return active ? `${active.content.label}...` : "Preparing..."
})

const taskService = new TaskServiceClient()
taskService.onTaskCreated.add(onDappTaskCreated)
taskService.onTaskUpdated.add(onDappTaskUpdated)
taskService.onTaskDeleted.add(onDappTaskDeleted)
function isDappExecTask(task) {
	return (
		task.content.kind === ContentKind.ExecuteOperation &&
		task.origin?.type === OriginType.DAPP &&
		!task.finishedAt &&
		(task.content.operationKind === "send_transaction" || task.content.operationKind === "aztec_sendTx")
	)
}
function onDappTaskCreated(task) {
	if (isDappExecTask(task)) {
		dappExecutionTask.value = task
		dappSubtasks.value = task.subtasks || []
		return
	}
	if (task.parentId && dappExecutionTask.value && task.parentId === dappExecutionTask.value.id) {
		dappSubtasks.value.push(task)
	}
}
function onDappTaskUpdated(task) {
	if (dappExecutionTask.value && task.id === dappExecutionTask.value.id) {
		if (task.finishedAt) {
			dappExecutionTask.value = null
			dappSubtasks.value = []
		} else {
			dappExecutionTask.value = task
		}
		return
	}
	if (task.parentId && dappExecutionTask.value && task.parentId === dappExecutionTask.value.id) {
		const idx = dappSubtasks.value.findIndex((s) => s.id === task.id)
		if (idx !== -1) {
			dappSubtasks.value[idx] = task
		} else {
			dappSubtasks.value.push(task)
		}
	}
}
function onDappTaskDeleted(task) {
	if (dappExecutionTask.value && task.id === dappExecutionTask.value.id) {
		dappExecutionTask.value = null
		dappSubtasks.value = []
	}
}

const handleSelectTx = () => {
	cacheStore.activeTxHash = latestTransaction.value.hash
	popupStore.open("tx")
}

onMounted(async () => {
	const allTasks = await taskService.getTasks()
	const activeExec = allTasks.find((t) => isDappExecTask(t))
	if (activeExec) {
		dappExecutionTask.value = activeExec
		dappSubtasks.value = activeExec.subtasks || []
	}
})
onBeforeUnmount(() => {
	taskService.disconnect()
})
</script>

<template>
	<Flex v-if="token && (isTokenAwaitingTx || latestTransaction)" direction="column" gap="16">
		<Flex align="end" justify="between" :class="$style.section_header">
			<span :class="$style.header_title">RECENT TRANSACTIONS</span>
			<span @click="router.push('/popup/activity')" :class="$style.archive_link">View Archives</span>
		</Flex>

		<div :class="$style.list">
			<TransactionAwaitingCard v-if="isTokenAwaitingTx" />
			<TransactionCard v-else :tx="latestTransaction" @click="handleSelectTx" />
		</div>
	</Flex>
	<Flex v-else-if="!token && (latestTransaction || awaitingAccountTxs.length || dappExecutionTask)" direction="column" gap="16">
		<Flex align="end" justify="between" :class="$style.section_header">
			<span :class="$style.header_title">RECENT TRANSACTIONS</span>
			<span @click="router.push('/popup/activity')" :class="$style.archive_link">View Archives</span>
		</Flex>

		<div :class="$style.list">
			<TransactionAwaitingCard v-if="dappExecutionTask" :title="dappProgressTitle" :subtitle="dappProgressSubtitle" />
			<TransactionAwaitingCard v-else-if="awaitingAccountTxs.length" />
			<TransactionCard v-else :tx="latestTransaction" @click="handleSelectTx" />
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
