<route lang="json">
{
	"meta": {
		"title": "Manage accounts",
		"isAuthRequired": true
	}
}
</route>

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

const accounts = computed(() => appStore.accounts.filter((a) => a.visible).sort((a, b) => a.index - b.index))
const hiddenAccounts = computed(() => appStore.accounts.filter((a) => !a.visible))

const handleSelectAccount = (acc) => {
	appStore.selectAccount(acc)
}

const handleEditAccount = (target) => {
	cacheStore.accountToEditIdx = target.address
	popupStore.open("edit_account")
}

const handleHideAccount = (acc) => {
	if (accounts.value.length === 1) return

	appStore.changeAccountVisibility(acc, false)
	openToast({ label: "Account successfully hidden" })
}

const handleShowAccount = (acc) => {
	appStore.changeAccountVisibility(acc, true)
	openToast({ label: "Account visible again" })
}

const handleCopyAddress = (target) => {
	window.navigator.clipboard.writeText(target)
	openToast({ label: "Address is copied", icon: "copy" })
}
</script>

<template>
	<Flex direction="column" gap="20" :class="$style.wrapper">
		<Breadcrumbs />

		<Flex direction="column" gap="40">
			<Flex direction="column" gap="16">
				<Text size="13" weight="600" color="primary">
					Accounts &nbsp;<Text color="tertiary">{{ appStore.accounts.length }} </Text>
				</Text>

				<ItemsContainer>
					<SettingItem
						v-for="account in accounts"
						@click="handleSelectAccount(account)"
						size="large"
						:title="account.name"
						:description="`${account.address.slice(0, 6)}...${account.address.slice(-4)}`"
						:icon="account?.address === appStore.account?.address ? 'check-circle' : 'circle'"
						:iconFillColor="account?.address === appStore.account?.address ? 'blue' : 'tertiary'"
						iconBgColor="transparent"
					>
						<template v-if="account.type === AccountType.Azguard_v0_persistent" #titleSuffix>
							<PersistentAccountBadge />
						</template>

						<template #right>
							<Flex align="center" gap="8">
								<Tooltip position="end" delay="350">
									<Icon
										@click.stop="handleCopyAddress(account.address)"
										name="copy"
										size="14"
										color="tertiary"
										hoverColor="primary"
										:class="$style.icon_btn"
									/>

									<template #content>Copy account address</template>
								</Tooltip>

								<Tooltip position="end" delay="350">
									<Icon
										@click.stop="handleEditAccount(account)"
										name="edit"
										size="14"
										color="tertiary"
										:class="$style.icon_btn"
									/>

									<template #content>Edit account</template>
								</Tooltip>

								<Tooltip position="end" delay="350">
									<Icon
										@click.stop="handleHideAccount(account)"
										name="close-circle"
										size="14"
										color="tertiary"
										:class="[$style.icon_btn, accounts.length === 1 && $style.disabled]"
									/>

									<template #content> Hide account </template>
								</Tooltip>
							</Flex>
						</template>
					</SettingItem>
				</ItemsContainer>

				<Button
					@click="popupStore.open('new_account')"
					wide
					type="secondary"
					size="medium"
					leftIcon="plus-circle"
					leftIconColor="primary"
				>
					<Text size="13">New account</Text>
				</Button>
			</Flex>

			<Flex v-if="hiddenAccounts.length" direction="column" gap="12">
				<Flex align="center" justify="between">
					<Text size="13" weight="600" color="body"> Hidden accounts </Text>

					<Text size="13" weight="600" color="secondary">
						{{ hiddenAccounts.length }}
					</Text>
				</Flex>

				<ItemsContainer description="Click on an account you want to make visible">
					<SettingItem
						v-for="account in hiddenAccounts"
						@click="handleShowAccount(account)"
						:title="account.name"
						:description="account.address"
						icon="vault"
					>
						<template v-if="account.type === AccountType.Azguard_v0_persistent" #titleSuffix>
							<PersistentAccountBadge />
						</template>

						<template #right>
							<Icon name="arrow-back-up" size="14" color="secondary" />
						</template>
					</SettingItem>
				</ItemsContainer>
			</Flex>
		</Flex>

		<Navigation />
	</Flex>
</template>

<style module>
.wrapper {
	flex: 1;

	overflow: auto;

	background: var(--card-bg);
	border-top: 2px solid var(--gray-8);
	box-shadow: inset 0 10px 8px -2px var(--gray-3);

	border-top-left-radius: 24px;
	border-top-right-radius: 24px;

	padding: 20px 24px 80px 24px;
}

.icon_btn {
	cursor: pointer;

	transition: all 0.2s var(--bezier);

	&:hover {
		fill: var(--txt-primary);
	}

	&.disabled {
		pointer-events: none;
		opacity: 0.3;
	}
}
</style>
