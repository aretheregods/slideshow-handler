/**
 * @description Convert integer values to uppercase Roman numerals
 * 
 * @param {integer} num - the integer to be converted to a Roman numeral
 * @returns string - The integer's Roman number string representation in upper case letters
*/
export function integerToRoman( num ) {
	const romanValues = {
		M: 1000,
		CM: 900,
		D: 500,
		CD: 400,
		C: 100,
		XC: 90,
		L: 50,
		XL: 40,
		X: 10,
		IX: 9,
		V: 5,
		IV: 4,
		I: 1
	};

	let roman = '';

	for (let key in romanValues) {
    	while (num >= romanValues[key]) {
    		roman += key;
    		num -= romanValues[key];
    	}
	}
	return roman;
}
