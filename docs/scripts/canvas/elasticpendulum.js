import {Simulation} from './main.js';
import {Vector} from './vector.js';
import * as Integrators from './integrator.js';

window.addEventListener("load", function() {

	'use strict';

	const sim = new Simulation();

	const params = {
		g: 9.81,
		m: 0.5,
		k: 5.0,
		l: 0.8,
		traillength: 500,
		trailstep: 3,
		showtrail: true
	};

	const state = {
		lastupdate: 0,
		trail: [],
		E0: 0
	};

	function acceleration({pos, vel}) {
		const [theta, x] = pos;
		const [omega, vx] = vel;
		return new Vector([
			params.l + x < 0.01
				? 0
				: -(2 * vx * omega + params.g * Math.sin(theta)) / (params.l + x),
			params.g * Math.cos(theta) - params.k / params.m * x + (params.l + x) * omega * omega
		]);
	}

	let integrator = new Integrators.RK4Integrator(
		acceleration,
		[1, params.m * params.g / params.k * 0.5],
		[0, 0],
		0.01
	);

	const energyerrorMeter = sim.addMeter("energyerror", "Divergence From Initial Energy", "%", 0, 0, 1);

	function kineticEn() {
		const [omega, vx] = integrator.vel;
		const [theta, x] = integrator.pos;
		const {m, l} = params;
		const r = l + x;
		return 0.5 * m * (r*r * omega * omega + vx * vx);
	}

	function potentialEn() {
		const {m, l, k, g} = params;
		const [theta, x] = integrator.pos;
		const r = l + x;
		const h = -r * Math.cos(theta);
		return m*g*h + 0.5 * k*x*x;
	}

	function totalEn() {
		return kineticEn() + potentialEn();
	}

	function getPivot() {
		return [sim.pxToM(sim.canvas.width / 2), sim.pxToM(sim.canvas.height / 8)];
	}

	function drawline(x1, y1, x2, y2) {
		sim.ctx.beginPath();
		sim.ctx.moveTo(x1, y1);
		sim.ctx.lineTo(x2, y2);
		sim.ctx.stroke();
	}

	function drawcircle(x, y, r) {
		sim.ctx.beginPath();
		sim.ctx.arc(x, y, r, 0, 2 * Math.PI);
		sim.ctx.fill();
	}

	sim.render = function() {

		const time = sim.timer.getTime();

		if (sim.mouse.pressed === 0) {
			const [piv_x, piv_y] = getPivot();
			const x = sim.pxToM(sim.mouse.x) - piv_x;
			const y = sim.pxToM(sim.mouse.y) - piv_y;
			const dist = Math.sqrt(x*x + y*y);
			integrator.vel = new Vector([0, 0]);
			integrator.pos[0] = Math.atan2(x, y);
			integrator.pos[1] = dist - params.l;
			state.trail = [];
			state.lastupdate = time;
			state.E0 = kineticEn() + potentialEn();
		} else {
			integrator.integrateFixed(time - sim.delta, time);
		}

		// Calculate and display the energy error
		const E = kineticEn() + potentialEn();
		energyerrorMeter.setValue(Math.round(1e5 * 100 * Math.abs(E - state.E0) / state.E0) / 1e5);

		const [midx, midy] = getPivot();

		const x = (params.l + integrator.pos[1]) * Math.sin(integrator.pos[0]) + midx;
		const y = (params.l + integrator.pos[1]) * Math.cos(integrator.pos[0]) + midy;
		state.trail.push([x, y]);
		while (state.trail.length > params.traillength) state.trail.shift();

		sim.ctx.clearRect(0, 0, sim.canvas.width, sim.canvas.height);

		if (params.showtrail) {
			for (let i = params.trailstep; i < state.trail.length - 1; i += params.trailstep) {
				sim.ctx.globalAlpha = Math.sqrt(i / state.trail.length)
				const start = state.trail[i - params.trailstep].map(q => sim.mToPx(q));
				const end = state.trail[i].map(q => sim.mToPx(q));
				drawline(start[0], start[1], end[0], end[1]);
			}
		}
		sim.ctx.globalAlpha = 1;

		const c_x = sim.mToPx(x);
		const c_y = sim.mToPx(y);
		sim.ctx.lineWidth = 2;
		drawline(sim.mToPx(midx), sim.mToPx(midy), c_x, c_y);
		sim.ctx.lineWidth = 1;
		drawcircle(c_x, c_y, Math.pow(params.m * 1000, 1/3));

	}

	sim.addSlider("m", "Mass", "kg", params.m, 0.01, 5, 0.01, value => params.m = value);
	sim.addSlider("k", "Spring Constant", "N/m", params.k, 0.1, 20, 0.1, value => params.k = value);
	sim.addSlider("l", "Equilibrium Length", "m", params.l, 0.1, 5, 0.01, value => params.l = value);
	sim.addSlider("g", "Gravity", "m/s^2", params.g, 0, 20, 0.1, value => params.g = value);
	sim.addCheckbox("trail", "Show Trail", params.showtrail, value => params.showtrail = value);
	sim.addSlider("timestep", "Integration Timestep", "s", integrator.h, 0.001, 0.1, 0.001, value => integrator.h = value);
	sim.addComboBox("method", "Integration method", opt => {
		const method = opt === 0 ? Integrators.EulerIntegrator : Integrators.RK4Integrator;
		integrator = new method(
			integrator.funcAccel,
			integrator.pos,
			integrator.vel,
			integrator.h
		);
	}).setOptions(["Euler", "Runge-Kutta (4th order)"]).setValue(1);

	state.E0 = kineticEn() + potentialEn();
	sim.start();

});
