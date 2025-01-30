<script setup>
/** Components */
import Popup from "@/components/ui/Popup/Popup.vue"
import PopupCard from "@/components/ui/Popup/PopupCard.vue"
import PopupHeader from "@/components/ui/Popup/PopupHeader.vue"

/** Utils */
import { AccountType } from "@/wallet/services/account/client"
import { managers } from "@/utils/core"

/** Store */
import { useAppStore } from "@/stores/app.store"
import { usePopupStore } from "@/stores/popup.store"
const appStore = useAppStore()
const popupStore = usePopupStore()

const emit = defineEmits(["onClose"])
const props = defineProps({
	show: Boolean,
})

const displaceIdx = computed(() => {
	return popupStore.len - popupStore.popups.new_account
})

const inputEl = useTemplateRef("inputEl")

const name = ref("")

const isAlreadyExist = computed(() => !!appStore.accounts.find(a => a.name === name.value))

const isAvailableToCreateAccount = computed(() => {
	if (!name.value.length) return
	if (isAlreadyExist.value) return

	return true
})

const handleCreateAccount = async () => {
	if (!isAvailableToCreateAccount.value) return

	const account = await managers.account.createAccount(AccountType.Azguard_v0, name.value.trim())

	appStore.account = account
	appStore.accounts.push(account)

	await chrome.storage.local.set({
		"azguard:ui:activeAccount": account.address,
	})

	emit("onClose")
}

watch(
	() => props.show,
	async () => {
		if (!props.show) {
			document.removeEventListener("keydown", onKeydown)

			name.value = ""
		} else {
			document.addEventListener("keydown", onKeydown)

			name.value = `Account ${appStore.accounts.sort((a, b) => b.index - a.index)[0].index + 1}`

			await nextTick()
			inputEl.value.inputEl.focus()
		}
	},
)

const onKeydown = e => {
	if (e.key === "Enter") handleCreateAccount()
}
</script>

<template>
	<Popup :show @onClose="emit('onClose')" :displaceIdx="popupStore.popups.new_account">
		<PopupCard :displaceIdx>
			<PopupHeader @onClose="emit('onClose')" closable>
				<template #title>
					<Text size="14" weight="600" color="primary">New account</Text>
				</template>
			</PopupHeader>

			<Flex wide direction="column" gap="24" :class="$style.wrapper">
				<Input ref="inputEl" v-model="name" label="Account name" placeholder="My Vault">
					<template #right>
						<Transition name="fade">
							<Flex v-if="isAlreadyExist" align="center" gap="6">
								<Icon name="warning" size="12" color="red" />
								<Text size="12" weight="600" color="primary"> Already exist </Text>
							</Flex>
						</Transition>
					</template>
				</Input>

				<Flex direction="column" gap="12">
					<Button
						@click="handleCreateAccount"
						wide
						type="primary"
						size="medium"
						:disabled="!isAvailableToCreateAccount"
					>
						Create
					</Button>

					<Text size="12" weight="500" color="tertiary" height="140" align="center" style="padding: 0 20px">
						New accounts do not require the creation of a new seed phrase
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

.network {
	border-radius: 12px;
	cursor: pointer;
	box-shadow: inset 0 0 0 1px var(--gray-10), 0 1px 2px var(--gray-5);

	padding: 12px;

	transition: all 0.2s var(--bezier);

	&:hover {
		background: var(--gray-3);

		& .icons {
			opacity: 1;
		}
	}

	&:active {
		background: var(--gray-5);
	}
}

.icons {
	opacity: 0;

	transition: all 0.2s var(--bezier);
}

.item {
	height: 30px;

	border-radius: 8px;
	box-shadow: inset 0 0 0 2px var(--gray-5);
	cursor: pointer;

	padding: 0 16px;

	transition: all 0.2s var(--bezier);

	&:hover {
		box-shadow: inset 0 0 0 2px var(--gray-10);
	}

	&:active {
		background: var(--gray-5);
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
