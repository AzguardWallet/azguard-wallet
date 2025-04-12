export const comma = (target, symbol = ",", fixed = 2) => {
	if (!target) return 0

	let num = Number.parseFloat(target)

	if (num % 1 === 0) {
		num = num.toFixed(0)
	} else {
		num = num.toFixed(fixed)
	}

	if (num.includes(".")) {
		while (num[num.length - 1] === "0") {
			num = num.slice(0, num.length - 1)
		}
		if (num[num.length - 1] === ".") {
			num = num.slice(0, num.length - 1)
		}
	}

	if (num.split(".").length > 1 && fixed !== 2) {
		return `${num
			.split(".")[0]
			.toString()
			.replace(/\B(?=(\d{3})+(?!\d))/g, symbol)}.${num.split(".")[1]}`
	}

	return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, symbol)
}

export const purgeNumber = target => {
	if (/^(0|[1-9]\d*)(\.\d+)?$/.test(target)) return target
	return target.replace(/[^0-9.]/g, "")
}

export const normalizeAmount = target => {
	if (target === ".") return "0."

	let dotCounter = 0
	target.split("").forEach(char => {
		if (char === ".") dotCounter++
	})

	if (dotCounter > 1) return target.slice(0, target.length - 1)

	if (target[target.length - 1] === ".") return target
	if (!target.length) return ""
	if (target.length === 1 && !/^(0|[1-9]\d*)(\.\d+)?$/.test(target)) return ""
	if (Number.parseFloat(purgeNumber(target)) >= 9_999_999_999_999) return "9999999999999"
}

export const isValidAmount = (value) => {
	const num = Number(value)
	return !Number.isNaN(num) && num > 0 && String(num) === value
}
