<script setup>
/** Components */
import TransactionsList from "../components/modules/activity/TransactionsList.vue"
import Navigation from "../components/Navigation.vue"

/** Store */
import { useAppStore } from "@/stores/app.store"
const appStore = useAppStore()

const router = useRouter()

const transactions = ref([])
const initTransactions = async () => {
	transactions.value = (
		await managers.transaction.getTransactions(appStore.account)
	).filter((t) => t.account === appStore.account.address)

	console.log(transactions.value)
}

onMounted(async () => {
	if (!appStore.isLogined && appStore.isSessionChecked) {
		router.push("/popup/auth")
		return
	}

	if (appStore.isLogined) initTransactions()
})

watch(
	() => appStore.isSessionChecked,
	() => {
		if (!appStore.isLogined && appStore.isSessionChecked) {
			router.push("/popup/auth")
			return
		}
	}
)

watch(
	() => appStore.isLogined,
	() => {
		initTransactions()
	}
)
</script>

<template>
	<Flex
		v-if="appStore.isLogined"
		direction="column"
		gap="20"
		:class="$style.wrapper"
	>
		<Text size="13" weight="600" color="primary"> Today </Text>

		<Flex direction="column" gap="8" :class="$style.list">
			<Flex wide align="center" gap="12" :class="$style.item">
				<Flex
					align="center"
					justify="center"
					:class="$style.activity_icon"
				>
					<Spinner size="16" color="--txt-primary" />

					<Icon
						name="zap-circle"
						size="14"
						color="blue"
						:class="$style.check_icon"
					/>
				</Flex>

				<Flex direction="column" gap="6">
					<Text size="13" weight="600" color="primary">
						Transaction in progress
					</Text>
					<Text size="12" weight="500" color="tertiary">
						Awaiting confirmation
					</Text>
				</Flex>
			</Flex>

			<Flex wide align="center" gap="12" :class="$style.item">
				<Flex
					align="center"
					justify="center"
					:class="$style.activity_icon"
				>
					<Icon name="wallet" size="16" color="primary" />

					<Icon
						name="check-circle"
						size="14"
						color="green"
						:class="$style.check_icon"
					/>
				</Flex>

				<Flex direction="column" gap="6">
					<Text size="13" weight="600" color="primary">
						Wallet created
					</Text>
					<Text size="12" weight="500" color="tertiary">
						{{
							new Date(
								appStore._wallet.created_at
							).toLocaleString()
						}}
					</Text>
				</Flex>
			</Flex>

			<template v-if="!transactions.length">
				<Flex align="center" gap="12" :class="$style.dummy">
					<Flex
						align="center"
						justify="center"
						:class="$style.dummy_circle"
					>
						<div />
					</Flex>

					<Flex direction="column" gap="8">
						<div :class="$style.dummy_title" />
						<div :class="$style.dummy_subtitle" />
					</Flex>
				</Flex>

				<Flex align="center" gap="12" :class="$style.dummy">
					<Flex
						align="center"
						justify="center"
						:class="$style.dummy_circle"
					>
						<div />
					</Flex>

					<Flex direction="column" gap="8">
						<div :class="$style.dummy_title" />
						<div :class="$style.dummy_subtitle" />
					</Flex>
				</Flex>
			</template>

			<TransactionsList :transactions />
		</Flex>

		<Flex
			v-if="!transactions.length"
			direction="column"
			ap
			align="center"
			gap="12"
			:class="$style.empty_banner"
		>
			<Icon name="zap-circle" size="20" color="tertiary" />

			<Flex direction="column" align="center" gap="6">
				<Text size="13" weight="600" color="secondary" align="center">
					Almost empty activity
				</Text>
				<Text
					size="12"
					weight="500"
					height="140"
					color="tertiary"
					align="center"
				>
					Once you start working with your wallet, all activities will
					be displayed here
				</Text>
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

.list {
	margin: -8px;
}

.item {
	cursor: pointer;
	border-radius: 8px;

	padding: 8px;

	transition: all 0.2s var(--bezier);

	&:hover {
		background: var(--gray-3);
	}

	&:active {
		background: var(--gray-5);
	}
}

.activity_icon {
	position: relative;

	width: 32px;
	height: 32px;

	border-radius: 50%;
	background: linear-gradient(var(--gray-8), var(--gray-3));
}

.check_icon {
	position: absolute;
	top: -8px;
	right: -8px;

	box-sizing: content-box;
	border: 3px solid var(--card-bg);
	border-radius: 50%;
}

.dummy {
	padding: 8px;

	&:nth-child(2) {
		opacity: 0.7;
	}

	&:nth-child(3) {
		opacity: 0.5;
	}
}

.dummy_circle {
	width: 32px;
	height: 32px;

	border-radius: 50%;
	background: var(--gray-5);

	& div {
		width: 12px;
		height: 12px;

		border-radius: 50%;
		background: var(--gray-15);
	}
}

.dummy_title {
	width: 120px;
	height: 6px;

	border-radius: 50px;
	background: var(--gray-10);
}

.dummy_subtitle {
	width: 60px;
	height: 6px;

	border-radius: 50px;
	background: var(--gray-5);
}

.empty_banner {
	max-width: 250px;

	margin: 40px auto 0 auto;
}
</style>
