<script setup>
/** Store */
import { useAppStore } from "@/stores/app.store"
const appStore = useAppStore()

const props = defineProps({
	transactions: {
		type: Array,
	},
})

console.log(props.transactions[0])
</script>

<template>
	<Flex direction="column" gap="8">
		<Flex
			v-for="tx in transactions"
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
							tx.calls[0].method === 'transfer'
								? 'arrow-top-right-circle'
								: 'wallet'
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
						Transfer
					</Text>
					<Text size="12" weight="500" color="tertiary">
						{{ new Date(tx.updatedAt).toLocaleString() }}
					</Text>
				</Flex>
			</Flex>

			<Text size="12" weight="600" color="primary">
				{{ tx.calls[0].transfers[0].amount / 10 ** 8 }}
			</Text>
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
