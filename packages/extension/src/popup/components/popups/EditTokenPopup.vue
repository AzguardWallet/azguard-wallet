<script setup>
/** Components */
import CandidatesForm from "./NewTokenPopup/CandidatesForm.vue"

/** Services */
import { TokenBalanceServiceClient } from "@/wallet/services/token-balance/client"
import { TokenServiceClient } from "@/wallet/services/token/client"

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
	return popupStore.len - popupStore.popups.edit_token?.order
})

const props = defineProps({
	show: Boolean,
})

const emit = defineEmits(["onClose"])

const isAvailableToUpdateToken = computed(() => {
	return true
})

const rawToken = ref()
const rawTokenForReset = ref()

const tokenService = new TokenServiceClient()
tokenService.onTokenDeleted.add(onTokenDeleted)
function onTokenDeleted(token) {
	if (token.id === cacheStore.tokenToEditIdx) {
		openToast({ label: "Token has been deleted" })

		emit("onClose")
	}
}

const tokenBalanceService = new TokenBalanceServiceClient()

const selectedFields = ref({
	balanceOfPrivateFn: null,
	balanceOfPublicFn: null,
	transferPrivateFn: null,
	transferPublicFn: null,
	transferPrivateToPublicFn: null,
	transferPublicToPrivateFn: null,
	getNameFn: null,
	getSymbolFn: null,
	getDecimalsFn: null,
})
const availableFields = Object.keys(selectedFields.value)
const handleSelectCandidate = (target, candidate) => {
	selectedFields.value[target] = candidate
	rawToken.value[target] = candidate
}
const handleClearCandidate = (target) => {
	delete selectedFields.value[target]
	rawToken.value[target] = null
}
const handleResetChanges = () => {
	rawToken.value = { ...rawTokenForReset.value }

	for (const fieldName of availableFields) {
		if (rawTokenForReset.value[fieldName]) {
			selectedFields.value[fieldName] = rawTokenForReset.value[fieldName]
		} else {
			delete selectedFields.value[fieldName]
		}
	}
}

const error = ref()

const isUpdatingTokenInterface = ref(false)
const handleSaveToken = async () => {
	isUpdatingTokenInterface.value = true

	try {
		await tokenService.updateToken(
			appStore.profile.id,
			appStore.network.id,
			appStore.account.address,
			cacheStore.tokenToEditIdx,
			rawToken.value,
		)
		const tokenBalances = await tokenBalanceService.getTokenBalances(cacheStore.tokenToEditIdx)
		tokenBalances.forEach((tb) => {
			tokenBalanceService.refreshTokenBalance(tb.id)
		})

		openToast({ label: "Token has been updated" })
	} catch (error) {
		error.value = err
		isUpdatingTokenInterface.value = false
	} finally {
		isUpdatingTokenInterface.value = false
	}

	emit("onClose")
}

const isAwaitingTokenInterface = ref(true)
const isErrorOccurred = computed(() => !!error.value)

const handleCopyContractAddress = () => {
	window.navigator.clipboard.writeText(rawToken.value.contract)
	openToast({ label: "Contract address is copied", icon: "copy" })
}

watch(
	() => props.show,
	async () => {
		if (!props.show) {
			rawToken.value = null
			selectedFields.value = {}
			isAwaitingTokenInterface.value = false
			error.value = null
			tokenService.disconnect()
			tokenBalanceService.disconnect()
		} else {
			try {
				isAwaitingTokenInterface.value = true
				const tokenInterface = await tokenService.getTokenInterface(appStore.network.id, cacheStore.tokenToEditIdx)

				rawToken.value = { ...tokenInterface }
				rawTokenForReset.value = { ...tokenInterface }

				for (const fieldName of availableFields) {
					if (rawToken.value[fieldName]) {
						selectedFields.value[fieldName] = rawToken.value[fieldName]
					} else {
						delete selectedFields.value[fieldName]
					}
				}
			} catch (err) {
				error.value = err
				isAwaitingTokenInterface.value = false
			} finally {
				isAwaitingTokenInterface.value = false
			}
		}
	},
)
</script>

<template>
	<Popup :show="show" @onClose="emit('onClose')" :displaceIdx="popupStore.popups.edit_token?.order">
		<PopupCard :displaceIdx>
			<PopupHeader @onClose="emit('onClose')" closable>
				<template #title>
					<Text size="14" weight="600" color="primary">Edit token</Text>
				</template>
			</PopupHeader>

			<Flex wide direction="column" gap="20" :class="$style.wrapper">
				<Button v-if="isAwaitingTokenInterface" type="secondary" size="medium" disabled loading>
					Loading token interface
				</Button>

				<template v-else-if="isErrorOccurred && !isAwaitingTokenInterface">
					<Flex direction="column" gap="16">
						<Tooltip wide>
							<Banner variant="error" wide> Something went wrong </Banner>

							<template #content>
								{{ error }}
							</template>
						</Tooltip>

						<Button @click="emit('onClose')" type="secondary" size="medium" wide>Close</Button>
					</Flex>
				</template>

				<template v-else>
					<ItemsContainer>
						<SettingItem
							size="large"
							:title="`${rawToken.contract.slice(0, 6)}...${rawToken.contract.slice(-4)}`"
							description="Selected token for editing"
							icon="banknote"
							raw
						>
							<template #right>
								<Flex align="center" gap="8">
									<Tooltip position="end" delay="350">
										<Icon
											@click.stop="handleCopyContractAddress"
											name="copy"
											size="14"
											color="tertiary"
											hoverColor="primary"
											:class="$style.icon_btn"
										/>

										<template #content>Copy contract address</template>
									</Tooltip>
								</Flex>
							</template>
						</SettingItem>
					</ItemsContainer>

					<CandidatesForm
						:selectedFields
						@onFieldSelect="handleSelectCandidate"
						@onFieldClear="handleClearCandidate"
						:token="rawToken"
					/>

					<Flex gap="8">
						<Button
							@click="handleResetChanges"
							wide
							type="secondary"
							size="medium"
							:disabled="!Object.keys(selectedFields).length || isUpdatingTokenInterface"
						>
							Reset changes
						</Button>
						<Button
							@click="handleSaveToken"
							wide
							type="primary"
							size="medium"
							:disabled="!isAvailableToUpdateToken || isUpdatingTokenInterface"
							:loading="isUpdatingTokenInterface"
						>
							{{ isUpdatingTokenInterface ? "Updating" : "Update token" }}
						</Button>
					</Flex>
				</template>
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
