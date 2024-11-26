<script setup>
/** Components */
import { Dropdown, DropdownItem } from "@/components/ui/Dropdown"
</script>

<template>
	<Flex direction="column" :class="$style.wrapper">
		<Flex align="center" justify="between" :class="$style.card">
			<Dropdown>
				<template #trigger>
					<Flex align="center" gap="8" class="clickable">
						<Icon name="discount" size="16" color="orange" />
						<Text size="13" weight="600" color="primary">
							Fee Juice
						</Text>
						<Icon name="chevron" size="12" color="secondary" />
					</Flex>
				</template>

				<template #popup>
					<DropdownItem>
						<Flex align="center" gap="8">
							<Icon name="check" size="14" color="primary" />
							Fee Juice
						</Flex>
					</DropdownItem>
				</template>
			</Dropdown>

			<Text size="13" weight="600" color="primary"> 1.52 FJC </Text>
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
.wrapper {
	border-radius: 12px;
	overflow: hidden;
	box-shadow: 0 1px 2px var(--shadow-5);
	border: 1px solid var(--border);
}

.card {
	background: var(--card-bg);
	border-radius: 12px 12px 0 0;

	padding: 12px;
}

.fjc_price {
	background: var(--gray-5);

	padding: 12px;
}
</style>
