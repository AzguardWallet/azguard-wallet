<script setup>
const route = useRoute()
const router = useRouter()

const props = defineProps({
	hideTitle: {
		type: Boolean,
		required: false,
	},
	hideNavigation: {
		type: Boolean,
		required: false,
	},
})
</script>

<template>
	<Flex wide align="center" gap="12" :class="$style.wrapper">
		<button v-if="!hideNavigation" @click="router.go(-1)" :class="$style.back_btn" aria-label="Back" type="button">
			<MaterialIcon name="arrow_back" :size="20" color="secondary" />
		</button>
		<span v-else :class="$style.back_spacer" />

		<span v-if="!hideTitle" :class="$style.title">{{ route.meta.title }}</span>
		<span v-else :class="$style.title_spacer" />

		<div :class="$style.right_slot">
			<slot name="right" />
		</div>
	</Flex>
</template>

<style module>
.wrapper {
	padding: 8px 0;
	min-height: 32px;
}

.back_btn {
	display: flex;
	align-items: center;
	justify-content: center;

	width: 32px;
	height: 32px;

	background: transparent;
	border: none;
	cursor: pointer;

	flex-shrink: 0;

	transition: background 0.2s var(--bezier);

	&:hover {
		background: var(--nulo-surface-high);
	}
}

.back_spacer {
	width: 32px;
	flex-shrink: 0;
}

.title {
	flex: 1;

	font-family: var(--font-headline);
	font-size: 12px;
	font-weight: 700;
	letter-spacing: 0.15em;
	text-transform: uppercase;
	color: var(--txt-primary);

	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}

.title_spacer {
	flex: 1;
}

.right_slot {
	display: flex;
	align-items: center;
	justify-content: flex-end;
	min-width: 32px;
	flex-shrink: 0;
}
</style>
