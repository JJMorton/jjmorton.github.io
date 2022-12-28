import {Simulation, Meter, Knob, ComboBox, Checkbox, Button} from './main.js';
import {Vector} from './vector.js';
import * as Integrators from './integrator.js';

window.addEventListener("load", function() {

	'use strict';

	const sim = new Simulation();

	const params = {
		g: 9.8,
		m1: 1,
		m2: 0.5,
		get r1() {return 0.05 * Math.cbrt(this.m1)},
		get r2() {return 0.05 * Math.cbrt(this.m2)},
		l1: 1,
		l2: 0.5,
		timestep: 0.01,
		trailduration: 5,
		showtrail: true
	};

	const state = {
		trail: [],
		trailtime: [],
		E0: 0, // The energy at the start of the simulation
		dragging: 0 // Which pendulum the user is dragging with their mouse
	};

	function acceleration({pos, vel}) {
		const [theta1, theta2] = pos;
		const [omega1, omega2] = vel;
		const {m1, m2, l1, l2, g} = params;
		const sin = Math.sin;
		const cos = Math.cos;
		const delta = theta2 - theta1;

		// Ouch, no way to make these equations look pretty :(
		return new Vector([
			(m2*l1*omega1*omega1*sin(delta)*cos(delta) + m2*g*sin(theta2)*cos(delta) + m2*l2*omega2*omega2*sin(delta) - (m1+m2)*g*sin(theta1))
				/ ((m1+m2)*l1 - m2*l1*cos(delta)*cos(delta)),
			(-m2*l2*omega2*omega2*sin(delta)*cos(delta) + (m1+m2)*(g*sin(theta1)*cos(delta) - l1*omega1*omega1*sin(delta) - g*sin(theta2)))
				/ ((m1+m2)*l2 - m2*l2*cos(delta)*cos(delta))
		]);
	}

	let integrator = new Integrators.RK4Integrator(
		acceleration,
		[0.8 * Math.PI, 0.9 * Math.PI],
		[0, 0],
		0.01
	);

	const energyerrorMeter = new Meter("energyerror", "Divergence From Initial Energy", "%", 0, 0, 1);
	const kineticMeter = new Meter("kinetic", "Kinetic Energy", "%", 0, 0, 100);
	const potentialMeter = new Meter("potential", "Potential Energy", "%", 0, 0, 100);

	function kineticEn() {
		const {m1, m2, l1, l2, g} = params;
		const [theta1, theta2, omega1, omega2] = [...integrator.pos, ...integrator.vel];
		const cos = Math.cos;
		const T = 0.5*m1*l1*l1*omega1*omega1 + 0.5*m2*(l1*l1*omega1*omega1 + l2*l2*omega2*omega2 + 2*l1*l2*omega1*omega2*cos(theta2 - theta1));
		return T;
	}

	function potentialEn() {
		const {m1, m2, l1, l2, g} = params;
		const [theta1, theta2] = integrator.pos;
		const cos = Math.cos;
		const V = -(m1 + m2)*g*l1*cos(theta1) - m2*g*l2*cos(theta2) + (m1 + m2)*g*l1 + m2*g*l2;
		return V;
	}

	function totalEn() {
		return kineticEn() + potentialEn();
	}

	function init() {
		sim.timer.pause();
		sim.scale = 2.2 * (params.l1 + params.l2);
		state.E0 = totalEn();
		integrator.vel = new Vector([0, 0]);
		state.trail = [];
		state.trailtime = [];
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
		const pivot = new Vector([sim.canvas.width / 2, sim.canvas.height / 2]).map(q => sim.pxToM(q));
		
		// The actual integration of the eom
		const shouldUpdate = state.dragging === 0 && !sim.timer.isPaused;
		if (shouldUpdate) integrator.integrateFixed(time - sim.delta, time);

		// Positions of the masses
		const pos1 = new Vector([Math.sin(integrator.pos[0]), Math.cos(integrator.pos[0])]).mult(params.l1).add(pivot);
		const pos2 = new Vector([Math.sin(integrator.pos[1]), Math.cos(integrator.pos[1])]).mult(params.l2).add(pos1);

		// User can drag around the masses
		if (sim.mouse.pressed === 0) {
			const mouse = new Vector([sim.mouse.x, sim.mouse.y]).map(q => sim.pxToM(q));
			// Check to see if the user has clicked within a mass
			if (state.dragging === 0) {
				const r1 = mouse.sub(pos1).getSize();
				const r2 = mouse.sub(pos2).getSize();
				if (r1 < params.r1 * 2) state.dragging = 1;
				else if (r2 < params.r2 * 2) state.dragging = 2;
			}
			if (state.dragging === 1) {
				const theta = Math.atan2(...mouse.sub(pivot));
				integrator.pos[0] = theta;
				init();
			} else if (state.dragging === 2) {
				const toMouse = mouse.sub(pos1);
				const theta = Math.atan2(...toMouse);
				integrator.pos[1] = theta;
				init();
			}
		} else {
			state.dragging = 0;
		}

		// Calculate and display the energies
		const T = kineticEn();
		const V = potentialEn();
		const E = T + V;
		energyerrorMeter.setValue(Math.round(1e5 * 100 * Math.abs(E - state.E0) / state.E0) / 1e5);
		kineticMeter.setValue(Math.round(10 * 100 * T / E) / 10);
		potentialMeter.setValue(Math.round(10 * 100 * V / E) / 10);

		// Add to the trail
		if (shouldUpdate){
			state.trail.push(pos2);
			state.trailtime.push(time);
			while (state.trailtime[0] < time - params.trailduration) {
				state.trailtime.shift();
				state.trail.shift();
			}
		}

		sim.ctx.clearRect(0, 0, sim.canvas.width, sim.canvas.height);

		// Draw the trail
		sim.ctx.lineWidth = 3;
		sim.ctx.strokeStyle = sim.colours.accent;
		if (params.showtrail && state.trail.length > 0) {
			for (let i = 1; i < state.trail.length; i++) {
				sim.ctx.globalAlpha = 1 - Math.pow((time - state.trailtime[i]) / params.trailduration, 4);
				const start = state.trail[i-1].map(q => sim.mToPx(q));
				const end = state.trail[i].map(q => sim.mToPx(q));
				drawline(...start, ...end);
			}
			sim.ctx.globalAlpha = 1;
		}

		// Draw the pendulum
		sim.ctx.lineWidth = 3;
		sim.ctx.strokeStyle = sim.colours.foreground;
		const pivot_px = pivot.map(q => sim.mToPx(q));
		const pos1_px = pos1.map(q => sim.mToPx(q));
		const pos2_px = pos2.map(q => sim.mToPx(q));
		drawline(...pivot_px, ...pos1_px);
		drawline(...pos1_px, ...pos2_px);
		drawcircle(...pivot_px, sim.mToPx(0.02));
		drawcircle(...pos1_px, sim.mToPx(params.r1));
		drawcircle(...pos2_px, sim.mToPx(params.r2));
	}

	new Knob("m1", "Mass 1", "kg", params.m1, 0.1, 3, 0.01, value => {
		params.m1 = value;
		init();
	});
	new Knob("m2", "Mass 2", "kg", params.m2, 0.1, 3, 0.01, value => {
		params.m2 = value;
		init();
	});
	new Knob("l1", "Length 1", "m", params.l1, 0.1, 3, 0.01, value => {
		params.l1 = value;
		init();
	});
	new Knob("l2", "Length 2", "m", params.l2, 0.1, 3, 0.01, value => {
		params.l2 = value;
		init();
	});
	new Knob("g", "Gravity", "m/s^2", params.g, 0.1, 20, 0.1, value => {
		params.g = value;
		init();
	});
	new Checkbox("trail", "Show Trail", params.showtrail, value => params.showtrail = value);
	new Knob("timestep", "Integration Timestep", "s", integrator.h, 0.001, 0.1, 0.001, value => integrator.h = value);
	new Button("playpause", "Play/Pause", () => {
		if (sim.timer.isPaused) {
			sim.timer.start();
		} else {
			sim.timer.pause();
		}
	});

	new ComboBox("method", "Integration method", method => {
		integrator = new (method)(
			integrator.funcAccel,
			integrator.pos,
			integrator.vel,
			integrator.h
		);
	}).addOption({name: "Euler", value: Integrators.EulerIntegrator})
	  .addOption({name: "Runge-Kutta (4th order)", value: Integrators.RK4Integrator})
	  .setValue(Integrators.RK4Integrator);

	sim.start();
	init();

});
