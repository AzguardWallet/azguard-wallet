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

const router = useRouter()

const displaceIdx = computed(() => {
	return popupStore.len - popupStore.popups.accounts
})

const emit = defineEmits(["onClose"])

const account = computed(() => appStore.account)

const showAllOtherAccounts = ref(false)
const otherAccounts = computed(() => {
	return appStore.accounts
		.filter((a) => a.address !== account.value.address)
		.filter((a) => a.visible)
		.sort((a, b) => a.index - b.index)
})
const hiddenAccounts = computed(() =>
	appStore.accounts
		.filter((a) => a.address !== account.value.address)
		.filter((a) => !a.visible)
)
const address = computed(() => appStore.account.address.toString())

const handleSelectAccount = (acc) => {
	appStore.selectAccount(acc)
	appStore.syncBalances()
}

const handleCopyAddress = (target) => {
	window.navigator.clipboard.writeText(target)
	openToast({ label: "Address is copied", icon: "copy" })
}

const handleManageAccounts = () => {
	router.push("/popup/settings/security/accounts")
	emit("onClose")
}
</script>

<template>
	<Popup @onClose="emit('onClose')" :displaceIdx="popupStore.popups.accounts">
		<PopupCard :displaceIdx>
			<Flex wide direction="column" gap="24" :class="$style.wrapper">
				<Flex direction="column" gap="16">
					<Flex align="center" justify="between">
						<Text size="14" weight="600" color="primary">
							Accounts
						</Text>

						<Flex
							@click="handleManageAccounts"
							align="center"
							gap="4"
							:class="['clickable', $style.txt_button]"
						>
							<Text size="13" weight="600" color="tertiary">
								Manage accounts
							</Text>
							<Icon
								name="arrow-narrow-up-right"
								size="12"
								color="tertiary"
							/>
						</Flex>
					</Flex>

					<Flex direction="column" gap="8">
						<Flex
							align="center"
							justify="between"
							:class="$style.account"
						>
							<Flex gap="10">
								<Icon
									name="check-circle"
									size="16"
									color="green"
								/>

								<Flex direction="column" gap="8">
									<Text
										size="14"
										weight="600"
										color="primary"
									>
										{{ account.name }}
									</Text>
									<Text
										size="13"
										weight="600"
										color="tertiary"
									>
										<Text
											@click="
												handleCopyAddress(
													account.address
												)
											"
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
						</Flex>
					</Flex>
				</Flex>

				<Flex v-if="otherAccounts.length" direction="column" gap="6">
					<Flex align="center" justify="between">
						<Text size="13" weight="600" color="body">
							Switch to
						</Text>
						<Text
							v-if="hiddenAccounts.length"
							size="12"
							weight="600"
							color="tertiary"
							align="center"
						>
							<Text color="secondary">{{
								hiddenAccounts.length
							}}</Text>
							hidden
						</Text>
					</Flex>

					<Flex
						v-for="acc in otherAccounts.slice(
							0,
							showAllOtherAccounts ? appStore.accounts.length : 3
						)"
						@click="handleSelectAccount(acc)"
						align="center"
						justify="between"
						:class="$style.account"
					>
						<Flex align="center" gap="10">
							<Icon name="vault" size="16" color="primary" />

							<Text
								size="14"
								weight="600"
								color="primary"
								:class="$style.account_name"
							>
								{{ acc.name }}
							</Text>

							<Text
								@click.stop="handleCopyAddress(acc.address)"
								size="13"
								weight="600"
								color="tertiary"
								class="copyable"
							>
								{{ acc.address.slice(0, 6) }}
								•••
								{{ acc.address.slice(-4) }}
							</Text>
						</Flex>
					</Flex>

					<Button
						v-if="otherAccounts.length > 3"
						@click="showAllOtherAccounts = !showAllOtherAccounts"
						type="tertiary"
						size="small"
						square
					>
						{{ showAllOtherAccounts ? "Hide" : "Show" }} all
						accounts
					</Button>
				</Flex>

				<Flex direction="column" gap="12">
					<Button
						@click="popupStore.open('new_account')"
						type="secondary"
						size="medium"
						leftIcon="plus-circle"
						leftIconColor="primary"
					>
						New account
					</Button>

					<Text
						size="12"
						weight="500"
						color="tertiary"
						height="140"
						align="center"
						style="padding: 0 20px"
					>
						Creating new account do not require the creation of a
						new seed phrase
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

.account_name {
	max-width: 120px;

	overflow: hidden;
	text-overflow: ellipsis;
}

.txt_button {
	& span,
	& svg {
		transition: all 0.2s var(--bezier);
	}

	&:hover {
		& span,
		& svg {
			color: var(--txt-secondary);
			fill: var(--txt-secondary);
		}
	}
}
</style>
