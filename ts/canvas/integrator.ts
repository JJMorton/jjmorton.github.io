import {Vector, VectorLike} from './vector.js';

export type AnyIntegratorConstructor = typeof EulerIntegrator | typeof RK4Integrator;
export type AnyIntegrator = EulerIntegrator | RK4Integrator;
export type AccelFunc = ({}: {pos: Vector, vel: Vector, time: number}) => Vector;

export abstract class Integrator {

	/** Function to calculate the current acceleration */
	public funcAccel: AccelFunc;
	/** Current position */
	public pos: Vector;
	/** Current velocity */
	public vel: Vector;
	/** Integration timestep */
	public h: number;

	protected numDims: number;

	constructor(funcAccel: AccelFunc, x: VectorLike, v: VectorLike, h: number) {

		x = new Vector(x);
		v = new Vector(v);

		if (v.length !== x.length)
			throw Error("Velocity vector must be the same length as the position vector");
		if (h <= 0)
			throw Error("The timestep, h, must be > 0");

		// Make sure the acceleration function returns a valid vector
		const testAccel = funcAccel({pos: x, vel: v, time: 0})
		if (!(testAccel instanceof Vector))
			throw Error("Acceleration function must return a vector");
		if (testAccel.length != x.length)
			throw Error("Acceleration function must return vector of the same length as the position");

		this.pos = x;
		this.vel = v;
		this.funcAccel = funcAccel;
		this.h = h;
		this.numDims = x.length;
	}

	/** Integrate from tStart until tEnd with a fixed timestep */
	public integrateFixed(tStart: number, tEnd: number) {
		let t = tStart;
		while (t < tEnd) {
			// Make sure we end exactly at tEnd
			const timestep = Math.min(this.h, tEnd - t);
			this.integrator(t, timestep);
			t += timestep;
		}
	}

	/**
	 * Integrates from `t` to `t + timestep`.
	 */
	protected abstract integrator(t: number, timestep: number): void;

}


/**
 * Basic Euler integration
 */
export class EulerIntegrator extends Integrator {

	protected integrator(t: number, timestep: number): void {
		// v = v + ha
		this.vel = this.funcAccel({pos: this.pos, vel: this.vel, time: t})
		.mult(timestep)
		.add(this.vel);
		// x = x + hv
		this.pos = this.vel.mult(timestep).add(this.pos);
	}

}


/*
 * Fourth order Runge-Kutta integration
 */

export class RK4Integrator extends Integrator {

	 protected integrator(t: number, timestep: number): void {

		// q is the system as a whole in phase space, e.g. [x0, x1, v0, v1]
		let q = this.pos.concat(this.vel);

		// The equation of motion for q
		const eom = (t: number, q: Vector) => {
			// Split q into position and velocity, so we can call funcAccel
			const x = q.slice(0, this.numDims);
			const v = q.slice(this.numDims);
			return v.concat(this.funcAccel({time: t, pos: x, vel: v}));
		};

		// Calculate the slopes
		const k1 = eom(t, q).mult(timestep);
		const k2 = eom(t + timestep / 2, q.add(k1.mult(0.5))).mult(timestep);
		const k3 = eom(t + timestep / 2, q.add(k2.mult(0.5))).mult(timestep);
		const k4 = eom(t + timestep, q.add(k3)).mult(timestep);

		// Weight them
		q = q
			.add(k1.divide(6))
			.add(k2.divide(3))
			.add(k3.divide(3))
			.add(k4.divide(6));

		// Split back into position and velocity
		this.pos = q.slice(0, this.numDims);
		this.vel = q.slice(this.numDims);
	}
}
