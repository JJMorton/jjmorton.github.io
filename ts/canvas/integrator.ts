import {Vector} from './vector.js';

class Integrator {

	funcAccel = null;
	pos = new Vector([]);
	vel = new Vector([]);
	h = 1e-5;

	constructor(funcAccel, x, v, h) {

		x = new Vector(x);
		v = new Vector(v);

		if (v.length !== x.length)
			throw Error("Velocity vector must be the same length as the position vector");
		if (h <= 0)
			throw Error("The timestep, h, must be > 0");

		const testAccel = funcAccel({pos: x, vel: v, time: 0})
		if (!(testAccel instanceof Vector))
			throw Error("Acceleration function must return a vector");
		if (testAccel.length != x.length)
			throw Error("Acceleration function must return vector of the same length as the position");

		this.pos = x;
		this.vel = v;
		this.funcAccel = funcAccel;
		this.h = h;
	}

	integrateFixed(tStart, tEnd) {
		let t = tStart;
		while (t < tEnd) {
			// Make sure we end exactly at tEnd
			const timestep = Math.min(this.h, tEnd - t);
			this.integrator(t, timestep);
			t += timestep;
		}
	}

	// Should be implemented by a sub-class
	integrator(t, timestep) {
		throw new Error("Not Implemented");
	}

}


/*
 * Basic Euler integration
 */

export class EulerIntegrator extends Integrator {

	constructor(funcAccel, x, v, h) {
		super(funcAccel, x, v, h);
	}

	integrator(t, timestep) {
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

	constructor(funcAccel, x, v, h) {
		super(funcAccel, x, v, h);
		this.numDims = this.pos.length;
	}

	integrator(t, timestep) {

		// q is the system as a whole in phase space, e.g. [x0, x1, v0, v1]
		let q = this.pos.concat(this.vel);

		// The equation of motion for q
		const eom = (t, q) => {
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
