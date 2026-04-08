<script setup>
/** Utils */
import { isValidHex } from "@/utils/string"

/** Services */
import { FpcServiceClient, FpcType } from "@/wallet/services/fpc/client"
import { TokenBalanceServiceClient } from "@/wallet/services/token-balance/client"

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
	return popupStore.len - popupStore.popups.new_fpc?.order
})

const emit = defineEmits(["onClose"])
const props = defineProps({
	show: Boolean,
})

let fpcService = null
let tokenBalanceService = null
const fpcs = ref([])
const balances = ref([])
const selectedFpcType = ref(null)
const fpcTypes = {
	DefaultFpc: { label: "Token FPC", description: "Pays fees using an ERC-20 token" },
	DefaultSponsoredFpc: { label: "Sponsored FPC", description: "A third party covers your fees" },
}
const isTypeDropdownOpen = ref(false)
const nameTerm = ref("")
const fpcAddressTerm = ref("")

const notAllowedFpcNames = computed(() => fpcs.value.map((n) => n.name))
const isAlreadyExist = computed(() => notAllowedFpcNames.value.includes(nameTerm.value))
const isValidAddress = computed(() => isValidHex(fpcAddressTerm.value))
const isAvailableToAddFpc = computed(() => {
	if (!nameTerm.value.replace(/\s/g, "").length) return
	if (!isValidAddress.value) return
	if (selectedFpcType.value === null) return
	if (isAlreadyExist.value) return

	return true
})

const isLoading = ref(false)
const processingError = ref({
	show: false,
	title: "",
	tooltip: "",
})

const handleAddFpc = async () => {
	if (!isAvailableToAddFpc.value) return

	isLoading.value = true
	try {
		const newFpc = await fpcService.addFpc(appStore.network.id, FpcType[selectedFpcType.value], fpcAddressTerm.value, nameTerm.value)

		if (newFpc.type === FpcType.DefaultFpc) {
			const balanceIdx = balances.value.findIndex((b) => b.token.contract === newFpc.asset)
			if (balanceIdx === -1) {
				cacheStore.confirm.confirm_text = "Yes, add token"
				cacheStore.confirm.confirm_color = "primary"
				cacheStore.confirm.title = "Want to add token along with FPC?"
				cacheStore.confirm.description =
					"Upon confirmation of this action, the token associated with the FPC will be added to your wallet"
				cacheStore.confirm.callback = async () => {
					cacheStore.preselectedTokenAddressToAdd = newFpc.asset
					popupStore.open("new_token")
				}

				popupStore.open("confirm")
			}
		}

		emit("onClose")
		openToast({ label: "FPC is added" })
	} catch (err) {
		processingError.value = {
			show: true,
			title: "Failed to add FPC.",
			tooltip: err,
		}

		openToast({ label: "Something went wrong", icon: "warning" }, TOAST_DURATION.LONG)
	} finally {
		isLoading.value = false
	}
}
const onFpcAdded = (fpc) => {
	fpcs.value.push(fpc)
}
const onFpcUpdated = (fpc) => {
	const idx = fpcs.value.findIndex((f) => f.id === fpc.id)

	if (idx === -1) return
	fpcs.value[idx] = fpc
}
const onFpcDeleted = (fpc) => {
	fpcs.value = fpcs.value.filter((f) => f.id !== fpc.id)
}
const onBalanceAdded = (balance) => {
	balances.value.push(balance)
}
const onBalanceDeleted = (balance) => {
	balances.value = balances.value.filter((b) => b.id !== balance.id)
}
watch(
	() => props.show,
	async () => {
		if (!props.show) {
			fpcService.disconnect()
			fpcService = null
			fpcs.value = []
			tokenBalanceService.disconnect()
			tokenBalanceService = null
			balances.value = []
			selectedFpcType.value = null
			nameTerm.value = ""
			fpcAddressTerm.value = ""

			document.removeEventListener("keydown", onKeydown)
		} else {
			fpcService = new FpcServiceClient()
			fpcService.onFpcAdded.add(onFpcAdded)
			fpcService.onFpcDeleted.add(onFpcDeleted)
			fpcService.onFpcUpdated.add(onFpcUpdated)
			fpcs.value = await fpcService.getFpcs(appStore.network.chainId)

			tokenBalanceService = new TokenBalanceServiceClient()
			tokenBalanceService.onTokenBalanceAdded.add(onBalanceAdded)
			tokenBalanceService.onTokenBalanceDeleted.add(onBalanceDeleted)
			balances.value = await tokenBalanceService.getTokenBalances(undefined, appStore.account.address)

			document.addEventListener("keydown", onKeydown)
		}
	},
)
watch(
	() => [fpcAddressTerm.value, selectedFpcType.value],
	() => {
		processingError.value.show = false
	},
)
const onKeydown = (e) => {
	if (e.key === "Enter") handleAddFpc()
}
</script>

