<script setup>
/** Components */
import { Dropdown, DropdownItem } from "@/components/ui/Dropdown"

const emit = defineEmits(["onSelect"])
const props = defineProps({
	token: {
		type: Object,
	},
})

const selectedFields = ref([])
const handleSelectCandidate = (target, candidate) => {
	selectedFields.value.push(target)
	emit("onSelect", target, candidate)
}
</script>

<template>
	<Flex direction="column" gap="16">
		<Banner>
			You must fill in the fields below to save the imported token
			<Text color="tertiary">- {{ token.name }} ({{ token.symbol }})</Text></Banner
		>

		<!-- BALANCES -> Private / Public -->
		<Flex align="center" justify="between" gap="16">
			<Flex wide direction="column" gap="8">
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
							<Icon
								name="key-square"
								size="14"
								:color="selectedFields.includes('balanceOfPrivateFn') ? 'primary' : 'tertiary'"
							/>
							<Text
								size="13"
								weight="600"
								:color="selectedFields.includes('balanceOfPrivateFn') ? 'primary' : 'secondary'"
								style="text-transform: capitalize"
							>
								{{ selectedFields.includes("balanceOfPrivateFn") ? "Selected" : "Select fn" }}
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

			<Flex wide direction="column" gap="8">
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
							<Icon
								name="face"
								size="14"
								:color="selectedFields.includes('balanceOfPublicFn') ? 'primary' : 'tertiary'"
							/>
							<Text
								size="13"
								weight="600"
								:color="selectedFields.includes('balanceOfPublicFn') ? 'primary' : 'secondary'"
								style="text-transform: capitalize"
							>
								{{ selectedFields.includes("balanceOfPublicFn") ? "Selected" : "Select fn" }}
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
			<Flex wide direction="column" gap="8">
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
							<Icon
								name="key-square"
								size="14"
								:color="selectedFields.includes('transferPrivateFn') ? 'primary' : 'tertiary'"
							/>
							<Text
								size="13"
								weight="600"
								:color="selectedFields.includes('transferPrivateFn') ? 'primary' : 'secondary'"
								style="text-transform: capitalize"
							>
								{{ selectedFields.includes("transferPrivateFn") ? "Selected" : "Select fn" }}
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

			<Flex wide direction="column" gap="8">
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
							<Icon
								name="face"
								size="14"
								:color="selectedFields.includes('transferPublicFn') ? 'primary' : 'tertiary'"
							/>
							<Text
								size="13"
								weight="600"
								:color="selectedFields.includes('transferPublicFn') ? 'primary' : 'secondary'"
								style="text-transform: capitalize"
							>
								{{ selectedFields.includes("transferPublicFn") ? "Selected" : "Select fn" }}
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
			<Flex wide direction="column" gap="8">
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
							<Icon
								name="key-square"
								size="14"
								:color="selectedFields.includes('transferPrivateToPublicFn') ? 'primary' : 'tertiary'"
							/>
							<Text
								size="13"
								weight="600"
								:color="selectedFields.includes('transferPrivateToPublicFn') ? 'primary' : 'secondary'"
								style="text-transform: capitalize"
							>
								{{ selectedFields.includes("transferPrivateToPublicFn") ? "Selected" : "Select fn" }}
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

			<Flex wide direction="column" gap="8">
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
							<Icon
								name="face"
								size="14"
								:color="selectedFields.includes('transferPublicToPrivateFn') ? 'primary' : 'tertiary'"
							/>
							<Text
								size="13"
								weight="600"
								:color="selectedFields.includes('transferPublicToPrivateFn') ? 'primary' : 'secondary'"
								style="text-transform: capitalize"
							>
								{{ selectedFields.includes("transferPublicToPrivateFn") ? "Selected" : "Select fn" }}
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
			<Flex wide direction="column" gap="8">
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
							<Icon
								name="text"
								size="14"
								:color="selectedFields.includes('getNameFn') ? 'primary' : 'tertiary'"
							/>
							<Text
								size="13"
								weight="600"
								:color="selectedFields.includes('getNameFn') ? 'primary' : 'secondary'"
								style="text-transform: capitalize"
							>
								{{ selectedFields.includes("getNameFn") ? "Selected" : "Select fn" }}
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

			<Flex wide direction="column" gap="8">
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
							<Icon
								name="banknote"
								size="14"
								:color="selectedFields.includes('getSymbolFn') ? 'primary' : 'tertiary'"
							/>
							<Text
								size="13"
								weight="600"
								:color="selectedFields.includes('getSymbolFn') ? 'primary' : 'secondary'"
								style="text-transform: capitalize"
							>
								{{ selectedFields.includes("getSymbolFn") ? "Selected" : "Select fn" }}
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
	</Flex>
</template>

<style module>
.wrapper {
}
</style>
