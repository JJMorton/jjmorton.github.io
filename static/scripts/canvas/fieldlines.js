import {Simulation, Button, Knob} from './main.js';
import {Vector} from './vector.js';

window.addEventListener("load", function() {

	'use strict';

	const sim = new Simulation();

	const params = {
		particlecount: 30,
		stepcount: 1000,
		stepsize: 0.02,
		chargeradius: 0.05
	};

	const state = {
		fullrender: true,
		partialrender: 0,
		charges: [],
		moving: false,
		selected: null // The selected charge
	};

	function createPaths(charge) {
		charge.paths = [];
		// Paths begin in a circle around the charge
		const dtheta = 2 * Math.PI / params.particlecount;
		let delta = new Vector([params.chargeradius, 0]);
		for (let i = 0; i < params.particlecount; i++) {
			charge.paths.push([delta.add(charge.pos)]);
			delta = delta.rotate(dtheta);
		}
	}

	function createCharge(x = 0, y = 0) {
		const charge = {
			pos: new Vector([x, y]),
			strength: 1.0,
			paths: [] // Each path is an array of vectors
		};

		createPaths(charge);

		return charge;
	}

	function addToPaths(charge) {
		// Adds one step to every particle's path
		const particlecharge = -Math.sign(charge.strength);

		for (const path of charge.paths) {

			// Stop adding to paths when reached max length
			if (path.length >= params.stepcount) continue;

			let force = new Vector([0, 0]);

			// Actually calculate the force on the particle due to the charges
			// F = q / r^2
			// Coefficients are irrelevant as only the direction of the force is needed
			for (const q of state.charges) {

				const delta = q.pos.sub(path[path.length - 1]);

				// Avoid singularity
				if (delta.x === 0 && delta.y === 0) delta.x = params.chargeradius;

				const r2 = Math.pow(delta.x, 2) + Math.pow(delta.y, 2);
				force = force.add(delta.normalise().mult(particlecharge * q.strength / r2));
			}

			const forcemag = force.getSize();
			if (forcemag === 0) continue;
			force = force.mult(params.stepsize / forcemag);

			path.push(force.add(path[path.length - 1]));
		}
	};

	sim.render = function() {
		const c = sim.ctx;
		if (state.fullrender) c.clearRect(0, 0, c.canvas.width, c.canvas.height);

		if (!state.moving) {
			for (const charge of state.charges) {
				addToPaths(charge);
			}

			// Draw paths
			for (const charge of state.charges) {
				c.beginPath();
				for (const path of charge.paths) {
					const starti = state.fullrender ? 0 : path.length - 2;
					const start = path[starti];
					c.moveTo(sim.mToPx(start.x), sim.mToPx(start.y));
					for (let i = starti + 1; i < path.length; i++) {
						const p = path[i];
						c.lineTo(sim.mToPx(p.x), sim.mToPx(p.y));
					}
				}
				c.stroke();
			}
		}

		if (state.moving) {
			state.selected.pos = new Vector([sim.pxToM(sim.mouse.x), sim.pxToM(sim.mouse.y)]);
		}

		// Draw charges
		for (const charge of state.charges) {
			c.beginPath();
			c.arc(sim.mToPx(charge.pos.x), sim.mToPx(charge.pos.y), sim.mToPx(params.chargeradius), 0, 2 * Math.PI);
			c.closePath();
			const red = Math.floor(Math.max(charge.strength, 0) * 255 / 2);
			const blue = Math.floor(Math.min(charge.strength, 0) * -255 / 2);
			c.fillStyle = `rgb(${red}, 0, ${blue})`;
			c.fill();
		}

		// Circle selected charge
		if (state.selected) {
			c.beginPath();
			c.arc(sim.mToPx(state.selected.pos.x), sim.mToPx(state.selected.pos.y), sim.mToPx(params.chargeradius * 1.5), 0, 2 * Math.PI);
			const prevWidth = c.lineWidth;
			c.lineWidth = 3;
			c.stroke();
			c.lineWidth = prevWidth;
		}

		state.fullrender = state.moving;
	};

	window.addEventListener("resize", () => state.fullrender = true);

	// Create the controls
	{
		const sliderStrength = new Knob("strength", "Magnitude of selected charge", "C", 0, -2, 2, 0.01, value => {
			if (!state.selected) return;
			state.selected.strength = value
			state.charges.forEach(charge => createPaths(charge));
			state.fullrender = true;
		});
		const selectCharge = charge => {
			state.selected = charge;
			sliderStrength.setValue(charge.strength);
		};
		const buttonCreate = new Button("create", "Create charge", () => {
			state.charges.forEach(charge => createPaths(charge));
			state.charges.push(createCharge(Math.random() * sim.scale, Math.random() * sim.scale));
			selectCharge(state.charges[state.charges.length - 1]);
			state.fullrender = true;
		});
		const buttonRemove = new Button("remove", "Remove selected charge", () => {
			if (!state.selected) return;
			state.charges.forEach(charge => createPaths(charge));
			state.charges.splice(state.charges.indexOf(state.selected), 1);
			selectCharge(state.charges[0]);
			state.fullrender = true;
		});
		sim.onmousedown = function() {
			const mousePos = { x: sim.pxToM(sim.mouse.x), y: sim.pxToM(sim.mouse.y) };
			const clicked = state.charges.filter(c => Math.pow(mousePos.x - c.pos.x, 2) + Math.pow(mousePos.y - c.pos.y, 2) <= Math.pow(params.chargeradius * 2, 2))
			if (clicked.length > 0) selectCharge(clicked[0]);
			if (!state.selected) return;
			state.moving = true;
			state.fullrender = true;
		};
		sim.onmouseup = function() {
			state.moving = false;
			state.charges.forEach(charge => createPaths(charge));
			state.fullrender = true;
		};

		// Add two initial charges
		buttonCreate.click(); buttonCreate.click();
		sliderStrength.setValue(-1);

	}

	sim.start();

});

