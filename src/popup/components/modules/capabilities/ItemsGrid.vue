<script setup lang="ts">
/**
 * A grid of toggleable items with consistent include/exclude behavior.
 * Used for all item lists: contracts, classes, event sources, accounts, and scope patterns.
 *
 * Renders items as rows in a CSS subgrid (icon + 2 content columns).
 * Row content is provided via the #item slot — the parent determines what to render.
 */

defineProps<{
	/** Array of items to render as grid rows */
	items: unknown[]
	/** Returns true if item at index is active (green check), false for inactive (gray circle, dimmed) */
	isActive: (index: number) => boolean
	/** Non-interactive and visually dimmed (e.g., parent switch is excluded) */
	disabled?: boolean
}>()

defineEmits<{
	/** User clicked an item row. Parent determines semantics (exclude/include). */
	toggle: [index: number]
}>()
</script>

<template>
	<div v-if="items.length" :class="[$style.grid, disabled && $style.disabled]">
		<div
			v-for="(item, i) in items"
			:key="i"
			:class="[$style.row, isActive(i) && $style.reveal, !isActive(i) && $style.inactive]"
			@click.stop="$emit('toggle', i)"
		>
			<Icon
				:name="isActive(i) ? 'check-circle' : 'circle'"
				size="14"
				:color="isActive(i) ? 'green' : 'secondary'"
				:class="$style.grid_icon"
			/>
			<slot name="item" :item="item" :index="i" :active="isActive(i)" />
		</div>
	</div>
</template>

<style module>
.grid {
	width: 100%;

	display: grid;
	grid-template-columns: 14px 1fr;
	column-gap: 12px;
	row-gap: 0;

	margin-top: 4px;
}

.row {
    padding: 6px;

	display: grid;
	grid-template-columns: subgrid;
	grid-column: 1 / -1;

	align-items: start;

	cursor: pointer;
	
	border-radius: 6px;
	transition: background 0.15s ease;

	&:hover {
		background: var(--gray-5);
	}
}

.reveal {
	&:hover {
		* {
			visibility: visible;
		}
	}
}

.inactive {
	opacity: 0.5;
}

.disabled {
	cursor: default;
	pointer-events: none;
}

.grid_icon {
	margin-top: -1px;
}
</style>
