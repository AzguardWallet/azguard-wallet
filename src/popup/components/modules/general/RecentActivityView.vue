<script setup>
/** Components */
import TransactionCard from "../activity/TransactionCard.vue"
import TransactionAwaitingCard from "../activity/TransactionAwaitingCard.vue"

/** Services */
import { TaskServiceClient } from "@/wallet/services/task/client"
import { ContentKind, TaskStatus } from "@/wallet/services/task/spec"
import { OriginType } from "@/wallet/services/transaction/spec"

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
		? appStore.transactions.filter(t => t.calls[0]?.contract === props.token?.contract || t.calls.at(1)?.contract === props.token?.contract)[0]
		: appStore.transactions[0]
})
const isTokenAwaitingTx = computed(() => {
	return props.token
		? appStore.awaitingTransactions.findIndex(t => t.account === appStore.account.address && t.contract === props.token.contract) > -1
		: false
})
const awaitingAccountTxs = computed(() => {
	return appStore.awaitingTransactions.filter(t => t.account === appStore.account?.address)
})

const dappExecutionTask = ref(null)
const dappSubtasks = ref([])
const dappProgressTitle = computed(() => {
	return dappExecutionTask.value?.origin?.name || "Transaction"
})
const dappProgressSubtitle = computed(() => {
	const active = dappSubtasks.value.find(s => s.status === TaskStatus.Processing)
	return active ? `${active.content.label}...` : "Preparing..."
})

const taskService = new TaskServiceClient()
taskService.onTaskCreated.add(onDappTaskCreated)
taskService.onTaskUpdated.add(onDappTaskUpdated)
taskService.onTaskDeleted.add(onDappTaskDeleted)
function isDappExecTask(task) {
	return task.content.kind === ContentKind.ExecuteOperation
		&& task.origin?.type === OriginType.DAPP
		&& !task.finishedAt
		&& (task.content.operationKind === "send_transaction" || task.content.operationKind === "aztec_sendTx")
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
		const idx = dappSubtasks.value.findIndex(s => s.id === task.id)
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
	const activeExec = allTasks.find(t => isDappExecTask(t))
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
		<Flex align="center" justify="between">
			<Text size="13" weight="600" color="secondary"> Latest transaction </Text>
			<Text
				@click="router.push('/popup/activity')"
				size="12"
				weight="600"
				color="tertiary"
				:class="['clickable', $style.txt_button]"
			>
				View all
			</Text>
		</Flex>

		<div :class="$style.list">
			<TransactionAwaitingCard v-if="isTokenAwaitingTx" />
			<TransactionCard v-else :tx="latestTransaction" @click="handleSelectTx" />
		</div>
	</Flex>
	<Flex v-else-if="!token && (latestTransaction || awaitingAccountTxs.length || dappExecutionTask)" direction="column" gap="16">
		<Flex align="center" justify="between">
			<Text size="13" weight="600" color="secondary"> Latest transaction </Text>
			<Text
				@click="router.push('/popup/activity')"
				size="12"
				weight="600"
				color="tertiary"
				:class="['clickable', $style.txt_button]"
			>
				View all
			</Text>
		</Flex>

		<div :class="$style.list">
			<TransactionAwaitingCard v-if="dappExecutionTask" :title="dappProgressTitle" :subtitle="dappProgressSubtitle" />
			<TransactionAwaitingCard v-else-if="awaitingAccountTxs.length" />
			<TransactionCard v-else :tx="latestTransaction" @click="handleSelectTx" />
		</div>
	</Flex>
</template>

<style module>
.list {
	margin: -8px;
}

.txt_button {
	transition: all 0.2s var(--bezier);

	&:hover {
		color: var(--txt-secondary);
	}
}
</style>
