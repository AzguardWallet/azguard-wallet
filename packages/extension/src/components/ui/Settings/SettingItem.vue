<script setup>
const props = defineProps({
	size: {
		type: String,
		default: "medium",
	},
	title: String,
	description: String,
	icon: String,
	materialIcon: String,
	iconBgColor: {
		type: String,
		default: "gray-20",
	},
	iconFillColor: {
		type: String,
		default: "secondary",
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
		:to="!disabled && to && !external ? to : ''"
		:href="external ? to : null"
		:target="external ? '_blank' : null"
		:class="[$style.wrapper, $style[size], raw && $style.raw, disabled && $style.disabled]"
		:tabindex="disabled ? -1 : 0"
	>
		<Flex wide align="center" justify="between" gap="16">
			<Flex align="center" gap="14" wide>
				<div :class="$style.icon_wrapper">
					<!-- Dot -->
					<slot name="dot" />

					<!-- Icon by prop or slot -->
					<template v-if="!slots.icon">
						<MaterialIcon
							v-if="materialIcon && !loading"
							:name="materialIcon"
							:size="20"
							color="secondary"
							:class="$style.material_icon"
						/>
						<Icon
							v-else-if="icon && !loading"
							:name="icon"
							size="18"
							:color="iconFillColor"
							:class="$style.icon"
						/>
						<div v-else-if="(icon || materialIcon) && loading" :class="$style.icon_loading">
							<Spinner size="16" color="--txt-primary" />
						</div>
					</template>
					<template v-else>
						<slot name="icon" />
					</template>
				</div>

				<!-- Labels: Title & Description -->
				<Flex direction="column" gap="4" wide>
					<Flex align="center" gap="6">
						<Text size="14" weight="500" color="primary" :class="[$style.title, slots.titleSuffix && $style.titleWithSuffix]"> {{ title }} </Text>
						<slot name="titleSuffix" />
					</Flex>
					<Text v-if="description" size="12" weight="500" color="tertiary" :class="$style.description">
						{{ description }}
					</Text>
				</Flex>
			</Flex>

			<Flex align="center" gap="12">
				<slot name="right" />

				<MaterialIcon
					v-if="(to && !slots.right) || (chevron && !slots.right)"
					:name="!external ? 'chevron_right' : 'arrow_outward'"
					:size="18"
					color="secondary"
					:class="$style.chevron_icon"
				/>
			</Flex>
		</Flex>
	</component>
</template>

<style module>
.wrapper {
	position: relative;

	display: flex;
	align-items: center;

	cursor: pointer;
	background: transparent;
	text-decoration: none;

	padding: 16px 20px;

	transition: background 0.2s var(--bezier);

	&:hover {
		background: var(--nulo-surface-high);
	}

	&:active {
		background: var(--nulo-surface-highest);
	}

	&:focus-visible {
		background: var(--nulo-surface-high);
		outline: none;
	}

	&.disabled {
		pointer-events: none;
		opacity: 0.5;
	}

	&::after {
		position: absolute;
		bottom: 0;
		left: 20px;
		right: 20px;
		display: block;
		height: 1px;

		background: rgba(74, 70, 63, 0.3);

		content: " ";
	}

	&:last-child::after {
		display: none;
	}

	&.large {
		padding: 20px;
	}

	&.medium {
		padding: 16px 20px;
	}

	&.small {
		padding: 12px 20px;
	}

	&.raw {
		cursor: default;
		background: var(--nulo-surface-low);
	}
}

.icon_wrapper {
	position: relative;
	display: inline-flex;
	align-items: center;
	justify-content: center;
	width: 20px;
	height: 20px;
	flex-shrink: 0;
}

.material_icon {
	color: var(--nulo-secondary);
	transition: color 0.2s var(--bezier);
}

.wrapper:hover .material_icon {
	color: var(--nulo-accent);
}

.icon_loading {
	display: inline-flex;
	align-items: center;
	justify-content: center;
}

.chevron_icon {
	color: var(--nulo-secondary);
	transition: color 0.2s var(--bezier);
}

.wrapper:hover .chevron_icon {
	color: var(--nulo-accent);
}

.title {
	min-width: 100%;
	width: 0;

	line-height: 20px !important;
	letter-spacing: 0.01em;

	text-overflow: ellipsis;
	overflow: hidden;
	white-space: nowrap;

	&.titleWithSuffix {
		min-width: unset;
		width: auto;
	}
}

.description {
	min-width: 100%;
	width: 0;

	line-height: 16px !important;

	text-overflow: ellipsis;
	overflow: hidden;
	white-space: nowrap;
}
</style>
