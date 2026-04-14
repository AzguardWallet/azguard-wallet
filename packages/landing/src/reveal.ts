/**
 * Scroll-triggered reveal animations via Intersection Observer.
 * Uses a single observer instance for all reveal targets.
 */

const REVEAL_THRESHOLD = 0.15
const REVEAL_ROOT_MARGIN = "0px 0px -50px 0px"

export function initScrollReveal(): void {
	const targets = document.querySelectorAll("[data-reveal], [data-reveal-stagger]")
	if (targets.length === 0) return

	const observer = new IntersectionObserver(
		(entries) => {
			for (const entry of entries) {
				if (entry.isIntersecting) {
					entry.target.classList.add("revealed")
					observer.unobserve(entry.target)
				}
			}
		},
		{
			threshold: REVEAL_THRESHOLD,
			rootMargin: REVEAL_ROOT_MARGIN,
		},
	)

	for (const el of targets) {
		observer.observe(el)
	}
}

/**
 * Hero line-by-line entrance animation.
 * Adds .hero--loaded to the hero section after a brief delay,
 * allowing CSS transitions to stagger each line.
 */
export function initHeroAnimation(): void {
	const hero = document.querySelector(".hero")
	if (!hero) return

	requestAnimationFrame(() => {
		hero.classList.add("hero--loaded")
	})
}

/**
 * Navigation scroll effect.
 * Toggles .nav--scrolled when page scrolls past threshold.
 * Uses rAF to avoid layout thrashing.
 */
export function initNavScroll(): void {
	const nav = document.querySelector(".nav")
	if (!nav) return

	let ticking = false

	const onScroll = () => {
		if (ticking) return
		ticking = true

		requestAnimationFrame(() => {
			nav.classList.toggle("nav--scrolled", window.scrollY > 50)
			ticking = false
		})
	}

	window.addEventListener("scroll", onScroll, { passive: true })
	onScroll()
}

/**
 * Cursor spotlight effect.
 * A faint radial glow follows the mouse position via CSS custom properties.
 * Disabled on touch devices. Throttled with rAF.
 */
export function initSpotlight(): void {
	const el = document.querySelector<HTMLElement>(".spotlight")
	if (!el) return

	if (window.matchMedia("(pointer: coarse)").matches) return

	let rafId = 0
	let lastX = 0
	let lastY = 0

	const onMove = (e: MouseEvent) => {
		lastX = e.clientX
		lastY = e.clientY

		if (!rafId) {
			rafId = requestAnimationFrame(() => {
				el.style.setProperty("--mx", `${lastX}px`)
				el.style.setProperty("--my", `${lastY}px`)
				rafId = 0
			})
		}
	}

	document.addEventListener("mousemove", onMove, { passive: true })

	document.addEventListener(
		"mousemove",
		() => {
			el.classList.add("spotlight--active")
		},
		{ once: true, passive: true },
	)

	document.addEventListener("mouseleave", () => {
		el.classList.remove("spotlight--active")
	})

	document.addEventListener("mouseenter", () => {
		el.classList.add("spotlight--active")
	})
}

/**
 * Scroll progress indicator.
 * Uses transform: scaleX() for compositor-only animation (no layout).
 */
export function initScrollProgress(): void {
	const bar = document.querySelector<HTMLElement>(".scroll-progress")
	if (!bar) return

	let ticking = false

	const update = () => {
		if (ticking) return
		ticking = true

		requestAnimationFrame(() => {
			const scrollTop = window.scrollY
			const docHeight = document.documentElement.scrollHeight - window.innerHeight
			const progress = docHeight > 0 ? scrollTop / docHeight : 0
			bar.style.transform = `scaleX(${progress})`
			ticking = false
		})
	}

	window.addEventListener("scroll", update, { passive: true })
	update()
}

/**
 * Quote word-by-word reveal.
 * Splits the quote text into individual word <span>s using DOM APIs,
 * preserving an aria-label with the full text for screen readers.
 * Words reveal sequentially when the section enters the viewport.
 */
export function initQuoteReveal(): void {
	const el = document.querySelector<HTMLElement>("[data-quote-words]")
	const section = document.querySelector("[data-reveal-quote]")
	if (!el || !section) return

	const text = el.textContent?.trim() ?? ""

	// Preserve full text as accessible label
	el.setAttribute("aria-label", text)

	// Build word spans via DOM API (not innerHTML)
	const words = text.split(/\s+/)
	el.textContent = ""

	const fragment = document.createDocumentFragment()
	words.forEach((word, i) => {
		if (i > 0) fragment.append(" ")
		const span = document.createElement("span")
		span.className = "quote__word"
		span.textContent = word
		fragment.appendChild(span)
	})
	el.appendChild(fragment)

	const wordEls = el.querySelectorAll<HTMLElement>(".quote__word")

	const observer = new IntersectionObserver(
		(entries) => {
			for (const entry of entries) {
				if (entry.isIntersecting) {
					wordEls.forEach((word, i) => {
						setTimeout(() => {
							word.classList.add("quote__word--visible")
						}, i * 50)
					})

					section.classList.add("revealed")
					observer.unobserve(entry.target)
				}
			}
		},
		{
			threshold: 0.3,
			rootMargin: "0px 0px -30px 0px",
		},
	)

	observer.observe(section)
}
