<script setup>
/** Components */
import Popup from "@/components/ui/Popup/Popup.vue"
import PopupCard from "@/components/ui/Popup/PopupCard.vue"

/** Utils */
import { managers } from "@/utils/core"
import { AccountType } from "@/wallet/services/account/client"

/** Store */
import { useAppStore } from "@/stores/app.store"
const appStore = useAppStore()

const emit = defineEmits(["onClose"])

const name = ref("")

const selectedType = ref("Schnorr")
const types = [
	{
		name: "Schnorr",
		available: true,
	},
	{
		name: "Ecdsa",
		available: false,
	},
	{
		name: "SingleKey",
		available: false,
	},
]

const isAvailableToCreateAccount = computed(() => {
	if (!name.value.length) return
	if (!selectedType.value) return

	return true
})

const handleCreateAccount = async () => {
	if (!isAvailableToCreateAccount.value) return

	const account = await managers.account.createAccount(
		AccountType.Azguard_v0,
		name.value.trim()
	)

	appStore.account = account
	appStore.accounts.push(account)

	await chrome.storage.local.set({ "azguard:ui:activeAccount": account.address })

	emit("onClose")
}
</script>

<template>
	<Popup @onClose="emit('onClose')">
		<PopupCard>
			<Flex wide direction="column" gap="20" :class="$style.wrapper">
				<Text size="14" weight="600" color="primary">
					New account
				</Text>

				<Input
					v-model="name"
					label="Account name"
					placeholder="My Vault"
				/>

				<Flex direction="column" gap="10">
					<Text size="13" weight="600" color="secondary">
						Select account type
					</Text>

					<Flex align="center" justify="between" gap="6">
						<Flex
							v-for="type in types"
							@click="selectedType = type.name"
							align="center"
							justify="center"
							gap="6"
							:class="[
								$style.item,
								type.name === selectedType && $style.selected,
								!type.available && $style.disabled,
							]"
						>
							<Icon
								v-if="type.name === selectedType"
								name="check-circle"
								size="12"
								color="white"
							/>
							<Text
								size="14"
								weight="600"
								:color="
									type.name === selectedType
										? 'white'
										: 'primary'
								"
							>
								{{ type.name }}
							</Text>
						</Flex>
					</Flex>
				</Flex>

				<Button
					@click="handleCreateAccount"
					wide
					type="primary"
					size="medium"
					:disabled="!isAvailableToCreateAccount"
				>
					<Text color="white">Create</Text>
				</Button>

				<Text size="12" weight="500" color="tertiary" height="140">
					New accounts do not require the creation of a new seed
					phrase, just select the account type
				</Text>
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
