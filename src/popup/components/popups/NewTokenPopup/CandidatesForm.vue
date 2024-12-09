<script setup>
/** Components */
import { Dropdown, DropdownItem } from "@/components/ui/Dropdown"

const emit = defineEmits(["onFieldSelect"])
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
</script>

<template>
	<Flex direction="column" gap="16">
		<!-- BALANCES -> Private / Public -->
		<Flex align="center" justify="between" gap="16">
			<Flex wide direction="column" gap="8" :class="$style.field">
				<Flex align="center" gap="6">
					<Text size="13" weight="600" color="secondary">Balance of private</Text>
					<Icon
						:name="token.balanceOfPrivateFn ? 'check-circle' : 'close-circle'"
						size="12"
						:color="token.balanceOfPrivateFn ? 'green' : 'red'"
					/>
				</Flex>

				<Dropdown wide>
					<template #trigger>
						<DropdownTrigger wide>
							<Text
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

			<Flex wide direction="column" gap="8" :class="$style.field">
				<Flex align="center" gap="6">
					<Text size="13" weight="600" color="secondary">Balance of public</Text>
					<Icon
						:name="token.balanceOfPublicFn ? 'check-circle' : 'close-circle'"
						size="12"
						:color="token.balanceOfPublicFn ? 'green' : 'red'"
					/>
				</Flex>

				<Dropdown wide>
					<template #trigger>
						<DropdownTrigger wide>
							<Text
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

		<!-- TRANFSERS: Private / Public -->
		<Flex align="center" justify="between" gap="16">
			<Flex wide direction="column" gap="8" :class="$style.field">
				<Flex align="center" gap="6">
					<Text size="13" weight="600" color="secondary">Tranfser private</Text>
					<Icon
						:name="token.transferPrivateFn ? 'check-circle' : 'close-circle'"
						size="12"
						:color="token.transferPrivateFn ? 'green' : 'red'"
					/>
				</Flex>

				<Dropdown wide>
					<template #trigger>
						<DropdownTrigger wide>
							<Text
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
				<Flex align="center" gap="6">
					<Text size="13" weight="600" color="secondary">Tranfser public</Text>
					<Icon
						:name="token.transferPublicFn ? 'check-circle' : 'close-circle'"
						size="12"
						:color="token.transferPublicFn ? 'green' : 'red'"
					/>
				</Flex>

				<Dropdown wide>
					<template #trigger>
						<DropdownTrigger wide>
							<Text
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
		</Flex>

		<!-- TRANSFERS: Private to Public / Public to Private -->
		<Flex align="center" justify="between" gap="16">
			<Flex wide direction="column" gap="8" :class="$style.field">
				<Flex align="center" gap="6">
					<Text size="13" weight="600" color="secondary">Private to public</Text>
					<Icon
						:name="token.transferPrivateToPublicFn ? 'check-circle' : 'close-circle'"
						size="12"
						:color="token.transferPrivateToPublicFn ? 'green' : 'red'"
					/>
				</Flex>

				<Dropdown wide>
					<template #trigger>
						<DropdownTrigger wide>
							<Text
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
				<Flex align="center" gap="6">
					<Text size="13" weight="600" color="secondary">Public to private</Text>
					<Icon
						:name="token.transferPublicToPrivateFn ? 'check-circle' : 'close-circle'"
						size="12"
						:color="token.transferPublicToPrivateFn ? 'green' : 'red'"
					/>
				</Flex>

				<Dropdown wide>
					<template #trigger>
						<DropdownTrigger wide>
							<Text
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

		<!-- OTHER -> Name / Symbol -->
		<Flex align="center" justify="between" gap="16">
			<Flex wide direction="column" gap="8" :class="$style.field">
				<Flex align="center" gap="6">
					<Text size="13" weight="600" color="secondary">Get name</Text>
					<Icon
						:name="token.getNameFn ? 'check-circle' : 'close-circle'"
						size="12"
						:color="token.getNameFn ? 'green' : 'red'"
					/>
				</Flex>

				<Dropdown wide>
					<template #trigger>
						<DropdownTrigger wide>
							<Text
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
				<Flex align="center" gap="6">
					<Text size="13" weight="600" color="secondary">Get symbol</Text>
					<Icon
						:name="token.getSymbolFn ? 'check-circle' : 'close-circle'"
						size="12"
						:color="token.getSymbolFn ? 'green' : 'red'"
					/>
				</Flex>

				<Dropdown wide>
					<template #trigger>
						<DropdownTrigger wide>
							<Text
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
		</Flex>

		<Flex wide direction="column" gap="8">
			<Flex align="center" gap="6">
				<Text size="13" weight="600" color="secondary">Get decimals</Text>
				<Icon
					:name="token.getDecimalsFn ? 'check-circle' : 'close-circle'"
					size="12"
					:color="token.getDecimalsFn ? 'green' : 'red'"
				/>
			</Flex>

			<Dropdown wide>
				<template #trigger>
					<DropdownTrigger wide>
						<Text
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
</template>

<style module>
.wrapper {
}

.field {
	flex: 1;

	max-width: 152px;
}
</style>
