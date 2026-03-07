<script setup lang="ts">
/** Types */
import type { UICapability, Feature, Grid } from "./models"

/** Components */
import SwitchRow from "./SwitchRow.vue"
import ItemsGrid from "./ItemsGrid.vue"

/** Utils */
import { trimAddress } from "@/utils/string"
import { gridItemKey } from "./models"

const props = defineProps<{
	cap: UICapability
	disabled: boolean
}>()

const emit = defineEmits<{
	toggle: []
	exclude: [key: string]
	include: [key: string]
}>()

const expanded = ref(true)

const isExcluded = (key: string) => props.cap.exclusions.has(key)

const toggleItem = (key: string) => {
	if (isExcluded(key)) {
		emit("include", key)
	} else {
		emit("exclude", key)
	}
}

const itemKey = (f: Feature, i: number): string => {
	return gridItemKey(f.items as Grid, i)
}
</script>

<template>
	<Flex
		direction="column"
		gap="4"
		:class="[$style.card, disabled && $style.disabled, !cap.selected && $style.deselected]"
	>
		<!-- Header -->
		<Flex align="center" gap="8" :class="$style.header" @click="expanded = !expanded">
			<Flex align="center" :class="$style.check_area" @click.stop="$emit('toggle')">
				<Icon
					:name="cap.selected ? 'check-circle' : 'circle'"
					size="16"
					:color="cap.selected ? 'green' : 'secondary'"
				/>
			</Flex>
			<Text size="14" weight="600" color="primary" :class="$style.card_label">{{ cap.label }}</Text>
			<Icon name="chevron" size="18" color="tertiary" :rotate="expanded ? 0 : 90" />
		</Flex>

		<!-- Detail area -->
		<div :class="[$style.detail_wrapper, expanded && $style.detail_expanded]">
			<Flex direction="column" gap="8" :class="$style.detail_content">
				<template v-for="(feature, fi) in cap.features" :key="fi">
					<!-- Boolean switch rows -->
					<SwitchRow
						v-for="s in feature.switches"
						:key="s.key"
						:excluded="isExcluded(s.key)"
						:label="s.label"
						@toggle="toggleItem(s.key)"
					>
						<Badge
							v-if="s.badge && !isExcluded(s.key)"
							variant="purple"
						>
							<Text size="11" weight="600" color="inverse">{{ s.badge }}</Text>
						</Badge>
					</SwitchRow>

					<!-- Wildcard indicator -->
					<Flex v-if="feature.items?.kind === 'wildcard'" align="center" gap="6">
						<Text size="13" color="tertiary">{{ feature.items.label }}:</Text>
						<Badge variant="purple">
							<Text size="11" weight="600" color="inverse">Any</Text>
						</Badge>
					</Flex>

					<!-- Item grid -->
					<ItemsGrid
						v-else-if="feature.items?.kind === 'grid' && feature.items.items.length > 0"
						:items="feature.items.items"
						:isActive="(i: number) => !isExcluded(itemKey(feature, i))"
						@toggle="(i: number) => toggleItem(itemKey(feature, i))"
					>
						<template #item="{ item }">
							<!-- Identifier: contract address, class id, or event source -->
							<template v-if="feature.items.variant === 'address'">
								<Text size="13" color="primary" mono>{{ trimAddress(item, 6, 4) }}</Text>
							</template>

							<!-- Wallet account: name + address -->
							<template v-else-if="feature.items.variant === 'account'">
								<Text size="13" weight="600" color="primary">{{ item.name }}</Text>
								<Text size="13" color="primary" mono>{{ trimAddress(item.address, 6, 4) }}</Text>
							</template>

							<!-- Scope pattern: function + "in" + contract -->
							<template v-else-if="feature.items.variant === 'scope-pattern'">
								<template v-if="item.function === '*'">
									<Flex align="center" gap="4">
										<Badge variant="purple" :class="$style.inline_badge">
											<Text size="10" weight="600" color="inverse">any</Text>
										</Badge>
										<Text size="13" color="primary">method</Text>
									</Flex>
								</template>
								<Text v-else size="13" weight="600" color="primary">{{ item.function }}</Text>
								<Flex align="center" gap="4">
									<Text size="12" color="tertiary">in</Text>
									<template v-if="item.contract === '*'">
										<Badge variant="purple" :class="$style.inline_badge">
											<Text size="10" weight="600" color="inverse">any</Text>
										</Badge>
										<Text size="12" color="secondary">contract</Text>
									</template>
									<Text v-else size="13" color="primary" mono>{{ trimAddress(item.contract, 6, 4) }}</Text>
								</Flex>
							</template>
						</template>
					</ItemsGrid>
				</template>
			</Flex>
		</div>
	</Flex>
</template>

<style module>
.card {
	width: 100%;
	border-radius: 12px;
	box-shadow: inset 0 0 0 1px var(--gray-10), 0 1px 2px var(--gray-5);
	padding: 12px;
	transition: all 0.2s var(--bezier);

	&:hover {
		background: var(--gray-3);
	}
}

.deselected {
	opacity: 0.5;
}

.disabled {
	cursor: default;
	pointer-events: none;
}

.header {
	cursor: pointer;
}

.check_area {
	cursor: pointer;
	flex-shrink: 0;
	padding: 4px;
	margin: -4px;
	border-radius: 6px;
}

.card_label {
	flex: 1;
}

.detail_wrapper {
	max-height: 0;
	overflow: hidden;
	transition: max-height 0.25s var(--bezier);
}

.detail_expanded {
	max-height: 500px;
}

.detail_content {
	padding-top: 8px;
	margin-top: 8px;
	padding-left: 24px;
	border-top: 1px solid var(--gray-10);
}

.inline_badge {
	margin-top: -2.5px;
}
</style>