<template>
	<Popup :show @onClose="emit('onClose')" :displaceIdx="popupStore.popups.new_fpc?.order">
		<PopupCard :displaceIdx>
			<PopupHeader @onClose="emit('onClose')" closable>
				<template #title>
					<Text size="14" weight="600" color="primary">New FPC</Text>
				</template>
			</PopupHeader>

			<Flex wide direction="column" gap="24" :class="$style.wrapper">
				<Input
					label="Name"
					placeholder="My fpc"
					autofocus
					sanitize
					:maxLength="25"
					v-model="nameTerm"
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

				<Flex align="center" justify="between" gap="12" wide>
					<Text size="13" weight="600" color="secondary"> FPC Type </Text>

					<Dropdown @onOpen="isTypeDropdownOpen = true" @onClose="isTypeDropdownOpen = false" :disabled="isLoading" :style="{ cursor: 'pointer' }">
						<Flex align="center" gap="6">
							<Text v-if="selectedFpcType" size="13" weight="600" color="primary">
								{{ fpcTypes[selectedFpcType].label }}
							</Text>
							<Text v-else size="12" weight="600" color="red"> Select FPC type </Text>

							<Icon
								name="chevron"
								size="12"
								color="secondary"
								:style="{
									transform: `rotate(${isTypeDropdownOpen ? '180' : '0'}deg)`,
									transition: 'all 0.2s ease'
								}"
							/>
						</Flex>

						<template #popup>
							<DropdownItem
								v-for="(info, type) in fpcTypes"
								@click="selectedFpcType = type"
							>
								<Flex direction="column" gap="2">
									<Text size="13" weight="600" color="primary">
										{{ info.label }}
									</Text>
									<Text size="11" weight="500" color="tertiary">
										{{ info.description }}
									</Text>
								</Flex>
							</DropdownItem>
						</template>
					</Dropdown>
				</Flex>

				<Input
					label="FPC address"
					placeholder="0x15c4ac6afcffdf59aa8a1fb3317ff0c86aee3eb02f9e52c3612e1163d4701446"
					sanitize
					v-model="fpcAddressTerm"
				>
					<template #right>
						<Transition name="fade">
							<Flex v-if="!isValidAddress && fpcAddressTerm" align="center" gap="6">
								<Icon name="warning" size="12" color="red" />
								<Text size="12" weight="600" color="primary"> Invalid FPC address </Text>
							</Flex>
						</Transition>
					</template>
				</Input>

				<Flex direction="column" gap="10">
					<Transition name="fade">
						<Tooltip
							v-if="processingError.show"
							side="top"
							position="start"
							wide
							:disabled="!processingError.tooltip"
							:style="{ marginTop: '-12px' }"
						>
							<Flex align="center" wide>
								<Icon
									name="info"
									size="14"
									:color="processingError.type === 'warning' ? 'orange' : 'red'"
								/>

								<Text size="12" weight="600" color="secondary" :style="{ paddingLeft: '4px' }">
									{{ processingError.title }}
								</Text>
							</Flex>

							<template #content>
								<Text size="12" color="secondary">
									{{ processingError.tooltip }}
								</Text>
							</template>
						</Tooltip>
					</Transition>
					
					<Button
						@click="handleAddFpc"
						wide
						type="primary"
						size="medium"
						:disabled="!isAvailableToAddFpc || processingError.show"
						:loading="isLoading"
						:class="processingError.show && $style.shake"
					>
						Add FPC
					</Button>
				</Flex>
			</Flex>
		</PopupCard>
	</Popup>
</template>

<style module>
.wrapper {
	padding: 0 20px 24px 20px;
}

.shake {
	animation: shake 0.5s ease;
}

@keyframes shake {
	0%,
	100% {
		transform: translateX(0);
	}
	25% {
		transform: translateX(-2px);
	}
	50% {
		transform: translateX(2px);
	}
	75% {
		transform: translateX(-2px);
	}
}
</style>
