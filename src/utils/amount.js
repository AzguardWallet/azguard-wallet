/** Vendor */
import BN from 'bignumber.js'

export const getDecimalSeparator = () => {
    const s = (1.1).toLocaleString()
    return s.substring(1, s.length - 1)
}

export const getThousandSeparator = () => {
    const s = (1111).toLocaleString()
    return s.substring(1, s.length - 3)
}

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

export const parseAmountBN = (value) => {
	const raw = value
	if (!raw) return null

	const normalized = purgeNumber(raw)
	if (!normalized || normalized === '.') return null

	try {
		return new BN(normalized)
	} catch {
		return null
	}
}

export const formatAmount = (bn, decimals = 8) => {
	const sep = getDecimalSeparator()

	return bn
		.decimalPlaces(decimals, BN.ROUND_HALF_UP)
		.toFormat(decimals)
		.replace(new RegExp(`0+$`), '')
		.replace(new RegExp(`\\${sep}$`), '')
}

export const normalizeAmount = target => {
	if (target === ".") return "0."

	let dotCounter = 0
	for (const char of target) {
		if (char === ".") dotCounter++
	}

	if (dotCounter > 1) return target.slice(0, target.length - 1)

	if (target[target.length - 1] === ".") return target
	if (!target.length) return ""
	if (target.length === 1 && !/^(0|[1-9]\d*)(\.\d+)?$/.test(target)) return ""
}

export const normalizeAmountToTokenStep = (bn, decimals) => {
	const step = new BN(1).div(new BN(10).pow(decimals))

	return bn
		.div(step)
		.integerValue(BN.ROUND_DOWN)
		.times(step)
}

export const balanceFormatted = (balance, length) => {
	let slashed = false
	if (!balance || balance.isZero()) return { value: '0', slashed }

	let str = balance.toFormat()
	if (!length) {
		return { value: str, slashed }
	}

	if (balance.lt(new BN(10).pow(-(length - 2)))) {
		return {
			value: `<0${getDecimalSeparator()}${'0'.repeat(length - 3)}1`,
			slashed: true,
		}
	}

	if (str.length > length) {
		str = `${str.slice(0, length)}...`
		slashed = true
	}

	return { value: str, slashed }
}

export const isValidAmount = (value) => {
	try {
		const amount = new BN(value)

		return amount.isFinite() && !amount.isNaN() && amount.gt(0)
	} catch (err) {
		return false
	}
}
