/**
 * Creates a vector from the argument, optionally enforcing a length `N`
 */
function parseVector(x, N) {
    let array;
    if (x instanceof Array) {
        array = x;
    }
    else if (typeof (x) === "number") {
        array = new Array(N || 1).fill(x);
    }
    else {
        throw TypeError('Invalid argument, must be a number, array or vector');
    }
    if (N != null && array.length !== N) {
        throw RangeError(`Vector of size ${array.length}, wanted size ${N}`);
    }
    return new Vector().concat(array);
}
/**
 * A very simple (and limited) zero-indexed square matrix, indended
 * for transformations. No determinant or inverse.
 */
export class SquareMatrix {
    constructor(arr) {
        let N = Math.sqrt(arr.length);
        if (Math.floor(N) !== N)
            throw Error("Matrix must be initialised with array of length N^2");
        this.N = N;
        this.arr = arr;
    }
    validate_index(i) {
        if (i < 0 || i >= this.N)
            throw Error("Invalid matrix indices");
    }
    indices_to_arr_index(i, j) {
        this.validate_index(i);
        this.validate_index(j);
        return this.N * i + j;
    }
    get(i, j) {
        let idx = this.indices_to_arr_index(i, j);
        return this.arr[idx];
    }
    set(i, j, value) {
        let idx = this.indices_to_arr_index(i, j);
        this.arr[idx] = value;
    }
    get_row(i) {
        this.validate_index(i);
        return new Vector(Array(this.N)).map((_, j) => this.get(i, j));
    }
    get_col(j) {
        this.validate_index(j);
        return new Vector(Array(this.N)).map((_, i) => this.get(i, j));
    }
    /**
     * Multiply the diagonal of the matrix by a vector (element-wise)
     */
    stretch(s) {
        const arr = parseVector(s, this.N);
        const mat = new SquareMatrix([...this.arr]);
        for (let i = 0; i < mat.N; i++) {
            mat.set(i, i, mat.get(i, i) * arr[i]);
        }
        return mat;
    }
    /**
     * Matrix multiplication
     */
    matmul(mat) {
        // Matrix-matrix multiplication
        if (mat.N !== this.N)
            throw Error("Shape mismatch between matrices");
        let res = SquareMatrix.Identity(this.N);
        for (let i = 0; i < this.N; i++) {
            for (let j = 0; j < this.N; j++) {
                res.set(i, j, this.get_row(i).dot(mat.get_col(j)));
            }
        }
        return res;
    }
    /**
     * Applies this matrix on the vector `X`.
     */
    vecmul(vec) {
        if (vec.length !== this.N)
            throw Error("Shape mismatch between matrix and vector");
        return Vector.Zeros(this.N).map((_, i) => this.get_row(i).dot(vec));
    }
    /**
     * Returns array in the format specified here:
     * https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/transform.
     * Returns a, b, c, d, e, f for a matrix of the form
     * [(a, c, e),
     *  (b, d, f),
     *  (0, 0, 1)]
     */
    toDOMArray() {
        return [this.get(0, 0), this.get(1, 0), this.get(0, 1), this.get(1, 1), this.get(0, 2), this.get(1, 2)];
    }
    /**
     * Deep copy of the matrix
     */
    copy() {
        return new SquareMatrix([...this.arr]);
    }
    toString() {
        return this.arr.toString();
    }
    static Identity(N) {
        if (N <= 0)
            throw Error("Matrix N must be > 0");
        let mat = new SquareMatrix(new Array(N * N).fill(0));
        for (let i = 0; i < mat.N; i++) {
            mat.set(i, i, 1);
        }
        return mat;
    }
    static Rot3dX(theta) {
        let cos = Math.cos(theta);
        let sin = Math.sin(theta);
        return new SquareMatrix([
            1, 0, 0,
            0, cos, sin,
            0, -sin, cos,
        ]);
    }
    static Rot3dY(theta) {
        let cos = Math.cos(theta);
        let sin = Math.sin(theta);
        return new SquareMatrix([
            cos, 0, sin,
            0, 1, 0,
            -sin, 0, cos,
        ]);
    }
    static Rot3dZ(theta) {
        let cos = Math.cos(theta);
        let sin = Math.sin(theta);
        return new SquareMatrix([
            cos, sin, 0,
            -sin, cos, 0,
            0, 0, 1,
        ]);
    }
}
/**
 * A simple vector implementation, extending the functionality of `Array` with some mathematical operations
 */
