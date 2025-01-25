<script setup>
/** Components */
import { Dropdown, DropdownItem, DropdownTitle } from "@/components/ui/Dropdown"

const route = useRoute()
const router = useRouter()

const props = defineProps({
	hideTitle: {
		type: Boolean,
		required: false,
	},
})
</script>

<template>
	<Flex wide align="center" justify="between" :class="$style.wrapper">
		<Button @click="router.go(-1)" type="secondary" size="micro" square>
			<Icon name="arrow-right" size="12" color="secondary" style="transform: rotate(180deg)" />
		</Button>

		<Text v-if="!hideTitle" size="13" weight="600" color="secondary" :class="$style.title">
			{{ route.meta.title }}
		</Text>

		<!-- <Dropdown position="start">
			<Button type="secondary" size="micro" square>
				<Icon name="chevron" size="12" color="secondary" />
			</Button>

			<template #popup>
				<DropdownTitle>Breadcrumbs</DropdownTitle>

				<DropdownItem>Settings</DropdownItem>
				<DropdownItem>Security</DropdownItem>
				<DropdownItem>Backup</DropdownItem>
			</template>
		</Dropdown> -->
	</Flex>
</template>

<style module>
.wrapper {
	position: relative;
}

.title {
	position: absolute;
	left: 50%;
	top: 50%;
	transform: translateX(-50%) translateY(-50%);
}
</style>
