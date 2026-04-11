<script setup>
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
	return popupStore.len - popupStore.popups.new_account?.order
})

const inputEl = useTemplateRef("inputEl")

const name = ref("")
const enablePersistentHistory = ref(false)

const isAlreadyExist = computed(() => !!appStore.accounts.find((a) => a.name === name.value))

const isAvailableToCreateAccount = computed(() => {
	if (!name.value.length) return
	if (isAlreadyExist.value) return

	return true
})

const handleCreateAccount = async () => {
	if (!isAvailableToCreateAccount.value) return

	const accountType = enablePersistentHistory.value ? AccountType.Vibeguard_v0_persistent : AccountType.Vibeguard_v0
	const account = await managers.account.createAccount(appStore.profile.id, appStore.network.chainId, accountType, name.value.trim())

	appStore.account = account
	appStore.accounts.push(account)

	await chrome.storage.local.set({
		"vibeguard:ui:activeAccount": account.address,
	})

	emit("onClose")
}

watch(
	() => props.show,
	async () => {
		if (!props.show) {
			document.removeEventListener("keydown", onKeydown)

			name.value = ""
			enablePersistentHistory.value = false
		} else {
			document.addEventListener("keydown", onKeydown)

			// Can't use account.index for naming - indexes are per account type, not global
			let n = 1
			while (appStore.accounts.some((a) => a.name === `Account ${n}`)) n++
			name.value = `Account ${n}`

			await nextTick()
			inputEl.value.inputEl.focus()
		}
	},
)

const onKeydown = (e) => {
	if (e.key === "Enter") handleCreateAccount()
}
</script>

<template>
	<Popup :show @onClose="emit('onClose')" :displaceIdx="popupStore.popups.new_account?.order">
		<PopupCard :displaceIdx>
			<PopupHeader @onClose="emit('onClose')" closable>
				<template #title>
					<Text size="14" weight="600" color="primary">New account</Text>
				</template>
			</PopupHeader>

			<Flex wide direction="column" gap="24" :class="$style.wrapper">
				<Input
					ref="inputEl"
					label="Account name"
					placeholder="My Account"
					sanitize
					:maxLength="25"
					v-model="name"
				>
					<template #right>
						<Transition name="fade">
							<Flex v-if="isAlreadyExist" align="center" gap="6">
								<Icon name="warning" size="12" color="red" />
								<Text size="12" weight="600" color="primary"> Already exist </Text>
							</Flex>
						</Transition>
					</template>
				</Input>

				<Flex direction="column" gap="8">
					<Flex align="center" justify="between">
						<Flex direction="column" gap="4">
							<Text size="13" weight="600" color="primary">Enable persistent history</Text>
							<Text size="11" weight="500" color="tertiary" height="140" style="max-width: 220px">
								Stores transaction history on-chain.
							</Text>
						</Flex>
						<Toggle v-model="enablePersistentHistory" />
					</Flex>
				</Flex>

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
