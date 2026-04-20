<script setup>
/** Components */
import CandidatesForm from "./CandidatesForm.vue"

/** Services */
import { TokenBalanceServiceClient } from "@/wallet/services/token-balance/client"
import { TokenServiceClient } from "@/wallet/services/token/client"

/** Utils */
import { isValidHex } from "@/utils/string"

/** Composables */
import { useToast } from "@/composables/toast"
const { openToast } = useToast()

/** Store */
import { useAppStore } from "@/stores/app.store"
import { useCacheStore } from "@/stores/cache.store"
import { usePopupStore } from "@/stores/popup.store"
const appStore = useAppStore()
const cacheStore = useCacheStore()
const popupStore = usePopupStore()

const displaceIdx = computed(() => {
	return popupStore.len - popupStore.popups.new_token?.order
})

const props = defineProps({
	show: Boolean,
})

const emit = defineEmits(["onClose"])

const tokenService = new TokenServiceClient()
tokenService.onTokenAdded.add(onTokenAdded)
tokenService.onTokenDeleted.add(onTokenDeleted)
function onTokenAdded(token) {
	tokens.value.push(token)
}
function onTokenDeleted(token) {
	const idx = tokens.value.findIndex((t) => t.id === token.id)
	if (idx === -1) return

	tokens.value.splice(idx, 1)
}

const tokenBalanceService = new TokenBalanceServiceClient()

const contractAddressTerm = ref("")

const isLoadingParseResult = ref(false)
const isAddingNewToken = ref(false)

const tokens = ref([])
const isAlreadyExist = computed(() => tokens.value?.findLast((t) => t.contract === contractAddressTerm.value))
const isAvailableToCreateToken = computed(() => {
	if (!isValidHex(contractAddressTerm.value)) return
	if (isAlreadyExist.value) return

	return true
})

const isCompleted = ref(true)
const rawToken = ref()
const rawTokenForReset = ref()
const selectedFields = ref({})
const availableFields = [
	"balanceOfPrivateFn",
	"balanceOfPublicFn",
	"transferPrivateFn",
	"transferPublicFn",
	"transferPrivateToPublicFn",
	"transferPublicToPrivateFn",
	"getNameFn",
	"getSymbolFn",
	"getDecimalsFn",
]
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
	selectedFields.value = {}
}

const error = ref()
const isErrorOccurred = computed(() => !!error.value)

const handleCreateToken = async () => {
	if (!isAvailableToCreateToken.value) return

	isLoadingParseResult.value = true

	try {
		const parsingResult = await tokenService.parseTokenInterface(appStore.network.id, contractAddressTerm.value)

		if (!parsingResult.isComplete) {
			isLoadingParseResult.value = false

			isCompleted.value = false
			rawToken.value = { ...parsingResult }
			rawTokenForReset.value = { ...parsingResult }

			for (const fieldName of availableFields) {
				if (rawToken.value[fieldName]) {
					selectedFields.value[fieldName] = rawToken.value[fieldName]
				}
			}

			return
		}

		isAddingNewToken.value = true
		isLoadingParseResult.value = false

		if (!parsingResult.isComplete) {
			openToast({ label: "Something went wrong", icon: "close-circle" }, TOAST_DURATION.LONG)
			return
		}

		const newToken = await tokenService.addToken(appStore.profile.id, appStore.network.id, appStore.account.address, parsingResult)
		isAddingNewToken.value = false

		const tokenBalances = await tokenBalanceService.getTokenBalances(newToken?.id)
		tokenBalances.forEach((tb) => {
			tokenBalanceService.refreshTokenBalance(tb.id)
		})

		openToast({ label: "New token has been added" })

		emit("onClose")
	} catch (err) {
		error.value = err

		isAddingNewToken.value = false
		isLoadingParseResult.value = false
	}
}

