<script setup>
/** Components */
import Popup from "@/components/ui/Popup/Popup.vue"
import PopupCard from "@/components/ui/Popup/PopupCard.vue"

/** Utils */
import { managers } from "@/utils/core.js"

/** Store */
import { useAppStore } from "@/stores/app.store.ts"
import { usePopupStore } from "@/stores/popup.store"
import { useCacheStore } from "@/stores/cache.store"
const appStore = useAppStore()
const popupStore = usePopupStore()
const cacheStore = useCacheStore()

const displaceIdx = computed(() => {
	return (
		popupStore.popups.length -
		popupStore.popups.findIndex((p) => p === "reset")
	)
})

const router = useRouter()

const emit = defineEmits(["onClose"])

const profileNameTerm = ref("")
const checks = reactive({
	permament: false,
	undone: false,
	sure: false,
})

const isReadyToReset = computed(
	() =>
		profileNameTerm.value === "My Profile" &&
		checks.permament &&
		checks.undone &&
		checks.sure
)
const handleReset = () => {
	if (!isReadyToReset.value) return

	cacheStore.confirm.description =
		"This is the last warning before a deletion. If you have not saved the seed phrase, it will not be possible to regain access to the wallet."
	cacheStore.confirm.callback = () => {
		managers.profile.deleteProfile(appStore.profile.id)
		popupStore.closeAll()

		router.push("/popup/register")
	}

	popupStore.open("confirm")
}
</script>

<template>
	<Popup @onClose="emit('onClose')">
		<PopupCard :displaceIdx="displaceIdx">
			<Flex wide direction="column" gap="32" :class="$style.wrapper">
				<Flex align="center" direction="column" gap="12">
					<Flex align="center" gap="6">
						<Icon name="warning" size="18" color="primary" />
						<Text size="16" weight="600" color="primary">
							Reset Wallet
						</Text>
					</Flex>

					<Text
						size="14"
						weight="500"
						color="body"
						height="140"
						align="center"
					>
						Your wallet will be permanently removed and you can't
						undo this action
					</Text>
				</Flex>

				<Input
					v-model="profileNameTerm"
					label="Type your profile name"
					placeholder="My Profile"
				/>

				<Flex direction="column" gap="16">
					<Text size="13" weight="600" color="body">
						Before you continue
					</Text>

					<Flex direction="column" gap="12">
						<Checkbox v-model="checks.permament">
							<Text
								size="14"
								weight="600"
								color="secondary"
								height="140"
							>
								I understand this action is permanent
							</Text>
						</Checkbox>
						<Checkbox v-model="checks.undone">
							<Text
								size="14"
								weight="600"
								color="secondary"
								height="140"
							>
								I understand this action cannot be undone
							</Text>
						</Checkbox>
						<Checkbox v-model="checks.sure">
							<Text
								size="14"
								weight="600"
								color="secondary"
								height="140"
							>
								I'm sure there's no assets left in my wallet
							</Text>
						</Checkbox>
					</Flex>
				</Flex>

				<Flex direction="column" gap="16">
					<Button type="secondary" size="medium">
						<Text color="tertiary" wrap="wrap">
							<Text color="secondary"
								>{{ appStore.accounts.length }} accounts</Text
							>
							with a total balance
							<Text color="secondary">$22,256.12</Text>
						</Text>
					</Button>

					<Button
						@click="handleReset"
						type="red"
						size="medium"
						:disabled="!isReadyToReset"
					>
						<Text color="white">Reset my wallet</Text>
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
</style>
