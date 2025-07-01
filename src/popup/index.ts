import { ConsoleSnifferService } from "@/wallet/services/console-sniffer";
import { LogOrigin } from "@/wallet/services/logger/client/models"
const consoleSnifferService = new ConsoleSnifferService(LogOrigin.UI);

import { createPinia } from "pinia"
import { createApp } from "vue"
import { createRouter, createWebHashHistory } from "vue-router/auto"
import App from "./app.vue"
import routes from "~pages"
import "@/assets/styles/_base.scss"
import "./index.scss"

/** Configure BigNumber format */
import BigNumber from "bignumber.js";
import { getDecimalSeparator, getThousandSeparator } from "@/utils/amount.js"

BigNumber.config({
	DECIMAL_PLACES: 100,
    FORMAT: {
        decimalSeparator: getDecimalSeparator(),
        groupSeparator: getThousandSeparator(),
        groupSize: 3,
    },
});

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

self.onerror = (message, source, lineno, colno, error) => {
	console.info(`Error: ${message}\nSource: ${source}\nLine: ${lineno}\nColumn: ${colno}\nError object: ${error}`)
}
