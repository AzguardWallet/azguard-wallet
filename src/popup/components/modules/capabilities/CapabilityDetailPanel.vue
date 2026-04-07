<script setup lang="ts">
/** Composables */
const { openToast } = useToast()

const props = defineProps<{
	capability: any
	granted: boolean
}>()

const copyAddress = (addr: string) => {
	window.navigator.clipboard.writeText(addr)
	openToast({ label: "Address is copied", icon: "copy" })
}

const formatScope = (scope: any): { isWildcard: boolean; patterns: any[] } => {
	if (scope === "*") return { isWildcard: true, patterns: [] }
	if (Array.isArray(scope)) return { isWildcard: false, patterns: scope }
	return { isWildcard: true, patterns: [] }
}
</script>

<template>
	<Flex direction="column" gap="8" :class="[$style.panel, granted && $style.granted]">
		<!-- accounts -->
		<template v-if="capability.type === 'accounts'">
			<Text size="12" weight="600" color="secondary">Permissions:</Text>
			<Flex direction="column" gap="4" :class="$style.detail_list">
				<Flex v-if="capability.canGet !== false" align="center" gap="6">
					<Text size="12" color="tertiary" :class="$style.bullet">&#x2022;</Text>
					<Text size="12" color="secondary">View accounts</Text>
				</Flex>
				<Flex v-if="capability.canCreateAuthWit" align="center" gap="6">
					<Text size="12" color="tertiary" :class="$style.bullet">&#x2022;</Text>
					<Text size="12" color="secondary">Create auth witnesses</Text>
				</Flex>
			</Flex>
		</template>

		<!-- contracts -->
		<template v-else-if="capability.type === 'contracts'">
			<Flex direction="column" gap="4">
				<Text size="12" weight="600" color="secondary">Scope:</Text>
				<Flex v-if="capability.contracts === '*'" align="center" gap="6" :class="$style.detail_list">
					<Text size="12" color="tertiary" :class="$style.bullet">&#x2022;</Text>
					<Text size="12" color="secondary">Any contract</Text>
				</Flex>
				<Flex v-else-if="Array.isArray(capability.contracts)" direction="column" gap="8" :class="$style.detail_list">
					<Flex
						v-for="(addr, ai) in capability.contracts"
						:key="ai"
						align="start"
						gap="6"
					>
						<Text size="12" color="tertiary" :class="$style.bullet">&#x2022;</Text>
						<Text
							@click="copyAddress(String(addr))"
							size="12"
							color="secondary"
							:class="$style.copyable"
						>
							{{ String(addr) }}
						</Text>
					</Flex>
				</Flex>
			</Flex>
			<Flex direction="column" gap="4">
				<Text size="12" weight="600" color="secondary">Permissions:</Text>
				<Flex direction="column" gap="4" :class="$style.detail_list">
					<Flex v-if="capability.canRegister" align="center" gap="6">
						<Text size="12" color="tertiary" :class="$style.bullet">&#x2022;</Text>
						<Text size="12" color="secondary">Register contracts</Text>
					</Flex>
					<Flex v-if="capability.canGetMetadata" align="center" gap="6">
						<Text size="12" color="tertiary" :class="$style.bullet">&#x2022;</Text>
						<Text size="12" color="secondary">Read contract metadata</Text>
					</Flex>
				</Flex>
			</Flex>
		</template>

		<!-- contractClasses -->
		<template v-else-if="capability.type === 'contractClasses'">
			<Flex direction="column" gap="4">
				<Text size="12" weight="600" color="secondary">Scope:</Text>
				<Flex v-if="capability.classes === '*'" align="center" gap="6" :class="$style.detail_list">
					<Text size="12" color="tertiary" :class="$style.bullet">&#x2022;</Text>
					<Text size="12" color="secondary">Any contract class</Text>
				</Flex>
				<Flex v-else-if="Array.isArray(capability.classes)" direction="column" gap="8" :class="$style.detail_list">
					<Flex
						v-for="(cls, ci) in capability.classes"
						:key="ci"
						align="start"
						gap="6"
					>
						<Text size="12" color="tertiary" :class="$style.bullet">&#x2022;</Text>
						<Text
							@click="copyAddress(String(cls))"
							size="12"
							color="secondary"
							:class="$style.copyable"
						>
							{{ String(cls) }}
						</Text>
					</Flex>
				</Flex>
			</Flex>
			<Flex v-if="capability.canGetMetadata" direction="column" gap="4">
				<Text size="12" weight="600" color="secondary">Permissions:</Text>
				<Flex align="center" gap="6" :class="$style.detail_list">
					<Text size="12" color="tertiary" :class="$style.bullet">&#x2022;</Text>
					<Text size="12" color="secondary">Read class metadata</Text>
				</Flex>
			</Flex>
		</template>

		<!-- simulation -->
		<template v-else-if="capability.type === 'simulation'">
			<Flex v-if="capability.transactions" direction="column" gap="4">
				<Text size="12" weight="600" color="secondary">Transaction simulation:</Text>
				<Flex v-if="formatScope(capability.transactions.scope).isWildcard" align="center" gap="6" :class="$style.detail_list">
					<Text size="12" color="tertiary" :class="$style.bullet">&#x2022;</Text>
					<Text size="12" color="secondary">Any contract, any function</Text>
				</Flex>
				<Flex v-else direction="column" gap="10" :class="$style.detail_list">
					<Flex
						v-for="(p, pi) in formatScope(capability.transactions.scope).patterns"
						:key="pi"
						align="start"
						gap="6"
					>
						<Text size="12" color="tertiary" :class="$style.bullet">&#x2022;</Text>
						<Flex direction="column" gap="3">
							<Text
								@click="copyAddress(String(p.contract))"
								size="12"
								color="secondary"
								:class="String(p.contract) !== '*' && $style.copyable"
							>
								{{ String(p.contract) === "*" ? "Any contract" : String(p.contract) }}
							</Text>
							<Text size="11" color="tertiary">
								fn: {{ String(p.function) === "*" ? "any function" : p.function }}
							</Text>
						</Flex>
					</Flex>
				</Flex>
			</Flex>
			<Flex v-if="capability.utilities" direction="column" gap="4">
				<Text size="12" weight="600" color="secondary">Utility simulation:</Text>
				<Flex v-if="formatScope(capability.utilities.scope).isWildcard" align="center" gap="6" :class="$style.detail_list">
					<Text size="12" color="tertiary" :class="$style.bullet">&#x2022;</Text>
					<Text size="12" color="secondary">Any contract, any function</Text>
				</Flex>
				<Flex v-else direction="column" gap="10" :class="$style.detail_list">
					<Flex
						v-for="(p, pi) in formatScope(capability.utilities.scope).patterns"
						:key="pi"
						align="start"
						gap="6"
					>
						<Text size="12" color="tertiary" :class="$style.bullet">&#x2022;</Text>
						<Flex direction="column" gap="3">
							<Text
								@click="copyAddress(String(p.contract))"
								size="12"
								color="secondary"
								:class="String(p.contract) !== '*' && $style.copyable"
							>
								{{ String(p.contract) === "*" ? "Any contract" : String(p.contract) }}
							</Text>
							<Text size="11" color="tertiary">
								fn: {{ String(p.function) === "*" ? "any function" : p.function }}
							</Text>
						</Flex>
					</Flex>
				</Flex>
			</Flex>
			<Text
				v-if="!capability.transactions && !capability.utilities"
				size="12"
				color="tertiary"
			>
				No scopes specified
			</Text>
		</template>

		<!-- transaction -->
		<template v-else-if="capability.type === 'transaction'">
			<Flex direction="column" gap="4">
				<Text size="12" weight="600" color="secondary">Scope:</Text>
				<Flex v-if="formatScope(capability.scope).isWildcard" align="center" gap="6" :class="$style.detail_list">
					<Text size="12" color="tertiary" :class="$style.bullet">&#x2022;</Text>
					<Text size="12" color="secondary">Any contract, any function</Text>
				</Flex>
				<Flex v-else direction="column" gap="10" :class="$style.detail_list">
					<Flex
						v-for="(p, pi) in formatScope(capability.scope).patterns"
						:key="pi"
						align="start"
						gap="6"
					>
						<Text size="12" color="tertiary" :class="$style.bullet">&#x2022;</Text>
						<Flex direction="column" gap="3">
							<Text
								@click="copyAddress(String(p.contract))"
								size="12"
								color="secondary"
								:class="String(p.contract) !== '*' && $style.copyable"
							>
								{{ String(p.contract) === "*" ? "Any contract" : String(p.contract) }}
							</Text>
							<Text size="11" color="tertiary">
								fn: {{ String(p.function) === "*" ? "any function" : p.function }}
							</Text>
						</Flex>
					</Flex>
				</Flex>
			</Flex>
			<Text size="11" color="tertiary" :style="{ lineHeight: '1.3' }">
				Each transaction still requires your approval
			</Text>
		</template>

		<!-- data -->
		<template v-else-if="capability.type === 'data'">
			<Flex direction="column" gap="4" :class="$style.detail_list">
				<Flex v-if="capability.addressBook" align="center" gap="6">
					<Text size="12" color="tertiary" :class="$style.bullet">&#x2022;</Text>
					<Text size="12" color="secondary">Address book access</Text>
				</Flex>
			</Flex>
			<Flex v-if="capability.privateEvents" direction="column" gap="4">
				<Text size="12" weight="600" color="secondary">Private events:</Text>
				<Flex v-if="capability.privateEvents.contracts === '*'" align="center" gap="6" :class="$style.detail_list">
					<Text size="12" color="tertiary" :class="$style.bullet">&#x2022;</Text>
					<Text size="12" color="secondary">Any contract</Text>
				</Flex>
				<Flex v-else-if="Array.isArray(capability.privateEvents.contracts)" direction="column" gap="8" :class="$style.detail_list">
					<Flex
						v-for="(addr, ai) in capability.privateEvents.contracts"
						:key="ai"
						align="start"
						gap="6"
					>
						<Text size="12" color="tertiary" :class="$style.bullet">&#x2022;</Text>
						<Text
							@click="copyAddress(String(addr))"
							size="12"
							color="secondary"
							:class="$style.copyable"
						>
							{{ String(addr) }}
						</Text>
					</Flex>
				</Flex>
			</Flex>
			<Text
				v-if="!capability.addressBook && !capability.privateEvents"
				size="12"
				color="tertiary"
			>
				No scopes specified
			</Text>
		</template>

		<!-- unknown -->
		<template v-else>
			<Text size="12" color="tertiary">No details available</Text>
		</template>
	</Flex>
</template>

<style module>
.panel {
	background: var(--gray-3);
	border-radius: 0 0 8px 8px;
	padding: 10px 12px;
	line-height: 1.5;
}

.granted {
	opacity: 0.7;
}

.detail_list {
	padding-left: 4px;
}

.bullet {
	flex-shrink: 0;
	line-height: 1.5;
}

.copyable {
	cursor: pointer;
	text-decoration: underline;
	text-decoration-style: dotted;
	text-underline-offset: 2px;
	word-break: break-all;
	line-height: 1.5;

	&:hover {
		color: var(--txt-primary);
	}
}
</style>
