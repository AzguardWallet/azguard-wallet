<script setup>
/** Components */
import { Dropdown } from "@/components/ui/Dropdown"
import TokenCard from "./TokenCard.vue"

/** Services */
import { ContentKind } from "@/wallet/services/task/spec"
import { TaskServiceClient } from "@/wallet/services/task/client"
import { TokenBalanceServiceClient } from "@/wallet/services/token-balance/client"

import { stringCompare } from "@/utils/string"

/** Store */
import { useAppStore } from "@/stores/app.store"
import { usePopupStore } from "@/stores/popup.store"
const appStore = useAppStore()
const popupStore = usePopupStore()

const router = useRouter()

const tasks = ref([])
const newTokens = computed(() => {
	return tasks.value
		.filter(
			(t) =>
				t.content.kind === ContentKind.TokenMint &&
				t.content.account === appStore.account.address &&
				!tokenBalances.value?.some((tb) => tb.token.name === t.content.name && tb.token.symbol === t.content.symbol) &&
				!t.finishedAt,
		)
		.map((t) => t.content)
		.sort((a, b) => stringCompare(a.name, b.name))
})

const tokenBalances = ref([])
const sortedTokenBalances = computed(() => {
	return tokenBalances.value.sort((a, b) => {
		const tokenA = a.token
		const tokenB = b.token

		return stringCompare(tokenA.name, tokenB.name)
	})
})

const taskService = new TaskServiceClient()
taskService.onTaskCreated.add(onTaskCreated)
taskService.onTaskUpdated.add(onTaskUpdated)
taskService.onTaskDeleted.add(onTaskDeleted)
function onTaskCreated(task) {
	let idx
	switch (task.content.kind) {
		case ContentKind.BalanceUpdate:
			idx = tokenBalances.value.findIndex((tb) => tb.id === task.content.tbId)
			if (idx !== -1) {
				tokenBalances.value[idx].isUpdating = true
			}

			break
		case ContentKind.TokenMint:
			if (task.content.account !== appStore.account?.address) return

			idx = tokenBalances.value.findIndex((tb) => tb.token.name === task.content.name && tb.token.symbol === task.content.symbol)
			if (idx !== -1) {
				tokenBalances.value[idx].isMinting = true
			} else {
				tasks.value.push(task)
			}

			break

		default:
			break
	}
}
function onTaskUpdated(task) {
	let idx
	switch (task.content.kind) {
		case ContentKind.BalanceUpdate:
			if (!task.finishedAt) return

			idx = tokenBalances.value.findIndex((tb) => tb.id === task.content.tbId)
			if (idx !== -1) {
				tokenBalances.value[idx].isUpdating = false
			}

			break
		case ContentKind.TokenMint:
			idx = tasks.value.findIndex((t) => t.id === task.id)
			if (idx !== -1 && task.finishedAt) {
				tasks.value.splice(idx, 1)

				const tbIdx = tokenBalances.value.findIndex(
					(tb) => tb.token.name === task.content.name && tb.token.symbol === task.content.symbol && tb.isMinting,
				)
				if (tbIdx !== -1) {
					tokenBalances.value[tbIdx].isMinting = false
				}
			}

			break
		default:
			break
	}
}
function onTaskDeleted(task) {
	let idx
	switch (task.content.kind) {
		case ContentKind.BalanceUpdate:
			idx = tokenBalances.value.findIndex((tb) => tb.id === task.content.tbId)
			if (idx !== -1) {
				tokenBalances.value[idx].isUpdating = false
			}

			break

		case ContentKind.TokenMint:
			idx = tasks.value.findIndex((t) => t.id === task.id)
			if (idx !== -1) {
				tasks.value.splice(idx, 1)
			}

			break

		default:
			break
	}
}

