<script setup>
/** Components */
import Popup from "@/components/ui/Popup/Popup.vue"
import PopupCard from "@/components/ui/Popup/PopupCard.vue"

/** Store */
import { useAppStore } from "@/stores/app.store.ts"
import { usePopupStore } from "@/stores/popup.store"
const appStore = useAppStore()
const popupStore = usePopupStore()

const displaceIdx = computed(() => {
	return popupStore.popups.reset
})

const emit = defineEmits(["onClose"])
const props = defineProps({
	show: Boolean,
})
</script>

<template>
	<Popup :show @onClose="emit('onClose')">
		<PopupCard :displaceIdx="displaceIdx">
			<Flex wide direction="column" gap="32" :class="$style.wrapper">
				<Flex align="center" direction="column" gap="12">
					<Flex align="center" gap="6">
						<Icon name="help" size="18" color="primary" />
						<Text size="16" weight="600" color="primary">
							Forgot Password
						</Text>
					</Flex>

					<Text
						size="14"
						weight="500"
						color="body"
						height="140"
						align="center"
						style="padding: 0 12px"
					>
						Choose from the following options to restore or reset
						your wallet
					</Text>
				</Flex>

				<Flex direction="column" gap="12">
					<Text size="13" weight="600" color="secondary">
						Possible solutions
					</Text>

					<Tooltip wide delay="500">
						<Button
							wide
							square
							type="secondary"
							size="medium"
							leftIcon="text"
							leftIconColor="primary"
							disabled
						>
							Recovery with a seed phrase
						</Button>

						<template #content>
							Your wallet does not have a saved seed phrase
						</template>
					</Tooltip>
					<Button
						@click="popupStore.open('reset')"
						square
						type="secondary"
						size="medium"
						leftIcon="trash"
						leftIconColor="primary"
					>
						Reset Wallet
					</Button>
					<Tooltip wide delay="500">
						<Button
							wide
							square
							type="secondary"
							size="medium"
							leftIcon="switch"
							leftIconColor="primary"
							disabled
						>
							Switch to other profile
						</Button>

						<template #content>
							You have only one profile
						</template>
					</Tooltip>
				</Flex>

				<Text
					size="12"
					weight="500"
					color="tertiary"
					height="160"
					align="center"
				>
					For security, the wallet does not provide functionality for
					recovering a forgotten password
				</Text>
			</Flex>
		</PopupCard>
	</Popup>
</template>

<style module>
.wrapper {
	padding: 0 20px 24px 20px;
}
</style>
