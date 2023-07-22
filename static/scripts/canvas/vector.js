function parseArgument(x, N=null) {
	let array;
	if (x instanceof Array) {
		array = x;
	} else if (typeof(x) === "number") {
		array = new Array(N || 1).fill(x);
	} else {
		throw TypeError('Invalid argument, must be a number, array or vector');
	}
	if (N != null && array.length !== N) {
		throw RangeError(`Vector of size ${array.length} not compatible with vector of size ${N}`);
	}
	return array;
}

export class SquareMatrix {
	/*
	 * A very simple (and limited) zero-indexed square matrix, indended
	 * for transformations. No determinant or inverse.
	 */

	N
	#arr

	constructor(arr) {
		let N = Math.sqrt(arr.length);
		if (Math.floor(N) !== N)
			throw Error("Matrix must be initialised with array of length N^2");
		this.N = N;
		this.#arr = arr;
	}

	#validate_index(i) {
		if (i < 0 || i >= this.N) throw Error("Invalid matrix indices");
	}

	#indices_to_arr_index(i, j) {
		this.#validate_index(i);
		this.#validate_index(j);

		return this.N * i + j;
	}

	get(i, j) {
		let idx = this.#indices_to_arr_index(i, j);
		return this.#arr[idx];
	}

	set(i, j, value) {
		let idx = this.#indices_to_arr_index(i, j);
		this.#arr[idx] = value;
	}

	get_row(i) {
		this.#validate_index(i);
		return new Vector(Array(this.N)).map((_, j) => this.get(i, j));
	}

	get_col(j) {
		this.#validate_index(j);
		return new Vector(Array(this.N)).map((_, i) => this.get(i, j));
	}

	stretch(s) {
		if (s instanceof Vector) {
			const vec = s
			if (vec.length !== this.N) throw Error("Shape mismatch between matrix and vector");
			const mat = new SquareMatrix([...this.#arr]);
			for (let i = 0; i < mat.N; i++) {
				mat.set(i, i, mat.get(i, i) * vec[i]);
			}
			return mat;
		} else {
			const mat = new SquareMatrix([...this.#arr]);
			for (let i = 0; i < mat.N; i++) {
				mat.set(i, i, mat.get(i, i) * s);
			}
		}
	}

	matmul(other) {
		if (other instanceof SquareMatrix) {
			// Matrix-matrix multiplication
			let mat = other;
			if (other.N !== this.N) throw Error("Shape mismatch between matrices");
			let res = SquareMatrix.Identity(this.N);
			for (let i = 0; i < this.N; i++) {
				for (let j = 0; j < this.N; j++) {
					res.set(i, j, this.get_row(i).dot(mat.get_col(j)));
				}
			}
			return res;

		} else if (other instanceof Vector) {
			// Matrix-vector multiplication
			let vec = other;
			if (vec.length !== this.N) throw Error("Shape mismatch between matrix and vector");
			return Vector.Zeros(this.N).map((_, i) => this.get_row(i).dot(vec));

		} else {
			throw Error("Can only use matmul() on a SquareMatrix or Vector");
		}
	}

	toDOMArray() {
		/* Returns array in the format specified here:
		 * https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/transform
		 * Returns a, b, c, d, e, f for a matrix:
		 * a, c, e,
		 * b, d, f,
		 * 0, 0, 1
		 */
		return [this.get(0, 0), this.get(1, 0), this.get(0, 1), this.get(1, 1), this.get(0, 2), this.get(1, 2)];
	}

	copy() {
		return new SquareMatrix([...this.#arr]);
	}

	toString() {
		return this.#arr.toString()
	}


	static Identity(N) {
		if (N <= 0) throw Error("Matrix N must be > 0");
		let mat = new SquareMatrix(new Array(N*N).fill(0));
		for (let i = 0; i < mat.N; i++) {
			mat.set(i, i, 1);
		}
		return mat;
	}

	static Rot3dX(theta) {
		let cos = Math.cos(theta);
		let sin = Math.sin(theta);
		return new SquareMatrix([
			1,	 0,		0,
			0,	 cos,	sin,
			0,	-sin,	cos,
		]);
	}

	static Rot3dY(theta) {
		let cos = Math.cos(theta);
		let sin = Math.sin(theta);
		return new SquareMatrix([
			 cos,	0,	sin,
			 0,		1,	0,
			-sin,	0,	cos,
		]);
	}

	static Rot3dZ(theta) {
		let cos = Math.cos(theta);
		let sin = Math.sin(theta);
		return new SquareMatrix([
			 cos,	sin,	0,
			-sin,	cos,	0,
			 0,		0,		1,
		]);
	}

}

export class Vector extends Array {

	constructor(x) {
		const arr = parseArgument(x);
		super();
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

	copy() {
		return new Vector([this]);
	}


	static Zeros(len) {
		if (len <= 0) throw Error("Vector length must be > 0");
		return new Vector(new Array(len).fill(0));
	}

}
