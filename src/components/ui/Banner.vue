<script setup>
const props = defineProps({
	variant: {
		type: String,
		default: "info",
	},
	direction: {
		type: String,
		default: "horizontal",
	},
	text: {
		type: String,
	},
	wide: {
		type: Boolean,
	},
	action: {
		type: Object,
	},
	isLoading: {
		type: Boolean,
		default: false,
	},
})
</script>

<template>
	<Flex justify="between" align="center" :wide="wide" :class="[$style.wrapper, $style[variant]]">
		<Flex :align="direction === 'horizontal' ? 'center' : 'start'" gap="8">
			<Flex align="center" justify="center" :class="$style.icon">
				<Icon v-if="!isLoading" name="info" size="16" color="secondary" />
				<Spinner v-else size="16" color="--txt-primary" />
			</Flex>

			<Flex :direction="direction === 'horizontal' ? 'row' : 'column'" gap="8">
				<Text size="12" weight="600" color="primary" :style="{ marginTop: direction === 'vertical' && '4px', lineHeight: '1.4' }">
					<slot />
					<slot name="title" />
				</Text>

				<Text size="12" weight="500" color="tertiary" :style="{ marginBottom: !action && '4px' }">
					<slot name="description" />
				</Text>

				<Text
					v-if="action && direction === 'vertical'"
					@click="action.callback()"
					size="12"
					weight="600"
					color="blue"
					:class="$style.action_btn"
					style="margin-bottom: 4px"
				>
					{{ action.name }}
				</Text>
			</Flex>
		</Flex>

		<Text
			v-if="action && direction === 'horizontal'"
			@click="action.callback()"
			size="12"
			weight="600"
			color="blue"
			:class="$style.action_btn"
		>
			{{ action.name }}
		</Text>
	</Flex>
</template>

<style module>
.wrapper {
	border-radius: 8px;

	padding: 8px 16px 8px 8px;

	&.info {
		background: var(--gray-5);
	}

	&.warning {
		background: var(--gray-5);

		& .icon {
			& svg {
				fill: var(--orange);
			}
		}
	}

	&.error {
		background: var(--gray-5);

		& .icon {
			& svg {
				fill: var(--red);
			}
		}
	}
}

.icon {
	min-width: 20px;
	min-height: 20px;
	height: 20px;

	box-sizing: content-box;
}

.text {
	line-height: 20px !important;
}

.action_btn {
	cursor: pointer;
}
</style>
