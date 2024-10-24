<script setup lang="ts">
const handleTest = () => {
	console.log(123)
}
</script>

<template>
	<div>
		<button @click="handleTest">Test</button>
	</div>
</template>
