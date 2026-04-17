<script setup>
/** Composables */
import { useToast } from "@/composables/toast.js"
const { toast, closeToast } = useToast()
</script>

<template>
	<Transition name="toast">
		<template v-if="toast">
			<Teleport to="#toast">
				<Flex justify="center" :class="$style.wrapper">
					<Flex @click="closeToast" align="center" gap="8" :class="$style.card">
						<Icon :name="toast.icon || 'check-circle'" size="14" :color="toast.color || 'primary'" />
						<Text size="13" weight="600" :color="toast.color || 'primary'" style="white-space: nowrap">
							{{ toast.label }}
						</Text>
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
	top: 10px;
	left: 50%;
	right: 0;
	z-index: 2000;

	transform: translateX(-50%);
}

.card {
	height: 28px;

	background: var(--nulo-surface);
	box-shadow: inset 0 0 0 1px var(--nulo-border), 0 4px 8px rgba(10, 9, 8, 0.5);
	border-radius: 50px;
	cursor: pointer;

	padding: 0 12px;

	& .close_icon {
		transition: all 0.2s ease;
	}

	&:hover {
		.close_icon {
			fill: var(--txt-primary);
		}
	}
}
</style>