const isSavingToken = ref(false)
const handleSaveToken = async () => {
	isSavingToken.value = true

	try {
		const newToken = await tokenService.addToken(appStore.profile.id, appStore.network.id, appStore.account.address, rawToken.value)

		const tokenBalances = await tokenBalanceService.getTokenBalances(newToken?.id)
		tokenBalances.forEach((tb) => {
			tokenBalanceService.refreshTokenBalance(tb.id)
		})

		openToast({ label: "New token has been added" })
	} catch (err) {
		error.value = err
	} finally {
		isSavingToken.value = false
	}

	cacheStore.preselectedTokenAddressToAdd = ""
	emit("onClose")
}

watch(
	() => props.show,
	async () => {
		if (!props.show) {
			contractAddressTerm.value = ""
			isCompleted.value = true
			selectedFields.value = {}
			error.value = null
			tokenBalanceService.disconnect()
			tokenService.disconnect()
		} else {
			tokens.value = await tokenService.getTokens(appStore.profile.id, appStore.network.chainId)

			if (cacheStore.preselectedTokenAddressToAdd) {
				contractAddressTerm.value = cacheStore.preselectedTokenAddressToAdd
			}
		}
	},
)
</script>

<template>
	<Popup :show="show" @onClose="emit('onClose')" :displaceIdx="popupStore.popups.new_token?.order">
		<PopupCard :displaceIdx>
			<PopupHeader @onClose="emit('onClose')" closable>
				<template #title>
					<Text size="14" weight="600" color="primary">New token</Text>
				</template>
			</PopupHeader>

			<Flex wide direction="column" gap="20" :class="$style.wrapper">
				<Input
					v-model="contractAddressTerm"
					@click="error = null"
					label="Contract address"
					placeholder="0x"
					data-testid="token-address-input"
					autofocus
					sanitize
					:disabled="isLoadingParseResult || !isCompleted || isAddingNewToken"
				>
					<template #suffix>
						<Icon v-if="isAvailableToCreateToken" name="check-circle" size="14" color="green" />
					</template>
					<template #right>
						<Transition name="fade">
							<Flex v-if="isAlreadyExist" align="center" gap="4">
								<Icon name="warning" size="12" color="orange" />
								<Text size="12" weight="600" color="primary"> Already exist </Text>
							</Flex>
							<Flex v-else-if="contractAddressTerm && !isValidHex(contractAddressTerm)" align="center" gap="4">
								<Icon name="close-circle" size="12" color="red" />
								<Text size="12" weight="600" color="primary"> Invalid address </Text>
							</Flex>
						</Transition>
					</template>
				</Input>

				<CandidatesForm
					v-if="!isCompleted"
					:selectedFields
					@onFieldSelect="handleSelectCandidate"
					@onFieldClear="handleClearCandidate"
					:token="rawToken"
				/>

				<Flex direction="column" align="center" gap="12">
					<Button
						v-if="isCompleted"
						@click="handleCreateToken"
						wide
						:type="isLoadingParseResult || isAddingNewToken ? 'secondary' : 'primary'"
						size="medium"
						data-testid="import-token-button"
						:loading="isLoadingParseResult || isAddingNewToken"
						:disabled="!isAvailableToCreateToken || isLoadingParseResult || isAddingNewToken"
					>
						{{
							(isLoadingParseResult && "LOADING TOKEN") ||
							(isAddingNewToken && "ADDING TOKEN") ||
							"Import new token"
						}}
					</Button>
					<Button
						v-else
						@click="handleSaveToken"
						wide
						type="primary"
						size="medium"
						:loading="isSavingToken"
						:disabled="!isAvailableToCreateToken"
					>
						{{ isSavingToken ? "SAVING" : "Save new token" }}
					</Button>
					<Button
						v-if="!isCompleted"
						@click="handleResetChanges"
						wide
						type="primary_outline"
						size="medium"
						:disabled="!Object.keys(selectedFields).length"
					>
						Reset changes
					</Button>

					<Tooltip v-if="isErrorOccurred" side="top">
						<Flex align="center" gap="6">
							<Icon name="info" size="12" color="red" />
							<Text size="12" weight="500" color="secondary">
								Error occurred while importing a new token
							</Text>
						</Flex>

						<template #content> {{ error }} </template>
					</Tooltip>
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
</style>
