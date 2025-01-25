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
	return popupStore.len - popupStore.popups.reset
})

const router = useRouter()

const emit = defineEmits(["onClose"])
const props = defineProps({
	show: Boolean,
})

const inputEl = useTemplateRef("inputEl")

const profileNameTerm = ref("")
const checks = reactive({
	permament: false,
	undone: false,
	sure: false,
})

const isReadyToReset = computed(
	() => profileNameTerm.value === appStore.profile.name && checks.permament && checks.undone && checks.sure,
)
const handleReset = () => {
	if (!isReadyToReset.value) return

	cacheStore.confirm.confirm_text = "Yes, reset"
	cacheStore.confirm.description =
		"This is the last warning before a deletion. If you have not saved the seed phrase, it will not be possible to regain access to the wallet."
	cacheStore.confirm.callback = () => {
		managers.profile.deleteProfile(appStore.profile.id)
		popupStore.closeAll()

		appStore.profiles = appStore.profiles.filter(p => p.id !== appStore.profile.id)
		appStore.profile = appStore.profiles[0]
		appStore.accounts = []
		appStore.balances = []
		appStore.tokens = []
		appStore.transactions = []

		appStore.isLogined = false
		appStore.isSessionChecked = false
		appStore.tokenAwaitingBalanceIdx = false

		// router.push("/popup/register")

		openToast({ label: "Profile deleted", icon: "check-circle" })
	}

	popupStore.open("confirm")
}

watch(
	() => props.show,
	async () => {
		if (!props.show) {
			profileNameTerm.value = ""
			for (const key in checks) {
				const element = checks[key]
				if (element) checks[key] = false
			}
		} else {
			await nextTick()
			inputEl.value.inputEl.focus()
		}
	},
)
</script>

<template>
	<Popup :show @onClose="emit('onClose')" :displaceIdx="popupStore.popups.reset">
		<PopupCard :displaceIdx>
			<Flex wide direction="column" gap="32" :class="$style.wrapper">
				<Flex align="center" direction="column" gap="12">
					<Flex align="center" gap="6">
						<Icon name="trash" size="18" color="red" />
						<Text size="16" weight="600" color="primary"> Reset Profile </Text>
					</Flex>

					<Text size="14" weight="500" color="body" height="140" align="center" style="padding: 0 12px">
						Your profile will be permanently removed and you can't undo this action
					</Text>
				</Flex>

				<ItemsContainer title="Profile to reset">
					<SettingItem :title="appStore.profile.name" :description="appStore.profile.id" icon="user" raw />
				</ItemsContainer>

				<Input
					ref="inputEl"
					v-model="profileNameTerm"
					label="Type your profile name"
					:placeholder="appStore.profile.name"
				/>

				<Flex direction="column" gap="16">
					<Text size="13" weight="600" color="body"> Before you continue </Text>

					<Flex direction="column" gap="12">
						<Checkbox v-model="checks.permament">
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
					<Button v-if="appStore.isLogined" type="secondary" size="medium" wide>
						<Text color="tertiary" wrap="wrap">
							<Text color="secondary">{{ appStore.accounts.length }} accounts</Text>
							with a total balance
							<Text color="secondary">$0.00</Text>
						</Text>
					</Button>

					<Button @click="handleReset" type="red" size="medium" wide :disabled="!isReadyToReset">
						Reset
					</Button>

					<Text size="12" weight="500" color="support" height="140" align="center" style="max-width: 300px">
						You will be able to restore your profile later if you have saved the seed phrase
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
