<script setup lang="ts">
const version = __VERSION__
const displayName = __DISPLAY_NAME__
</script>

<template>
	<div>
		<h1>Hello World</h1>

		<p>test version from package.json: {{ version }}</p>
		<p>dn: {{ displayName }}</p>

		<RouterLink class="underline" to="/common/about"> About </RouterLink>
	</div>
</template>
