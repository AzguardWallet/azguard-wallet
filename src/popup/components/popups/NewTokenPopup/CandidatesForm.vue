<script setup>
/** Components */
import { Dropdown, DropdownItem } from "@/components/ui/Dropdown"

const emit = defineEmits(["onFieldSelect", "onFieldClear"])
const props = defineProps({
	token: {
		type: Object,
	},
	selectedFields: {
		type: Object,
	},
})

const handleSelectCandidate = (target, candidate) => {
	emit("onFieldSelect", target, candidate)
}
const handleClearCandidate = target => {
	emit("onFieldClear", target)
}
</script>

<template>
	<Flex direction="column" gap="16">
		<!-- BALANCES -->
		<Flex direction="column" gap="16" :class="$style.section">
			<Text size="12" weight="600" color="secondary" :class="$style.section_title">Fetch Balances</Text>

			<Flex wide direction="column" gap="4" :class="$style.field">
				<Flex align="center" gap="6" :class="$style.title">
					<Text size="12" color="secondary">Private</Text>
					<Icon
						:name="token.balanceOfPrivateFn ? 'check-circle' : 'close-circle'"
						size="12"
						:color="token.balanceOfPrivateFn ? 'green' : 'red'"
					/>
				</Flex>

				<Dropdown wide :disabled="!token.balanceOfPrivateFnCandidates.length">
					<template #trigger>
						<DropdownTrigger
							wide
							clearable
							:value="selectedFields['balanceOfPrivateFn']"
							:disabled="!token.balanceOfPrivateFnCandidates.length"
							@onClear="handleClearCandidate('balanceOfPrivateFn')"
						>
							<Text
								v-if="token.balanceOfPrivateFnCandidates.length"
								size="13"
								weight="600"
								:color="'balanceOfPrivateFn' in selectedFields ? 'primary' : 'secondary'"
							>
								{{
									"balanceOfPrivateFn" in selectedFields
										? selectedFields["balanceOfPrivateFn"]?.name
										: "Select function"
								}}
							</Text>
							<Text v-else size="13" weight="600" color="tertiary">No candidates</Text>
						</DropdownTrigger>
					</template>

					<template #popup>
						<DropdownItem
							v-for="candidate in token.balanceOfPrivateFnCandidates"
							@click="handleSelectCandidate('balanceOfPrivateFn', candidate)"
						>
							{{ candidate.name }}
						</DropdownItem>
					</template>
				</Dropdown>
			</Flex>

			<Flex wide direction="column" gap="4" :class="$style.field">
				<Flex align="center" gap="6" :class="$style.title">
					<Text size="12" color="secondary">Public</Text>
					<Icon
						:name="token.balanceOfPublicFn ? 'check-circle' : 'close-circle'"
						size="12"
						:color="token.balanceOfPublicFn ? 'green' : 'red'"
					/>
				</Flex>

				<Dropdown wide :disabled="!token.balanceOfPublicFnCandidates.length">
					<template #trigger>
						<DropdownTrigger
							wide
							clearable
							:value="selectedFields['balanceOfPublicFn']"
							:disabled="!token.balanceOfPublicFnCandidates.length"
							@onClear="handleClearCandidate('balanceOfPublicFn')"
						>
							<Text
								v-if="token.balanceOfPublicFnCandidates.length"
								size="13"
								weight="600"
								:color="'balanceOfPublicFn' in selectedFields ? 'primary' : 'secondary'"
							>
								{{
									"balanceOfPublicFn" in selectedFields
										? selectedFields["balanceOfPublicFn"]?.name
										: "Select function"
								}}
							</Text>
							<Text v-else size="13" weight="600" color="tertiary">No candidates</Text>
						</DropdownTrigger>
					</template>

					<template #popup>
						<DropdownItem
							v-for="candidate in token.balanceOfPublicFnCandidates"
							@click="handleSelectCandidate('balanceOfPublicFn', candidate)"
						>
							{{ candidate.name }}
						</DropdownItem>
					</template>
				</Dropdown>
			</Flex>
		</Flex>

		<!-- TRANSFERS -->
		<Flex direction="column" gap="16" :class="$style.section">
			<Text size="12" weight="600" color="secondary" :class="$style.section_title">Transfers</Text>

			<Flex wide direction="column" gap="8" :class="$style.field">
				<Flex align="center" gap="6" :class="$style.title">
					<Text size="12" color="secondary">Private</Text>
					<Icon
						:name="token.transferPrivateFn ? 'check-circle' : 'close-circle'"
						size="12"
						:color="token.transferPrivateFn ? 'green' : 'red'"
					/>
				</Flex>

				<Dropdown wide :disabled="!token.transferPrivateFnCandidates.length">
					<template #trigger>
						<DropdownTrigger
							wide
							clearable
							:value="selectedFields['transferPrivateFn']"
							:disabled="!token.transferPrivateFnCandidates.length"
							@onClear="handleClearCandidate('transferPrivateFn')"
						>
							<Text
								v-if="token.transferPrivateFnCandidates.length"
								size="13"
								weight="600"
								:color="'transferPrivateFn' in selectedFields ? 'primary' : 'secondary'"
							>
								{{
									"transferPrivateFn" in selectedFields
										? selectedFields["transferPrivateFn"]?.name
										: "Select function"
								}}
							</Text>
							<Text v-else size="13" weight="600" color="tertiary">No candidates</Text>
						</DropdownTrigger>
					</template>

					<template #popup>
						<DropdownItem
							v-for="candidate in token.transferPrivateFnCandidates"
							@click="handleSelectCandidate('transferPrivateFn', candidate)"
						>
							{{ candidate.name }}
						</DropdownItem>
					</template>
				</Dropdown>
			</Flex>

			<Flex wide direction="column" gap="8" :class="$style.field">
				<Flex align="center" gap="6" :class="$style.title">
					<Text size="12" color="secondary">Public</Text>
					<Icon
						:name="token.transferPublicFn ? 'check-circle' : 'close-circle'"
						size="12"
						:color="token.transferPublicFn ? 'green' : 'red'"
					/>
				</Flex>

				<Dropdown wide :disabled="!token.transferPublicFnCandidates.length">
					<template #trigger>
						<DropdownTrigger
							wide
							clearable
							:value="selectedFields['transferPublicFn']"
							:disabled="!token.transferPublicFnCandidates.length"
							@onClear="handleClearCandidate('transferPublicFn')"
						>
							<Text
								v-if="token.transferPublicFnCandidates.length"
								size="13"
								weight="600"
								:color="'transferPublicFn' in selectedFields ? 'primary' : 'secondary'"
							>
								{{
									"transferPublicFn" in selectedFields
										? selectedFields["transferPublicFn"]?.name
										: "Select function"
								}}
							</Text>
							<Text v-else size="13" weight="600" color="tertiary">No candidates</Text>
						</DropdownTrigger>
					</template>

					<template #popup>
						<DropdownItem
							v-for="candidate in token.transferPublicFnCandidates"
							@click="handleSelectCandidate('transferPublicFn', candidate)"
						>
							{{ candidate.name }}
						</DropdownItem>
					</template>
				</Dropdown>
			</Flex>

			<Flex wide direction="column" gap="8" :class="$style.field">
				<Flex align="center" gap="6" :class="$style.title">
					<Text size="12" color="secondary">Private to Public</Text>
					<Icon
						:name="token.transferPrivateToPublicFn ? 'check-circle' : 'close-circle'"
						size="12"
						:color="token.transferPrivateToPublicFn ? 'green' : 'red'"
					/>
				</Flex>

				<Dropdown wide :disabled="!token.transferPrivateToPublicFnCandidates.length">
					<template #trigger>
						<DropdownTrigger
							wide
							clearable
							:value="selectedFields['transferPrivateToPublicFn']"
							:disabled="!token.transferPrivateToPublicFnCandidates.length"
							@onClear="handleClearCandidate('transferPrivateToPublicFn')"
						>
							<Text
								v-if="token.transferPrivateToPublicFnCandidates.length"
								size="13"
								weight="600"
								:color="'transferPrivateToPublicFn' in selectedFields ? 'primary' : 'secondary'"
							>
								{{
									"transferPrivateToPublicFn" in selectedFields
										? selectedFields["transferPrivateToPublicFn"]?.name
										: "Select function"
								}}
							</Text>
							<Text v-else size="13" weight="600" color="tertiary">No candidates</Text>
						</DropdownTrigger>
					</template>

					<template #popup>
						<DropdownItem
							v-for="candidate in token.transferPrivateToPublicFnCandidates"
							@click="handleSelectCandidate('transferPrivateToPublicFn', candidate)"
						>
							{{ candidate.name }}
						</DropdownItem>
					</template>
				</Dropdown>
			</Flex>

			<Flex wide direction="column" gap="8" :class="$style.field">
				<Flex align="center" gap="6" :class="$style.title">
					<Text size="12" color="secondary">Public to Private</Text>
					<Icon
						:name="token.transferPublicToPrivateFn ? 'check-circle' : 'close-circle'"
						size="12"
						:color="token.transferPublicToPrivateFn ? 'green' : 'red'"
					/>
				</Flex>

				<Dropdown wide :disabled="!token.transferPublicToPrivateFnCandidates.length">
					<template #trigger>
						<DropdownTrigger
							wide
							clearable
							:value="selectedFields['transferPublicToPrivateFn']"
							:disabled="!token.transferPublicToPrivateFnCandidates.length"
							@onClear="handleClearCandidate('transferPublicToPrivateFn')"
						>
							<Text
								v-if="token.transferPublicToPrivateFnCandidates.length"
								size="13"
								weight="600"
								:color="'transferPublicToPrivateFn' in selectedFields ? 'primary' : 'secondary'"
							>
								{{
									"transferPublicToPrivateFn" in selectedFields
										? selectedFields["transferPublicToPrivateFn"]?.name
										: "Select function"
								}}
							</Text>
							<Text v-else size="13" weight="600" color="tertiary">No candidates</Text>
						</DropdownTrigger>
					</template>

					<template #popup>
						<DropdownItem
							v-for="candidate in token.transferPublicToPrivateFnCandidates"
							@click="handleSelectCandidate('transferPublicToPrivateFn', candidate)"
						>
							{{ candidate.name }}
						</DropdownItem>
					</template>
				</Dropdown>
			</Flex>
		</Flex>

		<!-- OTHER -->
		<Flex direction="column" gap="16" :class="$style.section">
			<Text size="12" weight="600" color="secondary" :class="$style.section_title">Metadata</Text>

			<Flex wide direction="column" gap="8" :class="$style.field">
				<Flex align="center" gap="6" :class="$style.title">
					<Text size="12" color="secondary">Get name</Text>
					<Icon
						:name="token.getNameFn ? 'check-circle' : 'close-circle'"
						size="12"
						:color="token.getNameFn ? 'green' : 'red'"
					/>
				</Flex>

				<Dropdown wide :disabled="!token.getNameFnCandidates.length">
					<template #trigger>
						<DropdownTrigger
							wide
							clearable
							:value="selectedFields['getNameFn']"
							:disabled="!token.getNameFnCandidates.length"
							@onClear="handleClearCandidate('getNameFn')"
						>
							<Text
								v-if="token.getNameFnCandidates.length"
								size="13"
								weight="600"
								:color="'getNameFn' in selectedFields ? 'primary' : 'secondary'"
							>
								{{
									"getNameFn" in selectedFields
										? selectedFields["getNameFn"]?.name
										: "Select function"
								}}
							</Text>
							<Text v-else size="13" weight="600" color="tertiary">No candidates</Text>
						</DropdownTrigger>
					</template>

					<template #popup>
						<DropdownItem
							v-for="candidate in token.getNameFnCandidates"
							@click="handleSelectCandidate('getNameFn', candidate)"
						>
							{{ candidate.name }}
						</DropdownItem>
					</template>
				</Dropdown>
			</Flex>

			<Flex wide direction="column" gap="8" :class="$style.field">
				<Flex align="center" gap="6" :class="$style.title">
					<Text size="12" color="secondary">Get symbol</Text>
					<Icon
						:name="token.getSymbolFn ? 'check-circle' : 'close-circle'"
						size="12"
						:color="token.getSymbolFn ? 'green' : 'red'"
					/>
				</Flex>

				<Dropdown wide :disabled="!token.getSymbolFnCandidates.length">
					<template #trigger>
						<DropdownTrigger
							wide
							clearable
							:value="selectedFields['getSymbolFn']"
							:disabled="!token.getSymbolFnCandidates.length"
							@onClear="handleClearCandidate('getSymbolFn')"
						>
							<Text
								v-if="token.getSymbolFnCandidates.length"
								size="13"
								weight="600"
								:color="'getSymbolFn' in selectedFields ? 'primary' : 'secondary'"
							>
								{{
									"getSymbolFn" in selectedFields
										? selectedFields["getSymbolFn"]?.name
										: "Select function"
								}}
							</Text>
							<Text v-else size="13" weight="600" color="tertiary">No candidates</Text>
						</DropdownTrigger>
					</template>

					<template #popup>
						<DropdownItem
							v-for="candidate in token.getSymbolFnCandidates"
							@click="handleSelectCandidate('getSymbolFn', candidate)"
						>
							{{ candidate.name }}
						</DropdownItem>
					</template>
				</Dropdown>
			</Flex>

			<Flex wide direction="column" gap="8">
				<Flex align="center" gap="6" :class="$style.title">
					<Text size="12" color="secondary">Get decimals</Text>
					<Icon
						:name="token.getDecimalsFn ? 'check-circle' : 'close-circle'"
						size="12"
						:color="token.getDecimalsFn ? 'green' : 'red'"
					/>
				</Flex>

				<Dropdown wide :disabled="!token.getDecimalsFnCandidates.length">
					<template #trigger>
						<DropdownTrigger
							wide
							clearable
							:value="selectedFields['getDecimalsFn']"
							:disabled="!token.getDecimalsFnCandidates.length"
							@onClear="handleClearCandidate('getDecimalsFn')"
						>
							<Text
								v-if="token.getDecimalsFnCandidates.length"
								size="13"
								weight="600"
								:color="'getDecimalsFn' in selectedFields ? 'primary' : 'secondary'"
							>
								{{
									"getDecimalsFn" in selectedFields
										? selectedFields["getDecimalsFn"]?.name
										: "Select function"
								}}
							</Text>
							<Text v-else size="13" weight="600" color="tertiary">No candidates</Text>
						</DropdownTrigger>
					</template>

					<template #popup>
						<DropdownItem
							v-for="candidate in token.getDecimalsFnCandidates"
							@click="handleSelectCandidate('getDecimalsFn', candidate)"
						>
							{{ candidate.name }}
						</DropdownItem>
					</template>
				</Dropdown>
			</Flex>
		</Flex>
	</Flex>
