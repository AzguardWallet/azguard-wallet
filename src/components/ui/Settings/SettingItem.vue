<script setup>
const props = defineProps({
	title: String,
	description: String,
	icon: String,
	iconBgColor: {
		type: String,
		default: "gray-20",
	},
	iconFillColor: {
		type: String,
		default: "white",
	},
	to: String,
	chevron: {
		type: Boolean,
		required: false,
	},
	external: {
		type: Boolean,
		default: false,
	},
	disabled: {
		type: Boolean,
		default: false,
	},
	loading: {
		type: Boolean,
		default: false,
	},
	raw: {
		type: Boolean,
		default: false,
	},
})

const slots = defineSlots()
</script>

<template>
	<component
		:is="(to && !external && 'router-link') || (to && external && 'a') || 'div'"
		:to="!disabled && to && !external ? to : null"
		:href="external ? to : null"
		:target="external ? '_blank' : null"
		:class="[$style.wrapper, raw && $style.raw, icon && $style.withIcon, disabled && $style.disabled]"
	>
		<Flex align="center" justify="between" gap="16">
			<Flex align="center" gap="12" wide>
				<Icon
					v-if="icon && !loading"
					:name="icon"
					size="16"
					:color="iconFillColor"
					:class="[$style.icon, $style[iconBgColor]]"
				/>

				<div v-else-if="icon && loading" :class="$style.icon">
					<Spinner size="16" color="--txt-primary" />
				</div>

				<Flex direction="column" gap="4" wide>
					<Text size="14" weight="600" color="primary" :class="$style.title"> {{ title }} </Text>
					<Text v-if="description" size="12" weight="500" color="tertiary" :class="$style.description">
						{{ description }}
					</Text>
				</Flex>
			</Flex>

			<Flex align="center" gap="12">
				<slot name="right" />

				<Icon
					v-if="(to && !slots.right) || (chevron && !slots.right)"
					:name="!external ? 'chevron' : 'arrow-narrow-up-right'"
					size="16"
					:style="{ transform: `rotate(${!external ? '-90deg' : '0deg'})` }"
					:class="$style.chevron_icon"
				/>
			</Flex>
		</Flex>
	</component>
</template>

<style module>
.wrapper {
	position: relative;

	cursor: pointer;
	background: var(--gray-5);

	padding: 12px;

	transition: all 0.2s var(--bezier);

	&:hover {
		background: var(--gray-8);
	}

	&:active {
		background: var(--gray-10);
	}

	&:last-child {
		border-bottom: none;
	}

	&.disabled {
		pointer-events: none;
		opacity: 0.5;
	}

	&::after {
		position: absolute;
		bottom: 0;
		left: 12px;
		display: block;
		width: 100%;
		height: 1px;

		background: var(--gray-5);

		content: " ";
	}

	&:last-child::after {
		display: none;
	}

	&.withIcon::after {
		left: 50px;
	}

	&.raw {
		cursor: default;
		background: var(--gray-3);
	}
}

.icon {
	box-sizing: content-box;
	border-radius: 8px;
	background: var(--gray-20);

	padding: 5px;

	&.blue {
		background: var(--blue);
	}

	&.red {
		background: var(--red);
	}

	&.sand {
		background: var(--sand);
	}

	&.green {
		background: var(--green);
	}

	&.transparent {
		background: transparent;
	}
}

.chevron_icon {
	fill: var(--gray-15);
}

.title {
	min-width: 100%;
	width: 0;

	line-height: 16px !important;

	text-overflow: ellipsis;
	overflow: hidden;
	white-space: nowrap;
}

.description {
	min-width: 100%;
	width: 0;

	line-height: 14px !important;

	text-overflow: ellipsis;
	overflow: hidden;
	white-space: nowrap;
}
</style>
