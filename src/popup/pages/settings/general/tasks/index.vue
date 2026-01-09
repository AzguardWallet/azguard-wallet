<route lang="json">
{
	"meta": {
		"title": "Wallet Tasks",
		"isAuthRequired": true
	}
}
</route>

<script setup>
/** Vendor */
import BN from "bignumber.js"

/** Components */
import Breadcrumbs from "@/components/ui/Settings/Breadcrumbs.vue"
import Navigation from "../../../../components/Navigation.vue"
import TaskCard from "./TaskCard.vue"

/** Services */
import { TaskServiceClient } from "@/wallet/services/task/client"
import { ContentKind, TaskStatus } from "@/wallet/services/task/spec"
import { TokenBalanceServiceClient } from "@/wallet/services/token-balance/client"
import { TokenServiceClient } from "@/wallet/services/token/client"

/** Utils */
import { balanceFormatted } from "@/utils/amount.js"

/** Store */
import { useAppStore } from "@/stores/app.store"
const appStore = useAppStore()

const tasks = ref([])
const activeTasks = computed(() => {
	return tasks.value
		.filter(t => !t.finishedAt)
		.sort((a, b) => b.createdAt - a.createdAt)
})
const completedTasks = computed(() => {
	return tasks.value
		.filter(t => t.finishedAt)
		.sort((a, b) => b.finishedAt - a.finishedAt)
})

async function processTask(task) {
	let humanizedContent = {}

	switch (task.content?.kind) {
		case ContentKind.BalanceUpdate:
			let balance
			try {
				balance = await tokenBalanceService.getTokenBalance(task.content.tbId)
			} catch (e) {
				
			} finally {
				humanizedContent.token = {
					name: balance?.token.name ?? "Unknown",
					symbol: balance?.token.symbol ?? "",
				}
			}
			if (appStore.account?.address !== task.content.account) {
				humanizedContent.account = task.content.account
			}
			break;
		case ContentKind.TokenMint:
			humanizedContent.token = {
				name: task.content.name,
				symbol: task.content.symbol,
			}
			humanizedContent.amount = balanceFormatted(new BN(task.content.amount || 0).dividedBy(new BN(10).pow(task.content.decimals || 0))).value
			break;
		case ContentKind.Transfer:
			let token
			try {
				token = await tokenService.getToken(task.content.tokenId)
			} catch (e) {
				
			} finally {
				humanizedContent.token = {
					name: token?.name ?? "Unknown",
					symbol: token?.symbol ?? "",
				}
			}
			humanizedContent.sender = task.content.senderAddress
			humanizedContent.recipient = task.content.recipientAddress
			humanizedContent.amount = balanceFormatted(new BN(task.content.amount || 0).dividedBy(new BN(10).pow(token?.decimals || 0))).value
			break;
		case ContentKind.RevokeAuthwits:
			humanizedContent.authwitCount = task.content.authwitIds.length
			break;
		
		default:
			break;
	}

	task.humanizedContent = humanizedContent
	
	return task
}
function processSubtask(subtask) {
	if (!subtask.parentId) return subtask

	return {
		...subtask,
		statusColor: (() => {
			switch (subtask.status) {
				case TaskStatus.Pending: return 'var(--gray)'
				case TaskStatus.Processing: return 'var(--blue)'
				case TaskStatus.Completed: return 'var(--green)'
				case TaskStatus.Cancelled: return 'var(--gray)'
				case TaskStatus.Failed: return 'var(--red)'
				default: return 'var(--gray)'
			}
		})()
	}
}
function processSubtaskRecursively(subtask) {
	const processed = processSubtask(subtask)

	if (processed.subtasks?.length) {
		processed.subtasks = processed.subtasks.map(st => processSubtaskRecursively(st))
	}

	return processed
}