</template>

<style module>
.wrapper {
}

.section {
	position: relative;
	padding: 16px 12px 12px 12px;
	/* border: 2px dashed var(--gray-10); */
	border-radius: 8px;
}

.section::before {
	content: "";
	position: absolute;
	inset: 0;
	border-radius: inherit;
	pointer-events: none;
	border: 2px solid var(--gray-10);

	--dash: 6px;
	--gap: 6px;

	mask:
		repeating-linear-gradient(90deg, #000 0 var(--dash), transparent var(--dash) calc(var(--dash) + var(--gap))) top,
		repeating-linear-gradient(180deg, #000 0 var(--dash), transparent var(--dash) calc(var(--dash) + var(--gap))) right,
		repeating-linear-gradient(90deg, #000 0 var(--dash), transparent var(--dash) calc(var(--dash) + var(--gap))) bottom,
		repeating-linear-gradient(180deg, #000 0 var(--dash), transparent var(--dash) calc(var(--dash) + var(--gap))) left;

	mask-size: 100% 2px, 2px 100%, 100% 2px, 2px 100%;
	mask-repeat: repeat-x, repeat-y, repeat-x, repeat-y;

	-webkit-mask:
		repeating-linear-gradient(90deg, #000 0 var(--dash), transparent var(--dash) calc(var(--dash) + var(--gap))) top,
		repeating-linear-gradient(180deg, #000 0 var(--dash), transparent var(--dash) calc(var(--dash) + var(--gap))) right,
		repeating-linear-gradient(90deg, #000 0 var(--dash), transparent var(--dash) calc(var(--dash) + var(--gap))) bottom,
		repeating-linear-gradient(180deg, #000 0 var(--dash), transparent var(--dash) calc(var(--dash) + var(--gap))) left;

	-webkit-mask-size: 100% 2px, 2px 100%, 100% 2px, 2px 100%;
	-webkit-mask-repeat: repeat-x, repeat-y, repeat-x, repeat-y;
}

.section_title {
	position: absolute;
	top: -6px;
	left: 12px;
	background: var(--card-bg);
	padding: 0 6px;
	font-size: 14px;
}

.field {
	/* flex: 1; */

	/* max-width: 152px; */
	.title {
		padding-left: 4px;
	}
}
</style>
