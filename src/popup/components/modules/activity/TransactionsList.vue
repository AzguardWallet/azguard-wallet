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

const props = defineProps({
	transactions: {
		type: Array,
	},
})

const handleSelectTx = (target) => {
	cacheStore.activeTxHash = target.hash
	popupStore.open("tx")
}
</script>

<template>
	<Flex direction="column" gap="8">
		<Flex
			v-for="tx in transactions"
			@click="handleSelectTx(tx)"
			wide
			align="center"
			justify="between"
			:class="$style.item"
		>
			<Flex align="center" gap="12">
				<Flex
					align="center"
					justify="center"
					:class="$style.activity_icon"
				>
					<Icon
						:name="
							tx.calls[0].method.startsWith('transfer')
								? 'arrow-narrow-up-right'
								: 'zap'
						"
						size="20"
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
							tx.calls[0].method.startsWith("transfer")
								? "Transfer"
								: "Transaction"
						}}
					</Text>
					<Text size="12" weight="500" color="tertiary">
						{{
							DateTime.fromSeconds(tx.updatedAt / 1_000).toFormat(
								"MMMM dd, yyyy"
							)
						}}
					</Text>
				</Flex>
			</Flex>
		</Flex>
	</Flex>
</template>

<style module>
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
</style>