const taskService = new TaskServiceClient()
taskService.onTaskCreated.add(onTaskCreated)
taskService.onTaskUpdated.add(onTaskUpdated)
taskService.onTaskDeleted.add(onTaskDeleted)
async function onTaskCreated(task) {
	task = await processTask(task)

	if (!task.parentId) {
		tasks.value.push(reactive(processSubtaskRecursively(task)))
	} else {
		const parent = findTaskRecursive(tasks.value, task.parentId)
		if (parent) {
			parent.subtasks.push(reactive(processSubtask(task)))
		}
	}
}
function onTaskUpdated(task) {
	const existing = findTaskRecursive(tasks.value, task.id)

	if (existing) {
		// Object.assign(existing, processSubtask(task))
		const processedTask = processSubtask(task)
		
		Object.keys(processedTask).forEach(key => {
			if (key !== 'subtasks' && key !== 'id') {
				existing[key] = processedTask[key]
			}
		})
	} else {
		const processedTask = processSubtask(task)

		if (!task.parentId) {
			tasks.value.push(reactive(processedTask))
		} else {
			const parent = findTaskRecursive(tasks.value, task.parentId)
			if (parent) {
				parent.subtasks.push(reactive(processedTask))
			}
		}
	}
}
function onTaskDeleted(task) {
	if (!task.parentId) {
		tasks.value = tasks.value.filter(t => t.id !== task.id)
	} else {
		const parent = findParentRecursive(tasks.value, task.id)
		if (parent) {
			parent.subtasks = parent.subtasks.filter(st => st.id !== task.id)
		}
	}
}
function findTaskRecursive(tasks, id) {
	for (const t of tasks) {
		if (t.id === id) return t

		const found = findTaskRecursive(t.subtasks, id)
		if (found) return found
	}

	return null
}
function findParentRecursive(tasks, childId) {
	for (const t of tasks) {
		if ((t.subtasks).some(st => st.id === childId)) return t

		const found = findParentRecursive(t.subtasks, childId)
		if (found) return found
	}

	return null
}

const tokenBalanceService = new TokenBalanceServiceClient()
const tokenService = new TokenServiceClient()

function handleClickTask(task) {
	task.showContent = !task.showContent

	if (!(task.subtasks.length || task.error)) return
	task.showSubtasks = !task.showSubtasks
}

onMounted(async () => {
	const _tasks = await Promise.all(
		(await taskService.getTasks()).map(task => processTask(task))
	)

	tasks.value = _tasks.map(t => processSubtaskRecursively(t)).map(t => reactive(t))
})
onBeforeUnmount(() => {
	taskService.disconnect()
	tokenBalanceService.disconnect()
	tokenService.disconnect()
})
</script>

