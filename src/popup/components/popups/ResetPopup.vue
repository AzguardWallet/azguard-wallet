<script setup>
/** Components */
import Popup from "@/components/ui/Popup/Popup.vue"
import PopupCard from "@/components/ui/Popup/PopupCard.vue"
import ItemsContainer from "@/components/ui/Settings/ItemsContainer.vue"
import SettingItem from "@/components/ui/Settings/SettingItem.vue"

/** Composables */
import { useToast } from "@/composables/toast.js"
const { openToast } = useToast()

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
	return popupStore.len - popupStore.popups.reset?.order
})

const router = useRouter()

const emit = defineEmits(["onClose"])
const props = defineProps({
	show: Boolean,
})

const checks = reactive({
	permanent: false,
	undone: false,
	sure: false,
})

const isReadyToReset = computed(() => checks.permanent && checks.undone && checks.sure)
const handleReset = () => {
	if (!isReadyToReset.value) return

	cacheStore.confirm.confirm_text = "Yes, delete profile"
	cacheStore.confirm.confirm_color = "red"
	cacheStore.confirm.title = "Delete your profile permanently?"
	cacheStore.confirm.description =
		"This action cannot be undone. This will permanently delete your profile. Type the name of the profile to confirm."
	cacheStore.confirm.confirmation_text = appStore.profile.name
	cacheStore.confirm.callback = () => {
		managers.profile.deleteProfile(appStore.profile.id)
		popupStore.closeAll()

		cacheStore.confirm = {}

		appStore.profiles = appStore.profiles.filter(p => p.id !== appStore.profile.id)
		appStore.profile = appStore.profiles.length && appStore.profiles[0]
		appStore.networks = []
		appStore.network = null
		appStore.accounts = []
		appStore.account = null
		appStore.transactions = []
		appStore.awaitingTransactions = []
		chrome.storage.local.remove("azguard:ui:feePaymentMethods")

		appStore.isLogined = false
		appStore.isSessionChecked = false

		if (!appStore.profiles.length) {
			router.push("/popup/register")
		}

		openToast({ label: "Profile deleted", icon: "check-circle" })
	}

	popupStore.open("confirm")
}

watch(
	() => props.show,
	async () => {
		if (!props.show) {
			for (const key in checks) {
				const element = checks[key]
				if (element) checks[key] = false
			}
		} else {
			await nextTick()
		}
	},
)
</script>

<template>
	<Popup :show @onClose="emit('onClose')" :displaceIdx="popupStore.popups.reset?.order">
		<PopupCard :displaceIdx>
			<Flex wide direction="column" gap="32" :class="$style.wrapper">
				<Flex align="center" direction="column" gap="12">
					<Flex align="center" gap="6">
						<Icon name="trash" size="18" color="red" />
						<Text size="16" weight="600" color="primary"> Delete Profile </Text>
					</Flex>

					<Text size="14" weight="500" color="body" height="140" align="center" style="padding: 0 12px">
						This action cannot be undone if you have not saved your profile credentials
					</Text>
				</Flex>

				<ItemsContainer title="Profile to delete">
					<SettingItem :title="appStore.profile?.name ?? ''" icon="user" raw />
				</ItemsContainer>

				<Flex direction="column" gap="16">
					<Text size="13" weight="600" color="body"> Before you continue </Text>

					<Flex direction="column" gap="12">
						<Checkbox v-model="checks.permanent">
							<Text size="14" weight="600" color="secondary" height="140">
								I understand this action is permanent
							</Text>
						</Checkbox>
						<Checkbox v-model="checks.undone">
							<Text size="14" weight="600" color="secondary" height="140">
								I understand this action cannot be undone
							</Text>
						</Checkbox>
						<Checkbox v-model="checks.sure">
							<Text size="14" weight="600" color="secondary" height="140">
								I'm sure there's no assets left in my profile
							</Text>
						</Checkbox>
					</Flex>
				</Flex>

				<Flex wide direction="column" align="center" gap="12">
					<Button @click="handleReset" type="red" size="medium" wide :disabled="!isReadyToReset">
						Reset
					</Button>

					<Text size="12" weight="500" color="support" height="140" align="center" style="max-width: 300px">
						You will be able to recover your profile later if you have saved the seed phrase or secret key
					</Text>
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
