<script setup lang="ts">
const displayName = __DISPLAY_NAME__
const version = __VERSION__
</script>

<template>
	<div>
		<h1>installed page {{ displayName }}</h1>
		<span>Version: {{ version }}</span>
	</div>
</template>
