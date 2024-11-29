<script setup>
/** Utils */
import { comma } from "@/utils/amount.js"

/** Composables */
import { useToast } from "@/composables/toast.js"
const { openToast } = useToast()

/** Store */
import { useAppStore } from "@/stores/app.store"
const appStore = useAppStore()

const props = defineProps({
	selectedSendType: {
		type: String,
	},
})

const balance = reactive({
	private: 762,
	public: 5926,
})

const handleCopyAddress = () => {
	window.navigator.clipboard.writeText(appStore.account.address)
	openToast({ label: "Address is copied", icon: "copy" })
}
</script>

<template>
	<Flex align="center" justify="between" :class="$style.wrapper">
		<Flex align="center" gap="8">
			<Icon name="vault" size="16" color="blue" />
			<Text size="13" weight="600" color="primary">
				{{ appStore.account.name }}
			</Text>
			<Text
				@click="handleCopyAddress"
				size="13"
				weight="600"
				color="body"
				class="copyable"
			>
				{{ appStore.account.address.slice(0, 6) }}
				•••
				{{ appStore.account.address.slice(-4) }}
			</Text>
		</Flex>

		<Tooltip position="end">
			<Flex align="center" gap="6">
				<Icon
					:name="
						selectedSendType === 'private' ? 'key-square' : 'face'
					"
					size="14"
					color="secondary"
				/>
				<Text size="13" weight="600" color="primary">
					{{ comma(balance[selectedSendType]) }}
					AZT
				</Text>
			</Flex>

			<template #content> Your {{ selectedSendType }} balance </template>
		</Tooltip>
	</Flex>
</template>

<style module>
.wrapper {
	width: 100%;

	background: var(--card-bg);
	box-shadow: inset 0 0 0 1px var(--gray-10), 0 1px 2px var(--shadow-5);
	border-radius: 12px;

	padding: 12px;
}
</style>
