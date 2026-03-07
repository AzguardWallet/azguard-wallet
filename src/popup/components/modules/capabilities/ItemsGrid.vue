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
	items: any[]
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
			:class="[$style.row, !isActive(i) && $style.inactive]"
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
	display: grid;
	grid-template-columns: 14px auto auto;
	column-gap: 6px;
	row-gap: 0;
	margin-top: 4px;
}

.row {
	display: grid;
	grid-template-columns: subgrid;
	grid-column: 1 / -1;
	align-items: center;
	cursor: pointer;
	border-radius: 6px;
	padding: 4px 6px;
	margin: 0 -6px;
	transition: background 0.15s ease;

	&:hover {
		background: var(--gray-5);
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
	margin-top: -2.5px;
}
</style>
