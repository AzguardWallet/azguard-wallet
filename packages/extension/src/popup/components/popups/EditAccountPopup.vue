<script setup>
/** Composables */
import { useToast } from "@/composables/toast"
const { openToast } = useToast()

/** Store */
import { useAppStore } from "@/stores/app.store"
import { usePopupStore } from "@/stores/popup.store"
import { useCacheStore } from "@/stores/cache.store"
const appStore = useAppStore()
const popupStore = usePopupStore()
const cacheStore = useCacheStore()

const displaceIdx = computed(() => {
	return popupStore.len - popupStore.popups.edit_account?.order
})

const emit = defineEmits(["onClose"])
const props = defineProps({
	show: Boolean,
})

const accountToEdit = computed(() => appStore.accounts.find((n) => n.address === cacheStore.accountToEditIdx))

const notAllowedAccountNames = computed(() => appStore.accounts.map((n) => n.name))

const isStartedEditing = ref(false)
const nameTerm = ref("")
const addressTerm = ref("")
const handleFillFieldsWithDefaultValues = () => {
	nameTerm.value = accountToEdit.value.name
	addressTerm.value = accountToEdit.value.address
}

const isAvailableToUpdateAccount = computed(() => {
	if (!nameTerm.value.length) return
	if (!addressTerm.value.length) return

	return true
})

const isAccountUpdateInProgress = ref(false)
const handleUpdateAccount = async () => {
	if (!isAvailableToUpdateAccount.value) return

	isAccountUpdateInProgress.value = true
	await appStore.updateAccount(cacheStore.accountToEditIdx, nameTerm.value)
	isAccountUpdateInProgress.value = false

	emit("onClose")

	openToast({ label: "Account is updated" })
}

watch(
	() => props.show,
	() => {
		if (!props.show) {
			document.removeEventListener("keydown", onKeydown)

			handleFillFieldsWithDefaultValues()
		} else {
			document.addEventListener("keydown", onKeydown)

			handleFillFieldsWithDefaultValues()
		}
	},
)

const onKeydown = (e) => {
	if (e.key === "Enter") handleUpdateAccount()
}
</script>

<template>
	<Popup :show @onClose="emit('onClose')" :displaceIdx="popupStore.popups.edit_account?.order">
		<PopupCard :displaceIdx>
			<PopupHeader @onClose="emit('onClose')" closable>
				<template #title>
					<Text size="14" weight="600" color="primary">Edit account</Text>
				</template>
			</PopupHeader>

			<Flex wide direction="column" gap="24" :class="$style.wrapper">
				<ItemsContainer>
					<SettingItem
						size="large"
						:title="accountToEdit.name"
						description="Selected account for editing"
						icon="vault"
						raw
					/>
				</ItemsContainer>

				<Input
					label="Name"
					placeholder="My Vault"
					v-model="nameTerm"
					autofocus
					sanitize
					:maxLength="25"
					@input="isStartedEditing = true"
				>
				</Input>

				<Flex direction="column" gap="12">
					<Button
						@click="handleUpdateAccount"
						wide
						type="primary"
						size="medium"
						:disabled="!isAvailableToUpdateAccount"
						:loading="isAccountUpdateInProgress"
					>
						Update account
					</Button>
					<Button @click="handleFillFieldsWithDefaultValues" wide type="primary_outline" size="medium">
						Reset changes
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

.network {
	border-radius: 0;
	cursor: pointer;
	border: 1px solid var(--nulo-border);

	padding: 12px;

	transition: all 0.2s var(--bezier);

	&:hover {
		background: var(--nulo-surface-low);

		& .icons {
			opacity: 1;
		}
	}

	&:active {
		background: var(--nulo-surface-high);
	}
}

.icons {
	opacity: 0;

	transition: all 0.2s var(--bezier);
}

.item {
	height: 30px;

	border-radius: 8px;
	border: 2px solid var(--nulo-border);
	cursor: pointer;

	padding: 0 16px;

	transition: all 0.2s var(--bezier);

	&:hover {
		border: 2px solid var(--nulo-outline);
	}

	&:active {
		background: var(--nulo-surface-high);
	}

	&.selected {
		background: var(--green);
	}

	&.disabled {
		opacity: 0.5;
		pointer-events: none;
	}
}
</style>