const tokenBalanceService = new TokenBalanceServiceClient()
tokenBalanceService.onTokenBalanceAdded.add(onBalanceAdded)
tokenBalanceService.onTokenBalanceUpdated.add(onBalanceUpdated)
tokenBalanceService.onTokenBalanceDeleted.add(onBalanceDeleted)
function onBalanceAdded(tb) {
	if (tb.account !== appStore.account.address) return

	tokenBalances.value.push({
		...tb,
		isUpdating: tasks.value.some((t) => t.content.tbId === tb.id && !t.finishedAt),
		isMinting: tasks.value.some((t) => t.content.name === tb.token.name && t.content.symbol === tb.token.symbol && !t.finishedAt),
	})
}
function onBalanceUpdated(tb) {
	const idx = tokenBalances.value.findIndex((_tb) => _tb.id === tb.id)
	if (idx !== -1) {
		tokenBalances.value[idx] = tb
	}
}
function onBalanceDeleted(tb) {
	const idx = tokenBalances.value.findIndex((_tb) => _tb.id === tb.id)
	if (idx !== -1) {
		tokenBalances.value.splice(idx, 1)
	}
}

function refreshBalance(tb) {
	if (tb?.id) {
		tokenBalanceService.refreshTokenBalance(tb.id)
	} else {
		tokenBalances.value.forEach((_tb) => tokenBalanceService.refreshTokenBalance(_tb.id))
	}
}

async function fetchTokenBalances() {
	tokenBalances.value = (await tokenBalanceService.getTokenBalances(undefined, appStore.account?.address)).map((tb) => ({
		...tb,
		isUpdating: tasks.value.some((t) => t.content.tbId === tb.id && !t.finishedAt),
		isMinting: tasks.value.some((t) => t.content.name === tb.token.name && t.content.symbol === tb.token.symbol && !t.finishedAt),
	}))
}

watch(
	() => appStore.account,
	async () => {
		await fetchTokenBalances()
	},
)
onMounted(async () => {
	tasks.value = (await taskService.getTasks()).filter(
		(t) =>
			(t.content.kind === ContentKind.BalanceUpdate || t.content.kind === ContentKind.TokenMint) &&
			t.content.account === appStore.account.address,
	)

	await fetchTokenBalances()
})
onBeforeUnmount(() => {
	taskService.disconnect()
	tokenBalanceService.disconnect()
})
</script>

<template>
	<Flex direction="column" gap="12">
		<Flex align="end" justify="between">
			<Text size="13" weight="600" color="secondary"> Tokens </Text>

			<Flex align="center" gap="6">
				<Dropdown>
					<Button type="secondary" size="micro" data-testid="tokens-menu-trigger">
						<Icon name="dots" size="12" color="secondary" />
					</Button>

					<template #popup>
						<DropdownItem @click="popupStore.open('new_token')" data-testid="tokens-menu-import">
							<Flex align="center" gap="8">
								<Icon name="plus-circle" size="14" color="primary" />
								Import token
							</Flex>
						</DropdownItem>
						<DropdownItem @click="router.push('/popup/settings/general/tokens')" data-testid="tokens-menu-manage">
							<Flex align="center" gap="8">
								<Icon name="settings" size="14" color="primary" />
								Manage tokens
							</Flex>
						</DropdownItem>
						<DropdownDivider />
						<DropdownItem disabled>
							<Flex align="center" gap="8">
								<Icon name="display" size="14" color="primary" />
								Display settings
							</Flex>
						</DropdownItem>
						<DropdownDivider />
						<DropdownItem @click="refreshBalance" data-testid="tokens-menu-refresh">
							<Flex align="center" gap="8">
								<Icon name="refresh" size="14" color="primary" />
								Refresh balances
							</Flex>
						</DropdownItem>
					</template>
				</Dropdown>
			</Flex>
		</Flex>

		<template v-if="newTokens.length">
			<ItemsContainer>
				<TokenCard v-for="t in newTokens" :newToken="t" />
			</ItemsContainer>
		</template>
		<template v-if="sortedTokenBalances.length">
			<ItemsContainer>
				<TokenCard
					v-for="tb in sortedTokenBalances"
					@onRefreshBalance="refreshBalance(tb)"
					:tokenBalance="tb"
				/>
			</ItemsContainer>
		</template>
		<template v-if="!newTokens.length && !sortedTokenBalances.length">
			<Button @click="popupStore.open('new_token')" type="secondary" size="small" leftIcon="plus-circle">
				New token
			</Button>
		</template>
	</Flex>
</template>
