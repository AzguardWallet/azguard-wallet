<script setup>
/** Store */
import { usePopupStore } from "@/stores/popup.store"
const popupStore = usePopupStore()

const amountTerm = ref(0)
</script>

<template>
	<Flex direction="column" :class="$style.amount_wrapper">
		<Flex direction="column" gap="16" :class="$style.main">
			<Flex justify="between" gap="12">
				<input
					v-model="amountTerm"
					placeholder="0.00"
					:class="$style.input_field"
				/>

				<Flex
					@click="popupStore.open('select_token')"
					align="center"
					gap="6"
					:class="$style.token_selector"
				>
					<Icon name="aztec" size="20" color="green" />
					<Text size="14" weight="600" color="primary"> AZT </Text>
					<Icon name="chevron" size="14" color="secondary" />
				</Flex>
			</Flex>

			<Flex justify="between" align="end">
				<Text size="12" weight="600" color="body"> $0.00 </Text>

				<Flex align="center" gap="6">
					<Button type="secondary" size="mini" round> Clear </Button>
					<Button type="secondary" size="mini" round> Max </Button>
				</Flex>
			</Flex>
		</Flex>

		<Flex align="center" justify="between" :class="$style.fjc_price">
			<Text size="12" weight="600" color="secondary">
				Estimated Fee Juice
			</Text>
			<Text size="12" weight="600" color="primary">
				<Text color="body">$0.05</Text>&nbsp; ~0.00125 FJC
			</Text>
		</Flex>
	</Flex>
</template>

<style module>
.amount_wrapper {
	width: 100%;

	background: var(--card-bg);
	border-radius: 12px;
	overflow: hidden;
	box-shadow: inset 0 0 0 1px var(--gray-10), 0 1px 2px var(--gray-5);
}

.main {
	border-radius: 12px;

	padding: 16px;
}

.fjc_price {
	background: var(--gray-5);

	padding: 12px;
}

.input_field {
	width: 100%;

	font-size: 28px;
	font-weight: 600;
	color: var(--txt-primary);

	&::placeholder {
		color: var(--txt-tertiary);
	}
}

.token_selector {
	width: fit-content;
	max-height: fit-content;

	background: rgba(20, 174, 92, 15%);
	border-radius: 50px;
	cursor: pointer;

	padding: 4px 6px 4px 4px;

	transition: all 0.2s ease;

	&:hover {
		background: rgba(20, 174, 92, 25%);
	}
}
</style>
