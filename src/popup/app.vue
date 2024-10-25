<script setup lang="ts">
import { useAppStore } from "@/stores/app.store"
const store = useAppStore()
</script>

<template>
	<header>popup head</header>

	<div>Balance in popup: {{ store.balance }}</div>

	<RouterView />
</template>
