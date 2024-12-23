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
const accounts = computed(() => {
	return appStore.accounts.filter(a => a.visible).sort((a, b) => a.index - b.index)
})

const handleSelectAccount = acc => {
	appStore.selectAccount(acc)
	appStore.syncBalances()

	emit("onClose")
}

const isCopied = ref(false)
const handleCopyAddress = target => {
	isCopied.value = true

	window.navigator.clipboard.writeText(target)
	openToast({ label: "Address is copied", icon: "copy" })

	setTimeout(() => {
		isCopied.value = false
	}, 1_500)
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
				<Flex align="center" justify="between">
					<Text size="14" weight="600" color="primary"> Accounts </Text>

					<Flex
						@click="handleManageAccounts"
						align="center"
						gap="4"
						:class="['clickable', $style.txt_button]"
					>
						<Text size="13" weight="600" color="tertiary"> Manage accounts </Text>
						<Icon name="arrow-narrow-up-right" size="12" color="tertiary" />
					</Flex>
				</Flex>

				<Flex direction="column" gap="8">
					<Flex
						v-for="acc in accounts.slice(0, showAllOtherAccounts ? appStore.accounts.length : 3)"
						@click="handleSelectAccount(acc)"
						align="center"
						justify="between"
						:class="$style.account"
					>
						<Flex gap="10">
							<Icon
								:name="account.address === acc.address ? 'check-circle' : 'circle'"
								size="16"
								:color="account.address === acc.address ? 'green' : 'tertiary'"
							/>

							<Flex direction="column" gap="8">
								<Text size="14" weight="600" color="primary" :class="$style.account_name">
									{{ acc.name }}
								</Text>

								<Text size="13" weight="600" color="tertiary">
									{{ acc.address.slice(0, 6) }}
									<Text color="dark">•••</Text>
									{{ acc.address.slice(-4) }}
								</Text>
							</Flex>
						</Flex>

						<Flex align="center" gap="8" :class="$style.icons">
							<Icon
								@click.stop="handleCopyAddress(acc.address)"
								:name="isCopied ? 'check-circle' : 'copy'"
								size="14"
								:color="isCopied ? 'green' : 'tertiary'"
								:class="$style.icon_btn"
							/>
						</Flex>
					</Flex>

					<Button
						v-if="accounts.length > 3"
						@click="showAllOtherAccounts = !showAllOtherAccounts"
						type="secondary"
						size="small"
						square
					>
						{{ showAllOtherAccounts ? "Hide" : "Show" }} all accounts
					</Button>
				</Flex>

				<Button
					@click="popupStore.open('new_account')"
					type="secondary"
					size="medium"
					leftIcon="plus-circle"
					leftIconColor="primary"
				>
					New account
				</Button>
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
		box-shadow: inset 0 0 0 1px var(--border-hovered), 0 1px 2px var(--shadow-5);

		& .icons {
			opacity: 1;
		}
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

.icons {
	opacity: 0;

	transition: all 0.2s var(--bezier);
}

.icon_btn {
	transition: all 0.2s var(--bezier);

	&:hover {
		fill: var(--txt-primary);
	}
}
</style>
