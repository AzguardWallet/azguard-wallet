<script setup>
const props = defineProps({
	title: {
		type: String,
		required: true,
	},
	backTo: {
		type: String,
		required: false,
	},
	showBack: {
		type: Boolean,
		default: true,
	},
	leadingIcon: {
		type: String,
		required: false,
	},
	leadingIconColor: {
		type: String,
		default: "secondary",
	},
})

const router = useRouter()

function handleBack() {
	if (window.history.length > 1) {
		router.back()
	} else if (props.backTo) {
		router.push(props.backTo)
	} else {
		router.push("/popup/general")
	}
}
</script>

<template>
	<Flex align="center" justify="between" gap="12" :class="$style.wrapper">
		<button v-if="showBack" @click="handleBack" :class="$style.back_btn" type="button" aria-label="Back">
			<MaterialIcon name="arrow_back" :size="22" color="primary" />
		</button>
		<div v-else :class="$style.back_spacer" />

		<Flex align="center" justify="center" gap="8" :class="$style.title_wrapper">
			<MaterialIcon v-if="leadingIcon" :name="leadingIcon" :size="18" :color="leadingIconColor" />
			<span :class="$style.title">{{ title }}</span>
		</Flex>

		<div :class="$style.trailing">
			<slot name="trailing" />
		</div>
	</Flex>
</template>

<style module>
.wrapper {
	padding: 10px 16px;
	min-height: 48px;
}

.back_btn {
	display: flex;
	align-items: center;
	justify-content: center;

	width: 40px;
	height: 40px;

	background: transparent;
	border: none;
	cursor: pointer;

	flex-shrink: 0;

	transition: background 0.2s var(--bezier);

	&:hover {
		background: rgba(248, 241, 231, 0.08);
	}
}

.back_spacer {
	width: 40px;
	flex-shrink: 0;
}

.title_wrapper {
	flex: 1;
	min-width: 0;
}

.title {
	font-family: var(--font-headline);
	font-size: 13px;
	font-weight: 700;
	letter-spacing: 0.12em;
	text-transform: uppercase;
	color: var(--txt-primary);

	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}

.trailing {
	display: flex;
	align-items: center;
	justify-content: flex-end;
	gap: 4px;
	min-width: 40px;
	flex-shrink: 0;
}
</style>