<template>
	<Flex direction="column" gap="20" :class="$style.wrapper">
		<Breadcrumbs />

		<Flex direction="column" gap="8" wide v-if="activeTasks.length">
			<Flex align="center" justify="start" gap="6" wide style="padding-bottom: 4px;">
				<Text size="13" weight="600" color="primary">Active Tasks</Text>
				<Text size="13" weight="600" color="tertiary"> {{ activeTasks.length }} </Text>
			</Flex>

			<div v-for="t in activeTasks">
				<TaskCard
					@click="handleClickTask(t)"
					:task="t"
					:showContent="t.showContent"
				/>

				<Flex
					v-if="t.showSubtasks"
					direction="column"
					gap="4"
					style="padding: 4px 0px 0px 4px;"
				>
					<div v-for="(st, i) in t.subtasks">
						<Flex align="center" gap="8" :class="(i !== t.subtasks.length - 1) && $style.subtask_icon">
							<Icon name="arrow-corner-down-right" size="16" color="tertiary" />
							<TaskCard
								@click="handleClickTask(st)"
								:task="st"
								isSubtask
							/>
						</Flex>

						<Flex
							v-if="st.showSubtasks"
							direction="column"
							gap="4"
							style="padding: 4px 0px 0px 20px;"
						>
							<div v-for="(sst, ii) in st.subtasks">
								<Flex align="center" gap="8" :class="(ii !== st.subtasks.length - 1) && $style.subtask_icon">
									<Icon name="arrow-corner-down-right" size="16" color="tertiary" />
									<TaskCard
										@click="handleClickTask(sst)"
										:task="sst"
										isSubtask
									/>
								</Flex>

								<Flex
									v-if="sst.showSubtasks"
									direction="column"
									gap="4"
									style="padding: 4px 0px 0px 20px;"
								>
									<div v-for="(ssst, iii) in sst.subtasks">
										<Flex align="center" gap="8" :class="(iii !== sst.subtasks.length - 1) && $style.subtask_icon">
											<Icon name="arrow-corner-down-right" size="16" color="tertiary" />
											<TaskCard
												:task="ssst"
												:expandable="false"
												isSubtask
											/>
										</Flex>
									</div>
								</Flex>
							</div>
						</Flex>
					</div>
				</Flex>
			</div>
		</Flex>

		<Flex direction="column" gap="8" wide v-if="completedTasks.length">
			<Flex align="center" justify="between" wide style="padding-bottom: 4px;">
				<Flex align="center" justify="start" gap="6" wide>
					<Text size="13" weight="600" color="primary">Finished Tasks</Text>
					<Text size="13" weight="600" color="tertiary"> {{ completedTasks.length }} </Text>
				</Flex>

				<Tooltip side="bottom" position="end">
					<Icon name="warning" size="13" color="secondary" />

					<template #content> Finished tasks auto-clear after 1 hour </template>
				</Tooltip>
			</Flex>

			<div v-for="t in completedTasks">
				<TaskCard
					@click="handleClickTask(t)"
					:task="t"
					:showContent="t.showContent"
				/>

				<Flex
					v-if="t.showSubtasks"
					direction="column"
					gap="4"
					style="padding: 4px 0px 0px 4px;"
				>
					<div v-for="(st, i) in t.subtasks">
						<Flex align="center" gap="8" :class="(i !== t.subtasks.length - 1) && $style.subtask_icon">
							<Icon name="arrow-corner-down-right" size="16" color="tertiary" />
							<TaskCard
								@click="handleClickTask(st)"
								:task="st"
								isSubtask
							/>
						</Flex>

						<Flex
							v-if="st.showSubtasks"
							direction="column"
							gap="4"
							style="padding: 4px 0px 0px 20px;"
						>
							<div v-for="(sst, ii) in st.subtasks">
								<Flex align="center" gap="8" :class="(ii !== st.subtasks.length - 1) && $style.subtask_icon">
									<Icon name="arrow-corner-down-right" size="16" color="tertiary" />
									<TaskCard
										@click="handleClickTask(sst)"
										:task="sst"
										isSubtask
									/>
								</Flex>

								<Flex
									v-if="sst.showSubtasks"
									direction="column"
									gap="4"
									style="padding: 4px 0px 0px 20px;"
								>
									<div v-for="(ssst, iii) in sst.subtasks">
										<Flex align="center" gap="8" :class="(iii !== sst.subtasks.length - 1) && $style.subtask_icon">
											<Icon name="arrow-corner-down-right" size="16" color="tertiary" />
											<TaskCard
												:task="ssst"
												:expandable="false"
												isSubtask
											/>
										</Flex>
									</div>
								</Flex>
							</div>
						</Flex>
					</div>
				</Flex>
			</div>
		</Flex>

		<Flex v-if="!activeTasks.length && !completedTasks.length" align="center" :class="$style.empty_section">
			<Flex direction="column" align="center" gap="6" :class="$style.empty_banner">
				<Text size="13" weight="600" color="secondary" align="center">
					There are no active or recently finished tasks
				</Text>
				<Text size="12" weight="500" height="140" color="tertiary" align="center">
					Tasks show recent or current wallet activity
				</Text>
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

	padding: 20px 24px 80px 24px;
}

.subtask {
	position: relative;

	&::before {
		content: "";
		position: absolute;
		left: -8px;
		width: 2px;
		height: 110%;
		background: var(--txt-tertiary);
		transform-origin: center;
    }

	&:last-child:after {
      display:none;
    }	
}

.subtask_icon {
	position: relative;
}

.subtask_icon::after {
	content: "";
	position: absolute;
	left: 2px;
	bottom: 10px;
	width: 2px;
	height: 8px;
	border-radius: 12px;
	background: var(--txt-tertiary);
	transform: scaleX(0.5);
	transform-origin: center;
}

.empty_section {
    flex: 1;

    margin-bottom: 50px;
}

.empty_banner {
	max-width: 290px;

	margin: 40px auto 0 auto;
}
</style>
