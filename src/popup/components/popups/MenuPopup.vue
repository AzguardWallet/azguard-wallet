<script setup>
/** Components */
import Popup from "@/components/ui/Popup/Popup.vue"
import PopupCard from "@/components/ui/Popup/PopupCard.vue"

/** Utils */
import { managers } from "@/utils/core.js"

/** Store */
import { useAppStore } from "@/stores/app.store.ts"
import { usePopupStore } from "@/stores/popup.store"
const appStore = useAppStore()
const popupStore = usePopupStore()

const emit = defineEmits(["onClose"])

const displaceIdx = computed(() => {
	return popupStore.len - popupStore.popups.menu
})

const handleLockWallet = () => {
	emit("onClose")
	appStore.isLogined = false
	managers.profile.lockActiveProfile()
}
</script>

<template>
	<Popup @onClose="emit('onClose')" :displaceIdx="popupStore.popups.menu">
		<PopupCard :displaceIdx>
			<Flex wide direction="column" gap="24" :class="$style.wrapper">
				<Flex direction="column" gap="12">
					<Text size="14" weight="600" color="primary"> Profiles </Text>

					<Flex align="center" justify="between" :class="$style.link">
						<Flex align="center" gap="10">
							<Icon name="check-circle" size="16" color="green" />
							<Text size="14" weight="600" color="primary"> My Profile </Text>
						</Flex>

						<Flex align="center" gap="8" :class="$style.icons">
							<Icon name="settings" size="16" color="tertiary" />
						</Flex>
					</Flex>
				</Flex>

				<Flex direction="column" gap="12">
					<Button type="secondary" size="medium" leftIcon="plus-circle" leftIconColor="primary" disabled>
						Create new profile
					</Button>
					<Button type="secondary" size="medium" leftIcon="text" leftIconColor="primary" disabled>
						Import using seed phrase
					</Button>
				</Flex>

				<Flex direction="column" gap="12">
					<Or />
					<Button
						@click="handleLockWallet"
						type="secondary"
						size="medium"
						leftIcon="key-circle"
						leftIconColor="primary"
					>
						Lock profile
					</Button>
				</Flex>
			</Flex>
		</PopupCard>
	</Popup>
</template>

<style module>
.wrapper {
	padding: 0 20px 24px 20px;
}

.link {
	border-radius: 12px;
	cursor: pointer;
	box-shadow: inset 0 0 0 1px var(--border), 0 1px 2px var(--shadow-5);

	padding: 12px 16px 12px 12px;

	transition: all 0.2s var(--bezier);

	&:hover {
		background: var(--gray-3);
		box-shadow: inset 0 0 0 1px var(--border-hovered), 0 1px 2px var(--shadow-5);
	}

	&:active {
		background: var(--gray-5);
	}
}
</style>
