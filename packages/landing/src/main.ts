import "./styles/tokens.css"
import "./styles/base.css"
import "./styles/layout.css"
import "./styles/sections.css"
import "./styles/animations.css"

import { initHeroAnimation, initNavScroll, initQuoteReveal, initScrollProgress, initScrollReveal, initSpotlight } from "./reveal"

// Enable JS-dependent animations (FOUC prevention: content is visible by
// default; this class gates the reveal transitions so content never hides
// if JS fails to load)
document.documentElement.classList.add("js-loaded")

document.addEventListener("DOMContentLoaded", () => {
	initHeroAnimation()
	initScrollReveal()
	initQuoteReveal()
	initNavScroll()
	initScrollProgress()
	initSpotlight()
})
