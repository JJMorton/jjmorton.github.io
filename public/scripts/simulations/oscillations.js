window.addEventListener("load", function() {

	'use strict';

	const sim = new Simulation();
	
	// Initial parameters
	const params = {
		density: 600, // Density of wood (ish)
		m: 10,
		k: 5,
		b: 0.1,
		d_f: 0,
		d_a: 0
		/*
		 * d_a is the amplitude of the displacement of the driver.
		 * I was going to make this the amplitude of the force, but then
		 * the displacement of the driver depended on k, giving kind of
		 * ridiculous displacements for the driver.
		 */
	};
	
	// Initial state
	const state = {
		pos: 1,
		vel: 0,
		getSize: () => Math.cbrt(params.m / params.density)
	};

	window.getAcc = function() {
		// cba to type params every time
		const k = params.k;
		const b = params.b;
		const d_a = params.d_a;
		const d_f = params.d_f;
		
		const spring_force = -k * state.pos;
		const damping_force = -b * state.vel;
		const driver_force = k * d_a * Math.cos(2 * Math.PI * d_f * sim.time);

		return (spring_force + damping_force + driver_force) / params.m;
	};

	sim.render = function() {

		/*
		 * Calculations are not done if the framerate is less than
		 * 10 per second. This is to counter the issue of the
		 * mass 'jumping' if the script goes idle for any substantial
		 * amount of time (e.g. if the user switches to another tab
		 * and back).
		 * If the rendering is running less than 10 times per
		 * second, nothing will animate. But things would get weird
		 * at very low framerates anyway.
		 */
		if (1 / sim.delta < 10) return;


		// Calculate position of mass

		state.vel += getAcc();
		state.pos += state.vel * sim.delta;

		const size = state.getSize();

		if (sim.mouse.pressed === 0) {
			state.vel = 0;
			const mousePos = Math.max(Math.min(sim.mouse.y,
				sim.percToPx(100) - sim.mToPx(size/2)),
				sim.mToPx(size/2)
			);
			state.pos = sim.pxToM(mousePos - sim.percToPx(50) - sim.mToPx(params.d_a));
		}

		const pos = sim.mToPx(state.pos) - sim.mToPx(size/2) + sim.percToPx(50) + sim.mToPx(params.d_a);
		

		// Draw everything

		sim.ctx.clearRect(0, 0, sim.canvas.width, sim.canvas.height);

		// Equilibrium line
		for (let y = sim.percToPx(50); y < sim.percToPx(100); y += sim.mToPx(1)) {
			sim.ctx.fillRect(0, y, sim.percToPx(10), 1);
			sim.ctx.fillText(`${Math.round((sim.pxToM(y) - sim.scale/2) * 10) / 10} m`, 0, y - 2);
		}
		for (let y = sim.percToPx(50); y > 0; y -= sim.mToPx(1)) {
			sim.ctx.fillRect(0, y, sim.percToPx(10), 1);
		}
		sim.ctx.fillRect(0, sim.percToPx(50), sim.percToPx(100), 1);

		// Mass and string
		sim.ctx.fillRect(sim.percToPx(50) - sim.mToPx(0.01), 0, sim.mToPx(0.02), pos);
		sim.ctx.fillRect(sim.percToPx(50) - sim.mToPx(size/2), pos, sim.mToPx(size), sim.mToPx(size));

		// Driver
		const d_f = params.d_f;
		const d_pos = params.d_a * (1 + Math.cos(2 * Math.PI * d_f * sim.time));
		sim.ctx.fillRect(sim.percToPx(50) - sim.mToPx(0.2), 0, sim.mToPx(0.4), sim.mToPx(d_pos));
	};

	// sim.addButton("Restart", () => sim.init());
	sim.addSlider("k", params, "k", 1, 20, 0.1);
	sim.addSlider("b", params, "b", 0, 1, 0.01);
	sim.addSlider("m", params, "m", 1, 20, 0.1);
	sim.addSlider("driving freq", params, "d_f", 0, 5, 0.01);
	sim.addSlider("driving amp", params, "d_a", 0, 0.5, 0.01);
	sim.addSlider("scale", sim, "scale", 1, 20, 1);

	sim.start();

});
