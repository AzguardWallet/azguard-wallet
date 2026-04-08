<script setup>
/** Vendor */
import { DateTime } from "luxon"


/** Composables */
import { useTicker } from "@/composables/ticker"
import { useToast } from "@/composables/toast"
const { openToast } = useToast()

const props = defineProps({
	task: {
		type: Object,
		required: true,
	},
	isSubtask: {
		type: Boolean,
		default: false,
	},
	showContent: {
		type: Boolean,
		default: false,
	},
})

const subtasks = computed(() => (props.task.subtasks.length ? props.task.subtasks : [props.task]))
const completedSubtasks = computed(() => subtasks.value.filter((st) => st.finishedAt))

const now = useTicker(1_000)
const relativeTime = computed(() => {
	return DateTime.fromMillis(props.task.createdAt).toRelative({
		base: DateTime.fromMillis(now.value),
		style: "short",
		locale: "en",
	})
})
const iconSize = computed(() => (props.isSubtask ? "12" : "16"))

const circumference = computed(() => 2 * Math.PI * 10)
const arcLength = computed(() => circumference.value / subtasks.value?.length)
const arcLengthWithGap = computed(() => arcLength.value - 4)

function offsetFor(i) {
	return -(i * arcLength.value)
}

const content = computed(() => props.task.humanizedContent)
const isContentAvailable = computed(() => content.value && Object.keys(content.value).length > 0)

const error = computed(() => {
	const err = { description: props.task.error }

	function findSource(t) {
		const errTask = t.subtasks?.find((x) => x.error)
		return errTask ? [errTask.content.label, ...findSource(errTask)] : []
	}

	const path = findSource(props.task)
	err.title = path.length ? `${path.join(" -> ")}:` : ""

	return err
})

const isCopied = ref(false)
function handleCopyError(_task) {
	isCopied.value = true

	window.navigator.clipboard.writeText(`${error.value.title || `${props.task.content.label}:`}\n${error.value.description}`)

	openToast({ label: "Error is copied", icon: "copy" })

	setTimeout(() => {
		isCopied.value = false
	}, 1_500)
}
</script>

<template>
	<Flex direction="column" gap="6" wide :class="$style.wrapper">
		<Flex align="start" gap="12" wide :class="[$style.task_wrapper, isSubtask && $style.subtask]">
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

			<Flex direction="column" gap="4" wide>
				<Flex align="center" justify="between" wide>
					<Flex direction="column" align="start" justify="center" gap="8" wide style="min-height: 24px;">
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

					<Flex v-if="!isSubtask" align="center" justify="end" style="min-width: 70px;">
						<Text size="12" weight="500" color="tertiary">
							{{ relativeTime }}
						</Text>
					</Flex>
					
					<svg v-else-if="subtasks.length > 1" width="24" height="24" viewBox="0 0 24 24" role="img" aria-label="Circle split into four colored arcs">
						<g transform="rotate(-80 12 12)">
							<circle
								v-for="(st, i) in subtasks"
								:key="st.id"
								cx="12"
								cy="12"
								r="10"
								fill="none"
								:stroke="st.statusColor"
								stroke-width="2"
								stroke-linecap="round"
								:stroke-dasharray="arcLengthWithGap + ' ' + circumference"
								:stroke-dashoffset="offsetFor(i)"
							/>
						</g>
					</svg>
				</Flex>

				<div v-if="showContent && isContentAvailable && !isSubtask" :class="$style.divider" />

				<Flex v-if="showContent && isContentAvailable && !isSubtask" wide>
					<Flex v-if="task.content.kind === ContentKind.BalanceUpdate" direction="column" gap="8" wide>
						<Text size="12" color="secondary">Token:
							<Text color="primary">
								{{ content.token.symbol }}
							</Text>
							{{ content.token.name }}
						</Text>
						<Text v-if="content.account" size="12" color="secondary">Account:
							<AddressDisplay :address="content.account" />
						</Text>
					</Flex>
					<Flex v-if="task.content.kind === ContentKind.TokenMint" align="center" gap="6" wide>
						<Text size="12" color="secondary"> Mint
							<Text color="primary">
								{{ `${content.amount} ${content.token.symbol}` }}
							</Text>
							{{ content.amount == 1 ? 'token' : 'tokens' }}
						</Text>
					</Flex>
					<Flex v-if="task.content.kind === ContentKind.Transfer" align="center" gap="6">
						<Text size="12" height="140" color="secondary">Transfer
							<Text color="primary">
								{{ `${content.amount} ${content.token.symbol}` }}
							</Text>
							{{ content.amount == 1 ? 'token' : 'tokens' }}
							from
							<AddressDisplay :address="content.sender" />
							to
							<AddressDisplay :address="content.recipient" />
						</Text>
					</Flex>
					<Flex v-if="task.content.kind === ContentKind.RevokeAuthwits" align="center" wide>
						<Text size="12" color="secondary">Revoke
							<Text color="primary">
								{{ content.authwitCount }}
							</Text>
							{{ content.authwitCount == 1 ? 'authwit' : 'authwits' }}
						</Text>
					</Flex>
				</Flex>
			</Flex>
		</Flex>

		<Flex
			v-if="task.error && showContent && !isSubtask"
			@click.stop="handleCopyError(t)"
			direction="column"
			gap="4"
			wide
			:class="$style.error_wrapper"
		>
			<Text size="12" weight="600" color="red" height="130"> {{ error?.title }} </Text>

			<Flex align="start" wide :class="$style.error_description_wrapper">
				<Text size="12" color="red" height="130" :class="$style.error_description">
					{{ error?.description }}
				</Text>

				<Icon :name="isCopied ? 'check' : 'copy'" size="14" color="red" style="opacity: 0.7;" />
			</Flex>
		</Flex>
	</Flex>
</template>

<style module>
.wrapper {
	cursor: pointer;
}

.task_wrapper {
	border-radius: 12px;

	padding: 10px 8px;

	transition: all 0.2s var(--bezier);
	background: var(--gray-3);

	&:hover {
		background: var(--gray-5);
	}

	&:active {
		background: var(--gray-5);
	}
}

.status_icon {
	position: relative;

	min-width: 32px;
	min-height: 32px;

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

.subtask {
	.status_icon {
		min-width: 24px;
		min-height: 24px;

		border-radius: 8px;
	}
}

.divider {
	width: 100%;
	height: 1px;

	margin: 6px 0;
	
	background: linear-gradient(
		to right,
		transparent 0%,
		var(--gray-10) 20%,
		var(--gray-10) 80%,
		transparent 100%
	);
}

.error_wrapper {
	padding: 0px 8px 8px 8px;
}

.error_description_wrapper {
	position: relative;

	.error_description {
		padding-right: 16px;

		display: -webkit-box;
		-webkit-box-orient: vertical;

		overflow: hidden;
		text-overflow: ellipsis;
		word-break: break-word;

		-webkit-line-clamp: 2;
	}

	& svg {
		position: absolute;
		top: 0;
		right: 0;
	}
}
</style>
