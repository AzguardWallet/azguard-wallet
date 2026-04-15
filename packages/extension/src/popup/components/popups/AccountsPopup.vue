<script setup>
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
	return popupStore.len - popupStore.popups.accounts?.order
})

const emit = defineEmits(["onClose"])

const account = computed(() => appStore.account)

const showAllOtherAccounts = ref(false)
const accounts = computed(() => {
	return appStore.accounts.filter((a) => a.visible).sort((a, b) => a.index - b.index)
})

const handleSelectAccount = (acc) => {
	appStore.selectAccount(acc)

	emit("onClose")
}

const isCopied = ref(false)
const handleCopyAddress = (target) => {
	isCopied.value = true

	window.navigator.clipboard.writeText(target)
	openToast({ label: "Address is copied", icon: "copy" })

	setTimeout(() => {
		isCopied.value = false
	}, 1_500)
}

const handleManageAccounts = () => {
	router.push("/popup/settings/general/accounts")
	emit("onClose")
}
</script>

<template>
	<Popup @onClose="emit('onClose')" :displaceIdx="popupStore.popups.accounts?.order">
		<PopupCard :displaceIdx>
			<PopupHeader @onClose="emit('onClose')" closable>
				<template #title>
					<Text size="14" weight="600" color="primary">Switch account</Text>
				</template>
			</PopupHeader>

			<Flex wide direction="column" gap="24" :class="$style.wrapper">
				<ItemsContainer>
					<SettingItem
						v-for="acc in accounts"
						@click="handleSelectAccount(acc)"
						size="large"
						:title="acc.name"
						:description="`${acc.address.slice(0, 6)}...${acc.address.slice(-4)}`"
						:icon="account.address === acc.address ? 'check-circle' : 'circle'"
						:iconFillColor="account.address === acc.address ? 'blue' : 'tertiary'"
						iconBgColor="transparent"
						data-testid="account-item"
					>
						<template v-if="acc.type === AccountType.Nulo_v0_persistent" #titleSuffix>
							<PersistentAccountBadge />
						</template>

						<template #right>
							<Flex align="center" gap="8">
								<Tooltip position="end" delay="350">
									<Icon
										@click.stop="handleCopyAddress(acc.address)"
										name="copy"
										size="14"
										color="tertiary"
										hoverColor="primary"
										:class="$style.icon_btn"
									/>

									<template #content>Copy account address</template>
								</Tooltip>
							</Flex>
						</template>
					</SettingItem>
				</ItemsContainer>

				<ItemsContainer>
					<SettingItem
						@click="handleManageAccounts"
						title="Manage accounts"
						size="small"
						icon="settings"
						iconFillColor="secondary"
						iconBgColor="transparent"
						chevron
					/>
					<SettingItem
						@click="popupStore.open('new_account')"
						title="New account"
						size="small"
						icon="plus-circle"
						iconFillColor="secondary"
						iconBgColor="transparent"
						chevron
					/>
				</ItemsContainer>
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
