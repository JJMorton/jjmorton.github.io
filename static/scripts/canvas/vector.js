function parseArgument(x, N=null) {
	let array;
	if (x instanceof Array) {
		array = x;
	} else if (typeof(x) === "number") {
		array = new Array(N || 1).fill(x);
	} else {
		throw TypeError('Invalid argument, must be a number, array or vector')
	}
	if (N != null && array.length !== N) {
		throw RangeError(`Vector of size ${array.length} not compatible with vector of size ${N}`);
	}
	return array;
}

export class Vector extends Array {

	constructor(x) {
		const arr = parseArgument(x);
		super()
		this.push(...arr);
	}

	getSize() {
		return Math.hypot(...this);
	}

	getHeading() {
		if (this.length !== 2) throw Error("Can only calculate heading of 2D vector");
		return Math.atan2(this.y, this.x);
	}

	get x() {
		return (this.length >= 1 ? this[0] : null);
	}

	get y() {
		return (this.length >= 2 ? this[1] : null);
	}

	get z() {
		return (this.length >= 3 ? this[2] : null);
	}


	/*
	 * The following methods can all take one of the following as an argument
	 *   a. A scalar
	 *   b. An array
	 *   c. Another vector
	 */

	add(x) {
		const arr = parseArgument(x, this.length);
		return this.map((q, i) => q + arr[i]);
	}

	sub(x) {
		const arr = parseArgument(x, this.length);
		return this.add(new Vector(arr).mult(-1));
	}

	mult(x) {
		const arr = parseArgument(x, this.length);
		return this.map((q, i) => q * arr[i]);
	}

	divide(x) {
		const arr = parseArgument(x, this.length).map(q => 1/q);
		return this.mult(arr);
	}

	normalise() {
		const size = this.getSize();
		if (size === 0) return null;
		return this.divide(size);
	}

	dot(x) {
		if (!(x instanceof Array) || x.length !== this.length) {
			throw TypeError("Can only calculate dot product with vector of same length");
		}
		return this.reduce((acc, q, i) => acc + q*x[i], 0);
	}

	rotate(theta) {
		if (this.length < 2) {
			return this;
		}
		// Support rotations for 2-d vectors
		else if (this.length === 2) {
			return new Vector([this[0]*Math.cos(theta) - this[1]*Math.sin(theta), this[0]*Math.sin(theta) + this[1]*Math.cos(theta)]);
		}
		// Support rotations around z for 3-d vectors
		else if (this.length === 3) {
			return this.slice(0, 2).rotate(theta).concat([this[2]]);
		}
		// I don't need any higher dimensional rotations
		else {
			console.error("Rotations for vectors of dimension > 3 not supported");
			return null;
		}
	}

}
