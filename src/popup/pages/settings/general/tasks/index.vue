<route lang="json">
{
	"meta": {
		"title": "Wallet Tasks",
		"isAuthRequired": true
	}
}
</route>

<script setup>
/** Components */
import Breadcrumbs from "@/components/ui/Settings/Breadcrumbs.vue"
import Navigation from "../../../../components/Navigation.vue"
import TaskCard from "./TaskCard.vue"

/** Utils */
import { TaskServiceClient } from "@/wallet/services/task/client"

const tasks = ref([])
const taskService = new TaskServiceClient()
taskService.onTaskCreated.add(onTaskCreated)
taskService.onTaskUpdated.add(onTaskUpdated)
taskService.onTaskDeleted.add(onTaskDeleted)
function onTaskCreated(task) {
	if (!task.parentId) {
		tasks.value.push(task)
	} else {
		const parent = findTaskRecursive(tasks.value, task.parentId)
		if (parent) {
			parent.subtasks.push(task)
		}
	}
}
function onTaskUpdated(task) {
	const existing = findTaskRecursive(tasks.value, task.id)

	if (existing) {
		Object.assign(existing, task)
	} else {
		if (!task.parentId) {
			tasks.value.push(task)
		} else {
			const parent = findTaskRecursive(tasks.value, task.parentId)
			if (parent) {
				parent.subtasks.push(task)
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

function handleShowSubtasks(task) {
	if (!task.subtasks.length) return
	task.showSubtasks = !task.showSubtasks
}

onMounted(async () => {
	tasks.value = await taskService.getTasks()
})
onBeforeUnmount(() => {
	taskService.disconnect()
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
					@click="handleShowSubtasks(t)"
					:task="t"
				/>

				<Flex
					v-if="t.showSubtasks"
					direction="column"
					gap="4"
					style="padding: 8px 0px 0px 12px;"
				>
					<Flex v-for="(st, i) in t.subtasks" align="center" gap="8" :class="(i !== t.subtasks.length - 1) && $style.icon">
						<Icon name="arrow-corner-down-right" size="16" color="tertiary" />
						<TaskCard
							@click=handleShowSubtasks(st)
							:task="st"
							isSubtask
						/>
					</Flex>
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
					@click="handleShowSubtasks(t)"
					:task="t"
				/>

				<Flex
					v-if="t.showSubtasks"
					direction="column"
					gap="4"
					style="padding: 8px 0px 0px 12px;"
				>
					<Flex v-for="(st, i) in t.subtasks" align="center" gap="8" :class="(i !== t.subtasks.length - 1) && $style.icon">
						<Icon name="arrow-corner-down-right" size="16" color="tertiary" />
						<TaskCard
							:task="st"
							isSubtask
						/>
					</Flex>
				</Flex>
			</div>
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

.icon {
	position: relative;
}

.icon::after {
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
/* .wrapper {
	flex: 1;

	height: 100%;

	background: var(--card-bg);
	border-top: 2px solid var(--gray-8);
	box-shadow: inset 0 10px 8px -2px var(--gray-3);

	border-top-left-radius: 24px;
	border-top-right-radius: 24px;

	padding: 20px 24px 24px 24px;
} */

</style>
