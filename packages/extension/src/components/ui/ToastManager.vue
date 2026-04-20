<script setup>
/** Composables */
import { useToast } from "@/composables/toast.js"
const { toast, closeToast } = useToast()

/** Variant borders: neutral outlines by default; color-coded when the toast
 *  carries a semantic color. Keeps the toast as one architectural family
 *  (flat rectangle + 2px border) while letting severity read at a glance. */
const variantClass = computed(() => {
	const c = toast.value?.color
	if (c === "red") return "variant_red"
	if (c === "green") return "variant_green"
	if (c === "orange") return "variant_orange"
	return null
})
</script>

<template>
	<Transition name="toast">
		<template v-if="toast">
			<Teleport to="#toast">
				<Flex justify="center" :class="$style.wrapper">
					<Flex
						@click="closeToast"
						align="center"
						gap="10"
						:class="[$style.card, variantClass && $style[variantClass]]"
					>
						<Icon :name="toast.icon || 'check-circle'" size="14" :color="toast.color || 'primary'" />
						<span :class="$style.label">{{ toast.label }}</span>
						<Icon name="close-circle" size="12" color="tertiary" :class="$style.close_icon" />
					</Flex>
				</Flex>
			</Teleport>
		</template>
	</Transition>
</template>

<style module>
.wrapper {
	position: absolute;
	top: 12px;
	left: 50%;
	right: 0;
	z-index: 2000;

	transform: translateX(-50%);
}

.card {
	background: var(--app-bg);
	border: 2px solid var(--nulo-outline);

	cursor: pointer;
	padding: 10px 14px;

	& .close_icon {
		transition: all 0.2s ease;
	}

	&:hover {
		.close_icon {
			fill: var(--txt-primary);
		}
	}
}

.label {
	font-family: var(--font-headline);
	font-size: 12px;
	font-weight: 700;
	letter-spacing: 0.08em;
	text-transform: uppercase;
	color: var(--txt-primary);

	white-space: nowrap;
}

.variant_red {
	border-color: var(--red);
}

.variant_green {
	border-color: var(--green);
}

.variant_orange {
	border-color: var(--orange);
}
</style>
