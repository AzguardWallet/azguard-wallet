<script setup>
/** Vendor */
import BN from "bignumber.js"
import { DateTime } from "luxon"

/** Services */
import { OriginType, TxStatus } from "@/wallet/services/transaction/client"
import { TaskStatus } from "@/wallet/services/task/spec"

/** Composables */
import { useTicker } from "@/composables/ticker"

/** Utils */
import { balanceFormatted } from "@/utils/amount.js"

const props = defineProps({
	task: {
		type: Object,
		required: true,
	},
	isSubtask: {
		type: Boolean,
		default: false,
	}
})

console.log('props.task', props.task);

const subtasks = computed(() => props.task.subtasks.length ? props.task.subtasks : [props.task] )
const completedSubtasks = computed(() => subtasks.value.filter(st => st.finishedAt))
const now = useTicker(1_000)
const relativeTime = computed(() => {
	return DateTime
		.fromMillis(props.task.createdAt)
		.toRelative({
			base: DateTime.fromMillis(now.value),
			style: "short",
			locale: "en",
		})
})
const iconSize = computed(() => props.isSubtask ? '12' : '16')

// export enum TaskStatus {
// 	Pending,
// 	Processing,
// 	Completed,
// 	Cancelled,
// 	Failed,
// }

// export type Task = {
// 	id: string;
// 	content: ITaskContent;
// 	status: TaskStatus;
// 	createdAt: number;
// 	startedAt?: number;
// 	subtasks: Task[];
// 	origin?: TxOrigin;
// 	parentId?: string;
// 	finishedAt?: number;
// 	result?: ITaskResult;
// 	error?: string;
// };
</script>

<template>
	<Flex align="center" justify="between" :class="$style.wrapper" wide>
		<Flex align="center" gap="12" :class="isSubtask && $style.subtask">
			<Flex v-if="task.status === TaskStatus.Pending" align="center" justify="center" :class="$style.status_icon">
				<span :class="[$style.bg, $style.pending]" />
				<Icon name="clock-circle" :size="iconSize" color="gray" />
			</Flex>
			<Flex v-else-if="task.status === TaskStatus.Processing" align="center" justify="center" :class="$style.status_icon">
				<span :class="[$style.bg, $style.progress]" />
				<Spinner :size="iconSize" color="--blue" />
			</Flex>
			<Flex v-else-if="task.status === TaskStatus.Completed" align="center" justify="center" :class="$style.status_icon">
				<span :class="[$style.bg, $style.done]" />
				<Icon name="check" :size="iconSize" color="green" />
			</Flex>
			<Flex v-else-if="task.status === TaskStatus.Cancelled" align="center" justify="center" :class="$style.status_icon">
				<span :class="[$style.bg, $style.pending]" />
				<Icon name="cancel" :size="iconSize" color="gray" />
			</Flex>
			<Flex v-else-if="task.status === TaskStatus.Failed" align="center" justify="center" :class="$style.status_icon">
				<span :class="[$style.bg, $style.failed]" />
				<Icon name="close" :size="iconSize" color="red" />
			</Flex>

			<Flex direction="column" gap="6">
				<Text size="13" weight="600" color="primary">
					{{ task.content.label }}
				</Text>

				<Flex v-if="!isSubtask" align="center" gap="4">
					<Icon name="double-check" size="12" color="secondary" />
					<Text size="12" color="secondary">
						{{ `Done ${completedSubtasks.length} of ${subtasks.length} ${subtasks.length > 1 ? 'tasks' : 'task'}` }}
					</Text>
				</Flex>
			</Flex>
		</Flex>

		<Flex align="center" justify="end" style="min-width: 70px;">
			<Text size="12" weight="500" color="tertiary">
				{{ relativeTime }}
			</Text>
		</Flex>
	</Flex>
</template>

<style module>
.wrapper {
	cursor: pointer;
	border-radius: 12px;

	padding: 8px;

	transition: all 0.2s var(--bezier);
	background: var(--gray-3);

	&:hover {
		background: var(--gray-5);
	}

	&:active {
		background: var(--gray-5);
	}
}

.subtask {
	.status_icon {
		width: 24px;
		height: 24px;

		border-radius: 8px;
	}
}
.status_icon {
	position: relative;

	width: 32px;
	height: 32px;

	border-radius: 12px;

	.bg {
		position: absolute;
		inset: 0;
		border-radius: inherit;
		opacity: 0.1;
	}

	svg {
		position: relative;
		z-index: 1;
	}
}
.pending {
	background: var(--gray);
}
.progress {
	background: var(--blue);
}
.done {
	background: var(--green);
}
.failed {
	background: var(--red);
}
</style>
