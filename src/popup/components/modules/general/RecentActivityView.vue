<script setup>
/** Vendor */
import { DateTime } from "luxon"

/** Store */
import { useAppStore } from "@/stores/app.store"
import { useCacheStore } from "@/stores/cache.store"
import { usePopupStore } from "@/stores/popup.store"
const appStore = useAppStore()
const cacheStore = useCacheStore()
const popupStore = usePopupStore()

const router = useRouter()

const latestTransaction = computed(() => appStore.transactions[0])

const handleSelectTx = () => {
	cacheStore.activeTxHash = latestTransaction.value.hash
	popupStore.open("tx")
}
</script>

<template>
	<Flex direction="column" gap="16" :class="$style.wrapper">
		<Flex align="center" justify="between">
			<Text size="13" weight="600" color="secondary">
				Latest activity
			</Text>
			<Text
				@click="router.push('/popup/activity')"
				size="12"
				weight="600"
				color="tertiary"
				:class="['clickable', $style.txt_button]"
			>
				View all
			</Text>
		</Flex>

		<div :class="$style.list">
			<Flex
				v-if="!appStore.isAwaitingTransaction"
				@click="handleSelectTx"
				align="center"
				gap="12"
				:class="$style.item"
			>
				<Flex
					align="center"
					justify="center"
					:class="$style.activity_icon"
				>
					<Icon
						:name="
							latestTransaction.calls[0].method.startsWith(
								'transfer'
							)
								? 'arrow-narrow-up-right'
								: 'zap'
						"
						size="16"
						color="primary"
					/>

					<Icon
						name="check-circle"
						size="14"
						color="green"
						:class="$style.check_icon"
					/>
				</Flex>

				<Flex direction="column" gap="6">
					<Text size="13" weight="600" color="primary">
						{{
							latestTransaction.calls[0].method.startsWith(
								"transfer"
							)
								? "Transfer"
								: "Transaction"
						}}
					</Text>
					<Text size="12" weight="500" color="tertiary">
						{{
							DateTime.fromSeconds(
								latestTransaction.updatedAt / 1_000
							).toFormat("MMMM dd, yyyy")
						}}
					</Text>
				</Flex>
			</Flex>
			<Flex v-else wide align="center" gap="12" :class="$style.item">
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
		</div>
	</Flex>
</template>

<style module>
.wrapper {
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

.check_icon {
	position: absolute;
	top: -8px;
	right: -8px;

	box-sizing: content-box;
	border: 3px solid var(--card-bg);
	border-radius: 50%;
}

.txt_button {
	transition: all 0.2s var(--bezier);

	&:hover {
		color: var(--txt-secondary);
	}
}
</style>
