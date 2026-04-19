<script setup>
/**
 * Catch-all route: 404 fallback + legacy-path redirects.
 *
 * After the IA flatten (commit arc 2026-04-19) the settings tree lost the
 * settings/general/* and settings/external-services buckets. Any old link or
 * bookmark that still points at the nested paths is redirected here to the
 * flat equivalent for one release. Strip these aliases once telemetry / QA
 * confirms no one still lands on them.
 */

const router = useRouter()
const route = useRoute()

const LEGACY_REDIRECTS = [
	// settings/general/<x> → settings/<x>
	{ from: /^\/popup\/settings\/general\/accounts(?:\/.*)?$/, to: "/popup/settings/accounts" },
	{ from: /^\/popup\/settings\/general\/tokens(?:\/.*)?$/, to: "/popup/settings/tokens" },
	{ from: /^\/popup\/settings\/general\/contacts(?:\/.*)?$/, to: "/popup/settings/contacts" },
	{ from: /^\/popup\/settings\/general\/networks(?:\/.*)?$/, to: "/popup/settings/networks" },
	{ from: /^\/popup\/settings\/general\/fpcs(?:\/.*)?$/, to: "/popup/settings/fpcs" },
	{ from: /^\/popup\/settings\/general\/appearance(?:\/.*)?$/, to: "/popup/settings/appearance" },
	// sessions → connected-apps (label rename; route stays semantic)
	{
		from: /^\/popup\/settings\/general\/sessions\/session\/(.+)$/,
		to: (m) => `/popup/settings/connected-apps/${m[1]}`,
	},
	{ from: /^\/popup\/settings\/general\/sessions(?:\/.*)?$/, to: "/popup/settings/connected-apps" },
	// general landing page is gone — send users to settings root
	{ from: /^\/popup\/settings\/general\/?$/, to: "/popup/settings" },
	// external-services → privacy (content is privacy defaults, not integrations)
	{ from: /^\/popup\/settings\/external-services(?:\/.*)?$/, to: "/popup/settings/privacy" },
	// account/state → advanced/account-state
	{
		from: /^\/popup\/settings\/account\/state\/(.+)$/,
		to: (m) => `/popup/settings/advanced/account-state/${m[1]}`,
	},
	{ from: /^\/popup\/settings\/account\/state\/?$/, to: "/popup/settings/advanced/account-state" },
	// settings/account (current-account page) merged into settings/accounts
	{ from: /^\/popup\/settings\/account\/?$/, to: "/popup/settings/accounts" },
]

const path = route.path
const match = LEGACY_REDIRECTS.find((r) => r.from.test(path))
if (match) {
	const dest = typeof match.to === "function" ? match.to(path.match(match.from)) : match.to
	router.replace(dest)
} else {
	router.push("/popup/general")
}
</script>

<template></template>
