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
		charges: [],
		selected: null // The selected charge
	};

	function createPaths(charge) {
		charge.paths = [];
		// Paths begin in a circle around the charge
		const dtheta = 2 * Math.PI / params.particlecount;
		const delta = new Vector(params.chargeradius, 0);
		for (let i = 0; i < params.particlecount; i++) {
			charge.paths.push([Vector.add(charge.pos, delta)]);
			delta.rotate(dtheta);
		}
	}

	function createCharge(x = 0, y = 0) {
		const charge = {
			pos: new Vector(x, y),
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

			//const force = { x: 0, y: 0 };
			const force = new Vector(0, 0);

			// Actually calculate the force on the particle due to the charges
			// F = q / r^2
			// Coefficients are irrelevant as only the direction of the force is needed
			for (const q of state.charges) {

				//let dx = q.pos.x - particle.pos.x;
				//const dy = q.pos.y - particle.pos.y;
				//if (dx === 0 || dy === 0) dx = params.chargeradius;
				const delta = Vector.sub(q.pos, path[path.length - 1]);

				// Avoid singularity
				if (delta.x === 0 && delta.y === 0) delta.x = params.chargeradius;

				const r2 = Math.pow(delta.x, 2) + Math.pow(delta.y, 2);
				//const forcemag = particlecharge * q.strength / r2;
				//force.x += forcemag * dx;
				//force.y += forcemag * dy;
				force.add(delta.normalise().scale(particlecharge * q.strength / r2));
			}

			// const forcemag = Math.sqrt(Math.pow(force.x, 2) + Math.pow(force.y, 2));
			// if (forcemag === 0) continue;
			// const scalefactor = params.stepsize / forcemag;
			// force.x *= scalefactor; force.y *= scalefactor;
			if (force.normalise() === null) continue;
			force.scale(params.stepsize);

			// particle.path.push({ x: particle.pos.x, y: particle.pos.y });
			// particle.pos.x += force.x; particle.pos.y += force.y;
			path.push(Vector.add(path[path.length - 1], force));
		}
	};

	sim.render = function() {
		const c = sim.ctx;
		c.clearRect(0, 0, c.canvas.width, c.canvas.height);

		for (const charge of state.charges) {
			addToPaths(charge);
		}

		// Draw paths
		for (const charge of state.charges) {
			c.beginPath();
			for (const path of charge.paths) {
				const start = path[0];
				c.moveTo(sim.mToPx(start.x), sim.mToPx(start.y));
				for (let i = 1; i < path.length; i++) {
					const p = path[i];
					c.lineTo(sim.mToPx(p.x), sim.mToPx(p.y));
				}
			}
			c.stroke();
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

	};

	// Create the controls
	{
		const sliderStrength = sim.addSlider("Magnitude of charge", "C", 0, -2, 2, 0.01, value => {
			if (!state.selected) return;
			state.selected.strength = value
			state.charges.forEach(charge => createPaths(charge));
		});
		const comboSelect = sim.addComboBox("Selected charge", index => {
			state.selected = index >= 0 ? state.charges[index] : null;
			if (!state.selected) return;
			sliderStrength.setValue(state.selected.strength);
		});
		const buttonCreate = sim.addButton("Create charge", () => {
			state.charges.forEach(charge => createPaths(charge));
			state.charges.push(createCharge(Math.random() * sim.scale, Math.random() * sim.scale));
			comboSelect.setOptions(state.charges.map((charge, i) => `Charge ${i + 1}`));
			comboSelect.setValue(state.charges.length - 1);
		});
		const buttonRemove = sim.addButton("Remove selected charge", () => {
			if (!state.selected) return;
			state.charges.forEach(charge => createPaths(charge));
			state.charges.splice(state.charges.indexOf(state.selected), 1);
			comboSelect.setOptions(state.charges.map((charge, i) => `Charge ${i + 1}`));
		});
		sim.onmousedown = function() {
			if (!state.selected) return;
			state.selected.pos = new Vector(sim.pxToM(sim.mouse.x), sim.pxToM(sim.mouse.y));
			state.charges.forEach(charge => createPaths(charge));
		};

		buttonCreate.appendToDOM();
		buttonRemove.appendToDOM();
		comboSelect.appendToDOM();
		sliderStrength.appendToDOM();
	}

	sim.start();

});

