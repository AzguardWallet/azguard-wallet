import BN from 'bignumber.js'

BN.config({
	FORMAT: {
		decimalSeparator: '.',
		groupSeparator: ',',
		groupSize: 3,
		secondaryGroupSize: 0,
		fractionGroupSeparator: '',
		fractionGroupSize: 0
	}
})

export default BN
