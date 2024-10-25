<script setup lang="ts">
import { useAppStore } from "@/stores/app.store"
const store = useAppStore()

const balance = computed(() => store.balance)
</script>

<template>
	<header>options head</header>

	<RouterView />

	<div>your balance {{ balance }}</div>

	<button @click="store.balance += 1">Add +1 to balance</button>
</template>
