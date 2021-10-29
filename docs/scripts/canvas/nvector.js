function parseArgument(x, N=null) {
	let array;
	if (x instanceof Array) {
		array = x;
	} else if (typeof(x) === "number") {
		array = new Array(N || 1).fill(x);
	} else {
		throw TypeError('Invalid argument, must be a number, array or nVector')
	}
	if (N != null && array.length !== N) {
		throw RangeError(`Vector of size ${array.length} not compatible with vector of size ${N}`);
	}
	return array;
}

class nVector extends Array {

	constructor(x) {
		const arr = parseArgument(x);
		super()
		this.push(...arr);
	}

	getSize() {
		return Math.hypot(...this);
	}


	/*
	 * The following methods can all take one of the following as an argument
	 *   a. A scalar
	 *   b. An array
	 *   c. Another nVector
	 */

	add(x) {
		const arr = parseArgument(x, this.length);
		return this.map((q, i) => q + arr[i]);
	}

	sub(x) {
		const arr = parseArgument(x, this.length);
		return this.add(new nVector(arr).mult(-1));
	}

	mult(x) {
		const arr = parseArgument(x, this.length);
		return this.map((q, i) => q * arr[i]);
	}

	divide(x) {
		const arr = parseArgument(x, this.length).map(q => 1/q);
		return this.mult(arr);
	}

}