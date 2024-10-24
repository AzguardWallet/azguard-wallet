<script setup lang="ts">
import { useAppStore } from "@/stores/app.store"

const store = useAppStore()

const balance = computed(() => store.balance)
</script>

<template>
	<header>options head</header>

	<RouterView />

	<span>your balance {{ balance }}</span>
</template>
