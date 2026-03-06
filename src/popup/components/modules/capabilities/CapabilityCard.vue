<script setup lang="ts">
/** Types */
import type { UICapability, GridSection } from "./models"

/** Components */
import SubPermissionRow from "./SubPermissionRow.vue"
import DeniableGrid from "./DeniableGrid.vue"

/** Utils */
import { trimAddress } from "@/utils/string"

const props = defineProps<{
	cap: UICapability
	disabled: boolean
}>()

const emit = defineEmits<{
	toggle: []
	deny: [key: string]
	restore: [key: string]
}>()

const expanded = ref(true)

const isDenied = (key: string) => props.cap.denials.has(key)

const toggleSub = (key: string) => {
	if (isDenied(key)) {
		emit("restore", key)
	} else {
		emit("deny", key)
	}
}

/** Derives a string identity from a grid item based on its variant. */
const itemKey = (section: GridSection, item: any): string => {
	switch (section.variant) {
		case "address": return item
		case "account": return item.address
		case "scope-pattern": return `${item.contract}.${item.function}`
	}
}

const sections = computed(() => props.cap.getSections())
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
				<template v-for="(section, si) in sections" :key="si">
					<!-- Boolean sub-permission row -->
					<SubPermissionRow
						v-if="section.type === 'sub'"
						:denied="isDenied(section.key)"
						:label="section.label"
						@toggle="toggleSub(section.key)"
					>
						<Badge
							v-if="section.badge && !isDenied(section.key)"
							variant="purple"
						>
							<Text size="11" weight="600" color="inverse">{{ section.badge }}</Text>
						</Badge>
					</SubPermissionRow>

					<!-- Wildcard indicator -->
					<Flex v-else-if="section.type === 'wildcard'" align="center" gap="6">
						<Text size="13" color="tertiary">{{ section.label }}:</Text>
						<Badge variant="purple">
							<Text size="11" weight="600" color="inverse">Any</Text>
						</Badge>
					</Flex>

					<!-- Item grid -->
					<DeniableGrid
						v-else
						:items="section.items"
						:isActive="(i: number) => !isDenied(`${section.keyPrefix}:${itemKey(section, section.items[i])}`)"
						@toggle="(i: number) => toggleSub(`${section.keyPrefix}:${itemKey(section, section.items[i])}`)"
					>
						<template #item="{ item }">
							<!-- Identifier: contract address, class id, or event source -->
							<template v-if="section.variant === 'address'">
								<Text size="13" color="primary" mono>{{ trimAddress(item, 6, 4) }}</Text>
							</template>

							<!-- Wallet account: name + address -->
							<template v-else-if="section.variant === 'account'">
								<Text size="13" weight="600" color="primary">{{ item.name }}</Text>
								<Text size="13" color="primary" mono>{{ trimAddress(item.address, 6, 4) }}</Text>
							</template>

							<!-- Scope pattern: function + "in" + contract -->
							<template v-else-if="section.variant === 'scope-pattern'">
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
					</DeniableGrid>
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
