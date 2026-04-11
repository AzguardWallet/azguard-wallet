<script setup lang="ts">
import { computed, defineAsyncComponent, onMounted, ref } from "vue"
import { useRoute } from "vue-router"

const route = useRoute()
const setupType = ref<"install" | "update">("install")

onMounted(() => {
	const type = route.params.type as string
	if (type === "install" || type === "update") {
		setupType.value = type
	}
	updateTitle()
})

const updateTitle = () => {
	if (setupType.value === "install") {
		document.title = `${__DISPLAY_NAME__} -> installed!`
	} else if (setupType.value === "update") {
		document.title = `${__DISPLAY_NAME__} -> updated`
	} else {
		document.title = __DISPLAY_NAME__
	}
}

const InstallComponent = defineAsyncComponent(() => import("@/components/install.vue"))
const UpdateComponent = defineAsyncComponent(() => import("@/components/update.vue"))

const targetComponent = computed(() => {
	if (setupType.value === "update") {
		return UpdateComponent
	}
	return InstallComponent
})
</script>

<template>
	<div>
		<component :is="targetComponent" />
	</div>
</template>
