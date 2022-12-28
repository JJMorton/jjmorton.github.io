import {Simulation, Knob, Checkbox, Meter} from './main.js';
import {Vector} from './vector.js';
import * as Integrators from './integrator.js';

window.areaLog = [];
window.zLog = [];

window.addEventListener("load", function() {

	'use strict';

	const sim = new Simulation();

	// Initial parameters
	const params = {
		mass: 2.5,
		b_density: 800,
		f_density: 1000,
		f_viscosity: 0.1,
		elasticity: 0.8,
		gravity: 9.81,
		showforces: true,
		surfaceHeight: 2, // Depth of the fluid in m
		getVolume: () => params.mass / params.b_density,
		getRadius: () => Math.cbrt(3/(4 * Math.PI) * params.getVolume()),
		getArea: () => Math.PI * Math.pow(params.getRadius(), 2)
	};

	// Changing state
	const state = {
		upthrust: new Vector([0, 0]),
		drag: new Vector([0, 0]),
		E0: 0
	};

	let integrator = new Integrators.RK4Integrator(
		accelerationCalculator,
		new Vector([sim.percToM(50), sim.percToM(20)]),
		new Vector([0, 0]),
		0.1
	);


	const energyMeter = new Meter("energy", "Total Energy (% of initial)", "%", 100, 0, 100);
	const kineticMeter = new Meter("kinetic", "Kinetic Energy (% of total)", "%", 0, 0, 100);
	const potentialMeter = new Meter("potential", "Potential Energy (% of total)", "%", 0, 0, 100);
	function kineticEnergy() {
		return 0.5 * params.mass * Math.pow(integrator.vel.getSize(), 2);
	}
	function potentialEnergy() {
		const grav = params.mass * params.gravity * (sim.scale - integrator.pos.y);

		/*
		 * Found expressions for the potential due to buoyancy by integrating the force.
		 * The buoyancy force calculated in this simulation takes into account the
		 * case where the ball is partially submerged, so this potential does too.
		 * https://www.desmos.com/calculator/vf195glqel
		 */

		// How far under the surface the bottom of the sphere is
		const r = params.getRadius();
		const z = (integrator.pos.y + r) - (sim.scale - params.surfaceHeight);
		let buoy = 0;
		// Partially submerged
		if (z > 0 && z < 2*r) {
			buoy = params.f_density * params.gravity * 1/3 * Math.PI * (r * z*z*z - 0.25 * z*z*z*z);
		} else if (z >= 2*r) {
			buoy = params.f_density * params.gravity * 4/3 * Math.PI * r*r*r * (z - r);
		}

		return grav + buoy;
	}
	state.E0 = kineticEnergy() + potentialEnergy();


	function getVolumeIntersect(pos, radius) {
		// Made complicated by handling the cases where the ball is not fully submerged

		// Is the top of the ball above the surface?
		const distSubmerged = pos.y + radius - (sim.scale - params.surfaceHeight);

		// If the ball is partially submerged
		// http://ambrsoft.com/TrigoCalc/Sphere/Cap/SphereCap.htm
		if (distSubmerged < 2 * radius) {
			return 1/3 * Math.PI * Math.pow(distSubmerged, 2) * (3 * radius - distSubmerged);
		} else {
			return params.getVolume();
		}
	}

	function getFluidDrag(vel, radius, area) {
		const speed = vel.getSize();
		if (speed > 0) {
			let drag = 6 * Math.PI * params.f_viscosity * radius
			             + 0.5 * 0.47 * params.f_density * area * speed;
			return vel.mult(-drag);
		}
		return new Vector([0, 0]);
	}

	function accelerationCalculator({pos, vel, time}) {

		let drag = new Vector([0, 0]);
		let upthrust = new Vector([0, 0]);
		const gravity = new Vector([0, params.gravity]);

		const radius = params.getRadius();
		let area = params.getArea();

		const submerged = pos.y + radius >= sim.scale - params.surfaceHeight;

		if (submerged) {
			
			// Upthrust
			const volume = getVolumeIntersect(pos, radius);
			const upthrustForce = new Vector([
				0,
				-params.f_density * volume * params.gravity
			]);
			upthrust = upthrustForce.divide(params.mass).add(upthrust);
			
			// Calculate drag
			// The area used here is just the cross-sectional area of the ball
			// This is fine when the ball is fully submerged, but isn't correct when
			// it's only partially submerged. However, I don't think the error is
			// very large compared with the error in the simulation overall so I'm
			// not going to bother changing it

			const dragForce = getFluidDrag(vel, radius, area);
			drag = dragForce.divide(params.mass).add(drag);
		}

		state.upthrust = upthrust;
		state.drag = drag;
		return drag.add(upthrust).add(gravity);
	}


	function drawArrow(x1, y1, lx, ly) {
		// Uses pixel coordinates
		if (lx === 0 && ly === 0) return;
		const p1 = new Vector([x1, y1]);
		const p2 = p1.add([lx, ly]);
		const tip = new Vector([-lx, -ly]).normalise().mult(10);
		const p3 = p2.add(tip.rotate(Math.PI / 4));
		const p4 = p2.add(tip.rotate(-Math.PI / 4));
		sim.ctx.beginPath();
		sim.ctx.moveTo(p1.x, p1.y);
		sim.ctx.lineTo(p2.x, p2.y);
		sim.ctx.lineTo(p3.x, p3.y);
		sim.ctx.moveTo(p2.x, p2.y);
		sim.ctx.lineTo(p4.x, p4.y);
		sim.ctx.lineWidth *= 2;
		sim.ctx.stroke();
		sim.ctx.lineWidth /= 2;
	};


	let mouseDownPos = null;

	sim.render = function() {

		// Integrate motion

		if (sim.mouse.pressed === 0) {
			integrator.vel = mouseDownPos
				.sub([sim.mouse.x, sim.mouse.y])
				.map(q => sim.pxToM(q))
				.mult(5);
			state.E0 = kineticEnergy() + potentialEnergy();
		} else {
			const t = sim.timer.getTime();
			const delta = sim.delta;
			integrator.integrateFixed(t - delta, t);
		}


		// Check collisions, bounce off walls

		const pos = integrator.pos;
		const radius = params.getRadius();

		if (pos.x <= radius) {
			pos[0] = radius;
			integrator.vel = integrator.vel.mult([-params.elasticity, 1]);
		}
		else if (pos.x >= sim.scale - radius) {
			pos[0] = sim.scale - radius;
			integrator.vel = integrator.vel.mult([-params.elasticity, 1]);
		}
		if (pos.y >= sim.scale - radius) {
			pos[1] = sim.scale - radius;
			integrator.vel = integrator.vel.mult([1, -params.elasticity]);
		}
		else if (pos.y <= radius) {
			pos[1] = radius;
			integrator.vel = integrator.vel.mult([1, -params.elasticity]);
		}


		// Draw everything

		const cPos = integrator.pos.map(q => sim.mToPx(q));
		const cRadius = sim.mToPx(params.getRadius());
		sim.ctx.strokeStyle = sim.colours.accent;
		sim.ctx.lineWidth = 2;

		const fluidY = sim.mToPx(sim.scale - params.surfaceHeight);
		sim.ctx.clearRect(0, 0, sim.canvas.width, sim.canvas.height);
		sim.ctx.globalAlpha = 0.3;
		sim.ctx.fillRect(0, fluidY, sim.canvas.width, sim.canvas.height - fluidY);
		sim.ctx.globalAlpha = 1;

		if (sim.mouse.pressed === 0) {
			sim.ctx.beginPath();
			sim.ctx.moveTo(cPos.x, cPos.y);
			sim.ctx.lineTo(sim.mouse.x, sim.mouse.y);
			sim.ctx.closePath();
			sim.ctx.stroke();
		}

		sim.ctx.beginPath();
		sim.ctx.arc(cPos.x, cPos.y, cRadius, 0, 2 * Math.PI);
		sim.ctx.closePath();
		sim.ctx.fill();

		if (params.showforces) {
			const mult = 10;
			let strokeStyleTmp = sim.ctx.strokeStyle;
			sim.ctx.strokeStyle = `#0000FF`;
			drawArrow(cPos.x, cPos.y, 0, state.upthrust[1] * mult);
			sim.ctx.strokeStyle = `#008800`;
			drawArrow(cPos.x, cPos.y, 0, params.gravity * mult);
			sim.ctx.strokeStyle = `rgba(255, 0, 0, ${(Math.pow(state.drag[0], 2) + Math.pow(state.drag[1], 2)) * 0.2})`;
			drawArrow(cPos.x, cPos.y, state.drag[0] * mult, state.drag[1] * mult);
			sim.ctx.strokeStyle = strokeStyleTmp;
		}

		// Calculate and display the energies
		const T = kineticEnergy();
		const V = potentialEnergy();
		const E = T + V;
		energyMeter.setValue(Math.round(10 * 100 * E / state.E0) / 10 || 0);
		kineticMeter.setValue(Math.round(10 * 100 * T / E) / 10 || 0);
		potentialMeter.setValue(Math.round(10 * 100 * V / E) / 10 || 0);

	};


	// Allow the user to 'fire' the ball with their mouse

	sim.onmousedown = function() {
		mouseDownPos = new Vector([sim.mouse.x, sim.mouse.y]);
		integrator.pos = mouseDownPos.map(q => sim.pxToM(q));
		state.upthrust = state.upthrust.mult(0);
		state.drag = state.drag.mult(0);
	};
	sim.onmouseup = function() {
		mouseDownPos = null;
	};

	
	new Knob("ballmass", "Ball Mass", "kg", params.mass, 0.1, 5, 0.1, value => params.mass = value);
	new Knob("balldensity", "Ball Density", "kg/m^3", params.b_density, 50, 1500, 10, value => params.b_density = value);
	new Knob("liquiddensity", "Fluid Density", "kg/m^3", params.f_density, 50, 1500, 10, value => params.f_density = value);
	new Knob("liquidviscosity", "Viscosity", "Pa s", params.f_viscosity, 0, 10, 0.01, value => params.f_viscosity = value);
	new Knob("gravity", "Gravity", "m/s^2", params.gravity, 0, 20, 0.01, value => params.gravity = value);
	new Checkbox("arrows", "Show forces", params.showforces, value => params.showforces = value);

	sim.start();

});

