<route lang="json">
{
	"meta": {
		"isAuthRequired": true
	}
}
</route>

<script setup>
/** Components */
import TransactionsList from "../components/modules/activity/TransactionsList.vue"
import Navigation from "../components/Navigation.vue"
import Spinner from "@/components/ui/Spinner.vue"

/** Services */
import { AccountType } from "@/wallet/services/account/client"
import { ContentKind } from "@/wallet/services/task/spec"
import { TaskServiceClient } from "@/wallet/services/task/client"
import { TransactionServiceClient } from "@/wallet/services/transaction/client"

/** Utils */
import { DateTime } from "luxon"

/** Store */
import { useAppStore } from "@/stores/app.store"

const appStore = useAppStore()

/** Reactive state */
const isPersistentAccount = computed(() => appStore.account?.type === AccountType.Azguard_v0_persistent)
const isSyncing = ref(false)
const syncUpdatedAt = ref(null)

/** Service clients + event subscriptions */
const taskService = new TaskServiceClient()
const transactionService = new TransactionServiceClient()

function onTaskCreated(task) {
	if (task.content.kind !== ContentKind.TransactionSync) return
	if (task.content.account !== appStore.account?.address) return
	isSyncing.value = true
}

function onTaskUpdated(task) {
	if (task.content.kind !== ContentKind.TransactionSync) return
	if (task.content.account !== appStore.account?.address) return
	if (task.finishedAt) {
		isSyncing.value = false
		syncUpdatedAt.value = task.finishedAt
	}
}

function onTaskDeleted(task) {
	if (task.content.kind !== ContentKind.TransactionSync) return
	if (task.content.account !== appStore.account?.address) return
	isSyncing.value = false
}

taskService.onTaskCreated.add(onTaskCreated)
taskService.onTaskUpdated.add(onTaskUpdated)
taskService.onTaskDeleted.add(onTaskDeleted)

/** Functions/Handlers */
const handleSync = () => {
	if (!appStore.account || !appStore.network || isSyncing.value) return
	isSyncing.value = true
	transactionService.syncTransactionHistory(appStore.network.chainId, appStore.account.address)
}

async function loadSyncState() {
	if (!appStore.account) return

	const tasks = await taskService.getTasks()
	isSyncing.value = tasks.some(t =>
		!t.finishedAt &&
		t.content.kind === ContentKind.TransactionSync &&
		t.content.account === appStore.account?.address
	)

	const cursor = await transactionService.getTxSyncCursor(appStore.account.address)
	syncUpdatedAt.value = cursor?.updatedAt || null
}

/** Lifecycle hooks */
onMounted(() => {
	loadSyncState()
})

onBeforeUnmount(() => {
	taskService.disconnect()
	transactionService.disconnect()
})
</script>

<template>
	<Flex v-if="appStore.isLogined" direction="column" :class="$style.wrapper">
		<TestnetAlert />

		<Flex direction="column" gap="20" :class="$style.wrapper_inner">
			<Flex align="center" justify="between">
				<Text size="13" weight="600" color="primary"> Transactions </Text>

				<Tooltip v-if="isPersistentAccount" position="end" :disabled="isSyncing || !syncUpdatedAt">
					<Button
						type="tertiary"
						size="mini"
						:disabled="isSyncing"
						@click="handleSync"
					>
						<Spinner v-if="isSyncing" size="12" color="--txt-secondary" />
						<Icon v-else name="refresh" size="12" color="secondary" />
					</Button>

					<template #content>
						<Text color="secondary">Last sync - </Text>
						<Text>{{ DateTime.fromMillis(syncUpdatedAt).toRelative({ locale: "en" }) }}</Text>
					</template>
				</Tooltip>
			</Flex>

			<Flex direction="column" gap="8" :class="$style.list">
				<template v-if="!appStore.transactions.length">
					<Flex align="center" gap="12" :class="$style.dummy">
						<Flex align="center" justify="center" :class="$style.dummy_circle">
							<div />
						</Flex>

						<Flex direction="column" gap="8">
							<div :class="$style.dummy_title" />
							<div :class="$style.dummy_subtitle" />
						</Flex>
					</Flex>

					<Flex align="center" gap="12" :class="$style.dummy">
						<Flex align="center" justify="center" :class="$style.dummy_circle">
							<div />
						</Flex>

						<Flex direction="column" gap="8">
							<div :class="$style.dummy_title" />
							<div :class="$style.dummy_subtitle" />
						</Flex>
					</Flex>
				</template>

				<TransactionsList :transactions="appStore.transactions" />
			</Flex>

			<Flex
				v-if="!appStore.transactions.length"
				direction="column"
				ap
				align="center"
				gap="12"
				:class="$style.empty_banner"
			>
				<template v-if="isPersistentAccount && isSyncing">
					<Spinner size="20" color="--txt-tertiary" />

					<Flex direction="column" align="center" gap="6">
						<Text size="13" weight="600" color="secondary" align="center"> Syncing transactions </Text>
						<Text size="12" weight="500" height="140" color="tertiary" align="center">
							Fetching your transaction history from the network
						</Text>
					</Flex>
				</template>

				<template v-else>
					<Icon name="zap-circle" size="20" color="tertiary" />

					<Flex direction="column" align="center" gap="6">
						<Text size="13" weight="600" color="secondary" align="center"> So far, it's empty </Text>
						<Text size="12" weight="500" height="140" color="tertiary" align="center">
							Once you start working with your assets, all activities will be displayed here
						</Text>
					</Flex>
				</template>
			</Flex>
		</Flex>

		<Navigation />
	</Flex>
</template>

<style module>
.wrapper {
	flex: 1;

	overflow: auto;

	background: var(--card-bg);
	border-top: 2px solid var(--gray-8);
	box-shadow: inset 0 10px 8px -2px var(--gray-3);

	border-top-left-radius: 24px;
	border-top-right-radius: 24px;
}

.wrapper_inner {
	flex: 1;

	padding: 20px 24px 80px 24px;
}

.list {
	margin: -8px;
}

.item {
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

.dummy {
	padding: 8px;

	&:nth-child(2) {
		opacity: 0.7;
	}

	&:nth-child(3) {
		opacity: 0.5;
	}
}

.dummy_circle {
	width: 32px;
	height: 32px;

	border-radius: 50%;
	background: var(--gray-5);

	& div {
		width: 12px;
		height: 12px;

		border-radius: 50%;
		background: var(--gray-15);
	}
}

.dummy_title {
	width: 120px;
	height: 6px;

	border-radius: 50px;
	background: var(--gray-10);
}

.dummy_subtitle {
	width: 60px;
	height: 6px;

	border-radius: 50px;
	background: var(--gray-5);
}

.empty_banner {
	max-width: 250px;

	margin: 40px auto 0 auto;
}
</style>
