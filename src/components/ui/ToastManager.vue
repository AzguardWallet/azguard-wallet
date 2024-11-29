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
					<Flex
						@click="closeToast"
						align="center"
						gap="8"
						:class="$style.card"
					>
						<Icon
							:name="toast.icon || 'check-circle'"
							size="14"
							color="primary"
						/>
						<Text
							size="13"
							weight="600"
							color="primary"
							style="white-space: nowrap"
						>
							{{ toast.label }}
						</Text>
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
	left: 0;
	right: 0;
	z-index: 2000;
}

.card {
	height: 28px;

	background: var(--card-bg);
	box-shadow: inset 0 0 0 1px var(--border), 0 4px 8px var(--shadow-10);
	border-radius: 50px;

	padding: 0 12px;
}
</style>
