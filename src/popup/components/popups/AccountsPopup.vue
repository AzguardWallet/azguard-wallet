<script setup>
/** Components */
import Popup from "@/components/ui/Popup/Popup.vue"
import PopupCard from "@/components/ui/Popup/PopupCard.vue"

/** Composables */
import { useToast } from "@/composables/toast.js"
const { openToast } = useToast()

/** Store */
import { useAppStore } from "@/stores/app.store.ts"
import { usePopupStore } from "@/stores/popup.store.ts"
const appStore = useAppStore()
const popupStore = usePopupStore()

const displaceIdx = computed(() => {
	return (
		popupStore.popups.length -
		popupStore.popups.findIndex((p) => p === "accounts")
	)
})

const emit = defineEmits(["onClose"])

const selectedAccountType = ref("private")

const account = computed(() => appStore.account)
const otherAccounts = computed(() => {
	return appStore.accounts.filter((a) => a.address !== account.value.address)
})
const address = computed(() => appStore.account.address.toString())

const handleSelectAccount = (acc) => {
	appStore.selectAccount(acc)
}
const handleHideAccount = (acc) => {
	appStore.hideAccount(acc)
}

const handleCopyAddress = () => {
	window.navigator.clipboard.writeText(appStore.account.address)
	openToast({ label: "Address is copied to clipboard", icon: "copy" })
}
</script>

<template>
	<Popup @onClose="emit('onClose')">
		<PopupCard :displaceIdx="displaceIdx">
			<Flex wide direction="column" gap="24" :class="$style.wrapper">
				<Flex direction="column" align="center" gap="16">
					<Text size="14" weight="600" color="primary">
						Accounts
					</Text>

					<Flex align="center" gap="6" :class="$style.selector">
						<Flex
							@click="selectedAccountType = 'private'"
							align="center"
							gap="6"
							:class="[
								$style.selector_item,
								selectedAccountType === 'private' &&
									$style.selected,
							]"
						>
							<Icon
								v-if="selectedAccountType === 'private'"
								name="key-square"
								size="16"
								color="blue"
							/>
							<Text size="13" weight="600" color="primary">
								Private
							</Text>
						</Flex>
						<Flex
							@click="selectedAccountType = 'public'"
							align="center"
							gap="6"
							:class="[
								$style.selector_item,
								selectedAccountType === 'public' &&
									$style.selected,
							]"
						>
							<Icon
								v-if="selectedAccountType === 'public'"
								name="face"
								size="16"
								color="blue"
							/>
							<Text size="13" weight="600" color="primary">
								Public
							</Text>
						</Flex>
					</Flex>
				</Flex>

				<Flex direction="column" gap="8">
					<Flex
						align="center"
						justify="between"
						:class="$style.account"
					>
						<Flex gap="10">
							<Icon name="check-circle" size="16" color="green" />

							<Flex direction="column" gap="8">
								<Text size="14" weight="600" color="primary">
									{{ account.name }}
								</Text>
								<Text size="13" weight="600" color="tertiary">
									<Text
										@click="handleCopyAddress"
										color="body"
										class="copyable"
									>
										{{ address.slice(0, 6) }}
										•••
										{{ address.slice(-4) }}
									</Text>
									<Text color="support"> •</Text>
									$0.00
								</Text>
							</Flex>
						</Flex>

						<Flex align="center" gap="8" :class="$style.icons">
							<Icon
								:name="
									selectedAccountType === 'private'
										? 'key-square'
										: 'face'
								"
								size="16"
								color="tertiary"
							/>
						</Flex>
					</Flex>
				</Flex>

				<Flex v-if="otherAccounts.length" direction="column" gap="6">
					<Text size="13" weight="600" color="body"> Switch to </Text>

					<Flex
						v-for="acc in otherAccounts"
						@click="handleSelectAccount(acc)"
						align="center"
						justify="between"
						:class="$style.account"
					>
						<Flex align="center" gap="10">
							<Icon name="vault" size="16" color="blue" />

							<Text
								size="14"
								weight="600"
								color="primary"
								:class="$style.account_name"
							>
								{{ acc.name }}
							</Text>

							<Text size="12" weight="600" color="tertiary">
								{{ acc.address.slice(0, 6) }}
								•••
								{{ acc.address.slice(-4) }}
							</Text>
						</Flex>

						<Flex align="center" gap="8" :class="$style.icons">
							<Icon
								@click.stop="handleHideAccount(acc)"
								name="close-circle"
								size="14"
								color="tertiary"
							/>
						</Flex>
					</Flex>
				</Flex>

				<Flex direction="column" gap="12">
					<Button
						@click="popupStore.open('new_account')"
						type="secondary"
						size="medium"
						leftIcon="plus-circle"
						leftIconColor="blue"
					>
						New account
					</Button>

					<Text
						size="12"
						weight="500"
						color="tertiary"
						height="140"
						align="center"
					>
						New accounts do not require the creation of a new seed
						phrase, just select the account type
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

.selector {
	border-radius: 10px;
	background: var(--gray-10);

	padding: 2px;
}

.selector_item {
	height: 24px;

	border-radius: 8px;
	cursor: pointer;

	padding: 0 8px 0 6px;

	transition: all 0.2s var(--bezier);

	&.selected {
		background: var(--card-bg);
	}
}

.account {
	border-radius: 12px;
	cursor: pointer;
	box-shadow: inset 0 0 0 1px var(--border), 0 1px 2px var(--shadow-5);

	padding: 12px 16px 12px 12px;

	transition: all 0.2s var(--bezier);

	&:hover {
		background: var(--gray-3);
		box-shadow: inset 0 0 0 1px var(--border-hovered),
			0 1px 2px var(--shadow-5);
	}

	&:active {
		background: var(--gray-5);
	}
}

.icons {
	transition: all 0.2s var(--bezier);
}

.account_name {
	max-width: 120px;

	overflow: hidden;
	text-overflow: ellipsis;
}
</style>
