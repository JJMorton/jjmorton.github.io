/*
 * Simple 2D vector class
 *
 * IMPORTANT, READ THIS FIRST:
 * Where logical, methods take either an x and y coordinate or another vector.
 * There isn't much argument validation so check how the methods should be used first.
 * Valid argument types are written in comments above each method.
 * Instance methods are in-place, static methods return a new Vector.
 */

class Vector {
	

	/* ****************************************
	 * CONSTRUCTOR
	 * returns a Vector
	 */


	/*
	 * Creates a new vector or clones an existing one
	 */
	// Vector
	// Number, Number
	constructor(x, y) {
		if (x instanceof Vector) return new Vector(x.x, x.y);
		this.x = x;
		this.y = y;
	}




	/* ****************************************
	 * SCALAR INSTANCE METHODS
	 * returns a Number
	 */


	/*
	 * Returns distance to origin
	 */
	getLength() {
		return Math.hypot(this.x, this.y);
	}

	/*
	 * Distance to another point
	 */
	// Number, Number
	// Vector
	distanceTo(x, y) {
		if (x instanceof Vector) return this.distanceTo(x.x, x.y);
		return Math.hypot(x - this.x, y - this.y);
	}

	/*
	 * Vector dot product
	 */
	// Number, Number
	// Vector
	dot(x, y) {
		if (x instanceof Vector) return this.x * x.x + this.y * x.y;
		return this.x * x + this.y * y;
	}




	/* ****************************************
	 * VECTOR INSTANCE METHODS
	 * returns a Vector
	 */


	/*
	 * Vector addition
	 */
	// Vector
	// Number, Number
	add(x, y) {
		if (x instanceof Vector) return this.add(x.x, x.y);
		this.x += x;
		this.y += y;
		return this;
	}

	/*
	 * Vector subtraction
	 */
	// Vector
	// Number, Number
	sub(x, y) {
		if (x instanceof Vector) return this.sub(x.x, x.y);
		return this.add(-x, -y);
	}

	/*
	 * Element-wise multiplication
	 */
	// Vector
	// Number, Number
	mult(x, y) {
		if (x instanceof Vector) return this.mult(x.x, x.y);
		this.x *= x;
		this.y *= y;
		return this;
	}

	/*
	 * Element-wise division
	 */
	// Vector
	// Number, Number
	div(x, y) {
		if (x instanceof Vector) return this.mult(x.x, x.y);
		return this.mult(1/x, 1/y);
	}

	/*
	 * Magnitude multiplication
	 */
	// Number
	scale(s) {
		return this.mult(s, s);
	}

	/*
	 * Sets magnitude to 1, preserving direction
	 */
	normalise() {
		const length = this.getLength();
		if (!length) return null;
		return this.scale(1 / length);
	}

	/*
	 * Clockwise rotation in radians
	 */
	// Number
	rotate(a) {
		const cos = Math.cos(a),
		      sin = Math.sin(a);
		[this.x, this.y] = [cos * this.x - sin * this.y, sin * this.x + cos * this.y];
		return this;
	}




	/* ****************************************
	 * STATIC VECTOR METHODS
	 * returns a Vector
	 */


	// Vector, Vector
	static add(v1, v2) {
		return new Vector(v1).add(v2);
	}

	// Vector, Vector
	static sub(v1, v2) {
		return new Vector(v1).sub(v2);
	}

	// Vector, Vector
	static mult(v1, v2) {
		return new Vector(v1).mult(v2);
	}

	// Vector, Vector
	static div(v1, v2) {
		return new Vector(v1).div(v2);
	}

	// Vector, Number
	static scale(v, s) {
		return new Vector(v).scale(s);
	}

	// Vector
	static normalise(v) {
		return new Vector(v).normalise();
	}

	// Vector, Number
	static rotate(v, a) {
		return new Vector(v).rotate(a);
	}

}

