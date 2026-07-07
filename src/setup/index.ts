import { createApp } from "vue"
import { createRouter, createWebHashHistory } from "vue-router"
import App from "./app.vue"
import routes from "~pages"
// import "@/assets/styles/base.scss"
import "./index.scss"

const router = createRouter({
	history: createWebHashHistory(import.meta.env.BASE_URL),
	routes,
})

const app = createApp(App)

app.use(router).mount("#app")
