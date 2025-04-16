<script setup>
/** Components */
import Popup from "@/components/ui/Popup/Popup.vue"
import PopupCard from "@/components/ui/Popup/PopupCard.vue"
import PopupHeader from "@/components/ui/Popup/PopupHeader.vue"
import ItemsContainer from "@/components/ui/Settings/ItemsContainer.vue"
import SettingItem from "@/components/ui/Settings/SettingItem.vue"
import CandidatesForm from "./NewTokenPopup/CandidatesForm.vue"

/** Utils */
import { managers } from "@/utils/core"

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
const handleClearCandidate = target => {
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
		const updatedToken = await managers.token.updateToken(cacheStore.tokenToEditIdx, rawToken.value)

		const updatedTokenIdx = appStore.tokens.findLastIndex(t => t.id == cacheStore.tokenToEditIdx)
		appStore.tokens[updatedTokenIdx] = updatedToken

		await appStore.syncBalances()

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
watch(
	() => props.show,
	async () => {
		if (!props.show) {
			rawToken.value = null
			selectedFields.value = {}
			isAwaitingTokenInterface.value = false
			error.value = null
		} else {
			try {
				isAwaitingTokenInterface.value = true
				const tokenInterface = await managers.token.getInterface(cacheStore.tokenToEditIdx)

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

const handleCopyContractAddress = () => {
	window.navigator.clipboard.writeText(rawToken.value.contract)
	openToast({ label: "Contract address is copied", icon: "copy" })
}
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