export class Vector extends Array {
    // Force TS to see these methods as returning a Vector... because they do!
    // Then we can use these methods elsewhere without TS complaining.
    // @ts-ignore
    map(callbackfn, thisArg) {
        // @ts-ignore
        return super.map(callbackfn, thisArg);
    }
    // @ts-ignore
    slice(start, end) {
        // @ts-ignore
        return super.slice(start, end);
    }
    // @ts-ignore
    concat(...items) {
        // @ts-ignore
        return super.concat(...items);
    }
    constructor(x) {
        super();
        if (!x)
            return;
        this.push(...parseVector(x));
    }
    /** Compute the Euclidean length */
    getSize() {
        return Math.hypot(...this);
    }
    /** Compute the angle from the +ve x-axis */
    getHeading() {
        return Math.atan2(this.y, this.x);
    }
    /** First component of the vector */
    get x() {
        if (this.length < 1) {
            console.warn(`Accessing .x of vector of length ${this.length}`);
        }
        return (this.length >= 1 ? this[0] : 0);
    }
    /** Second component of the vector */
    get y() {
        if (this.length < 2) {
            console.warn(`Accessing .y of vector of length ${this.length}`);
        }
        return (this.length >= 2 ? this[1] : 0);
    }
    /** Third component of the vector */
    get z() {
        if (this.length < 3) {
            console.warn(`Accessing .z of vector of length ${this.length}`);
        }
        return (this.length >= 3 ? this[2] : 0);
    }
    set x(val) {
        if (this.length < 1) {
            throw Error(`Setting .x of vector of length ${this.length}`);
        }
        this[0] = val;
    }
    set y(val) {
        if (this.length < 2) {
            throw Error(`Setting .y of vector of length ${this.length}`);
        }
        this[1] = val;
    }
    set z(val) {
        if (this.length < 3) {
            throw Error(`Setting .z of vector of length ${this.length}`);
        }
        this[2] = val;
    }
    /*
     * The following methods can all take one of the following as an argument
     *   a. A scalar
     *   b. An array
     *   c. Another vector
     */
    add(x) {
        const arr = parseVector(x, this.length);
        return this.map((q, i) => q + arr[i]);
    }
    sub(x) {
        const arr = parseVector(x, this.length);
        return this.add(new Vector(arr).mult(-1));
    }
    mult(x) {
        const arr = parseVector(x, this.length);
        return this.map((q, i) => q * arr[i]);
    }
    divide(x) {
        const arr = parseVector(x, this.length).map(q => 1 / q);
        return this.mult(arr);
    }
    normalise() {
        const size = this.getSize();
        if (size === 0)
            throw Error("Attempt to normalise null vector");
        return this.divide(size);
    }
    dot(x) {
        const arr = parseVector(x, this.length);
        return this.reduce((acc, q, i) => acc + q * arr[i], 0);
    }
    /** Rotate in 2D, or around the z-axis for 3D vectors */
    rotate(theta) {
        if (this.length < 2) {
            return this;
        }
        // Support rotations for 2-d vectors
        else if (this.length === 2) {
            return new Vector([this[0] * Math.cos(theta) - this[1] * Math.sin(theta), this[0] * Math.sin(theta) + this[1] * Math.cos(theta)]);
        }
        // Support rotations around z for 3-d vectors
        else if (this.length === 3) {
            return this.slice(0, 2).rotate(theta).concat([this[2]]);
        }
        // I don't need any higher dimensional rotations
        else {
            throw Error("Rotations for vectors of dimension > 3 not supported");
        }
    }
    /** Deep clone this vector */
    copy() {
        return new Vector(this);
    }
    /** Create a new vector filled with zeros */
    static Zeros(len) {
        if (len <= 0)
            throw Error("Vector length must be > 0");
        return new Vector(new Array(len).fill(0));
    }
}
