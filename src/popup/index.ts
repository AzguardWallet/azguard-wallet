import { consoleMethods, LogLevel } from "@/wallet/logger"
import { LoggerServiceClient } from "@/wallet/services/logger/client"
import { getErrorData } from "@/wallet/utils/errors"

// catch console
const logger = new LoggerServiceClient()
for (const [method, level] of consoleMethods) {
	;(self as any)[`on${method}`] = (...args: any[]) => {
		logger.log("ui", level, ...args)
	}
}

// catch unhandled errors
self.onunhandledrejection = (e: PromiseRejectionEvent) => {
	logger.log("ui", LogLevel.Error, getErrorData(e.reason))
}

import { createPinia } from "pinia"
import { createApp } from "vue"
import { createRouter, createWebHashHistory } from "vue-router/auto"
import App from "./app.vue"
import routes from "~pages"
import "@/assets/styles/_base.scss"
import "./index.scss"

/** Configure BigNumber format */
import BigNumber from "bignumber.js"
import { getDecimalSeparator, getThousandSeparator } from "@/utils/amount.js"

BigNumber.config({
	DECIMAL_PLACES: 100,
	FORMAT: {
		decimalSeparator: getDecimalSeparator(),
		groupSeparator: getThousandSeparator(),
		groupSize: 3,
	},
})

import { managers } from "@/utils/core.js"

/** Store */
import { useAppStore } from "@/stores/app.store"

routes.push({
	path: "/",
	redirect: "/popup",
})

const router = createRouter({
	history: createWebHashHistory(import.meta.env.BASE_URL),
	routes,
})

router.beforeEach(async (to, from, next) => {
	const appStore = useAppStore()

	if (to.name === "popup-register" && appStore.isRegistered) {
		next({ name: from.name || "popup-general" })
		return
	}

	if (to.name === "popup-auth" && appStore.isLogined) {
		next({ name: from.name || "popup-general" })
		return
	}

	if (to.meta.isAuthRequired && !appStore.isLogined && appStore.isSessionChecked) {
		next({ name: "popup-auth" })
		return
	}

	if (to.meta.isAuthRequired && !appStore.isLogined && !appStore.isSessionChecked) {
		const activeProfile = await managers.profile.getActiveProfile()
		if (!activeProfile) {
			next({ name: "popup-auth" })
			return
		}
	}

	if (!appStore.profile && to.name !== "popup-register") {
		const profiles = await managers.profile.getProfiles()
		if (profiles.length) {
			appStore.profile = profiles[0]
		} else {
			next({ name: "popup-register" })
			return
		}
	}

	next()
})

createApp(App).use(router).use(createPinia()).mount("#app")
