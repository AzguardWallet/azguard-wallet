<script setup lang="ts">
import { ProfileManager } from '@/wallet/profiles';

(async function f() {
	const pm = new ProfileManager();
	
	console.log('*********************************************************************************');
	
	// если висит активная сессия, мы ее "продолжаем"
	console.log('session storage:', await chrome.storage.session.get());
	let activeProfile = await pm.getActiveProfile();
	console.log('active profile:', activeProfile);

	console.log('================');

	// если активной сессии нет, или она устарела, мы пытаемся показать список доступных профилей
	console.log('local storage:', await chrome.storage.local.get());
	let profiles = await pm.getProfiles();
	console.log('profiles:', profiles);

	console.log('================');

	// если доступных профилей нет, мы предлагаем создать
	let p = await pm.createProfile('Default Profile', 'qwerty');
	console.log('created:', p);
	console.log('local storage:', await chrome.storage.local.get());
	// автоматом создается сессия
	console.log('session storage:', await chrome.storage.session.get());

	console.log('================');
	
	// если же профили есть, мы предлагаем войти
	p = (await pm.signInProfile(p.id, 'qwerty'))!;
	console.log('signed in:', p);
	console.log('local storage:', await chrome.storage.local.get());
	// автоматом создается сессия
	console.log('session storage:', await chrome.storage.session.get());

	console.log('================');

	// при следующем входе уже будет доступна активная сессия
	activeProfile = await pm.getActiveProfile();
	console.log('active profile:', activeProfile);

	console.log('================');

	// если юзер выходит из профиля
	await pm.signOut();
	console.log('signed out');

	console.log('================');
	
	// сессия закрывается
	activeProfile = await pm.getActiveProfile();
	console.log('active profile:', activeProfile);

	console.log('================');

	// и надо заново авторизовываться
	profiles = await pm.getProfiles();
	console.log('profiles:', profiles);
	p = (await pm.signInProfile(p!.id, 'qwerty'))!;
	console.log('signed in:', p);
	console.log('local storage:', await chrome.storage.local.get());
	console.log('session storage:', await chrome.storage.session.get());

	console.log('================');
	
	// если удалить профиль, то он удалится и сессия закроется
	await pm.deleteProfile(p!);
	console.log('deleted');
	profiles = await pm.getProfiles();
	console.log('profiles:', profiles);
	console.log('local storage:', await chrome.storage.local.get());
	console.log('session storage:', await chrome.storage.session.get());

	console.log('*********************************************************************************');
})();
</script>

<template>
	<header>popup head</header>

	<div>Balance in popup: </div>

	<RouterView />
</template>
