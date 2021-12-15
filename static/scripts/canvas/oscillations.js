import {Simulation} from './main.js';
import {Vector} from './vector.js';
import * as Integrators from './integrator.js';

window.addEventListener("load", function() {

	'use strict';

	const sim = new Simulation();
	
	// Initial parameters
	const params = {
		density: 500,
		m: 0.5,
		k: 10,
		g: 9.81,
		l: 4,
		b: 0.2,
		d_f: 0, // Driver frequency
		d_a: 0.1, // Driver (position) amplitude
		d_l: 0.5, // Driver equilibrium position
		d_phi: 0, // Driver phase offset
		getSize: () => Math.cbrt(params.m / params.density)
	};

	const getDriverPos = time =>
		params.d_a * Math.cos(2 * Math.PI * params.d_f * time + params.d_phi) + params.d_l;

	const getEquilibrium = time =>
		params.l + params.m * params.g / params.k + getDriverPos(time);

	function getAcc({time, pos, vel}) {
		const d_pos = getDriverPos(time);
		const spring_force = -params.k * (pos.x - d_pos);
		const damping_force = -params.b * vel.x;
		const driver_force = 0;

		return new Vector((spring_force + damping_force + driver_force) / params.m + params.g);
	}

	const integrator = new Integrators.RK4Integrator(getAcc, [1], [0], 0.1);

	sim.render = function() {

		// Integrate motion
		const time = sim.timer.getTime();
		integrator.integrateFixed(time - sim.delta, time);

		const size = params.getSize();

		if (sim.mouse.pressed === 0) {
			integrator.vel[0] = 0;
			integrator.pos[0] = sim.pxToM(sim.mouse.y) - size/2 - params.l;
		}


		// Draw everything
		sim.ctx.clearRect(0, 0, sim.canvas.width, sim.canvas.height);

		// Ruler
		for (let y = sim.mToPx(1); y < sim.percToPx(100); y += sim.mToPx(1)) {
			sim.ctx.fillRect(0, y, sim.percToPx(10), 1);
			sim.ctx.fillText(`${Math.round(sim.pxToM(y) * 10) / 10} m`, 5, y - 3);
		}

		sim.withCanvasState(() => {
			const equilib = sim.mToPx(getEquilibrium(time));
			sim.ctx.setLineDash([5, 5]);
			sim.ctx.strokeStyle = sim.ctx.fillStyle;
			sim.ctx.beginPath();
			sim.ctx.moveTo(0, equilib);
			sim.ctx.lineTo(sim.percToPx(100), equilib);
			sim.ctx.stroke()
			sim.ctx.fillText('equilibrium', sim.percToPx(15), equilib - 3);
		});

		// Mass and string
		sim.withCanvasState(() => {
			const pos = sim.mToPx(integrator.pos[0] + params.l);
			const d_pos = sim.mToPx(getDriverPos(time));
			const numLoops = 19;
			const springRadius = sim.mToPx(0.15);
			sim.ctx.beginPath();
			sim.ctx.moveTo(sim.percToPx(50) + springRadius, d_pos);
			for (let i = 0; i <= numLoops; i++) {
				const y = d_pos + i * (pos - d_pos) / numLoops;
				const dx = springRadius * (2 * (i % 2) - 1);
				sim.ctx.lineTo(sim.percToPx(50) + dx, y);
			}
			sim.ctx.lineTo(sim.percToPx(50), pos);
			sim.ctx.lineWidth = Math.sqrt(params.k);
			sim.ctx.stroke();
			sim.ctx.fillRect(sim.percToPx(50) - sim.mToPx(size/2), pos - sim.mToPx(size/2), sim.mToPx(size), sim.mToPx(size));

			// Driver
			sim.ctx.fillRect(sim.percToPx(50) - sim.mToPx(0.2), 0, sim.mToPx(0.4), d_pos);
		});
	};

	sim.scale = 8;

	sim.addSlider("springconstant", "Spring Constant", "N/m", params.k, 2, 20, 0.1, value => params.k = value);
	sim.addSlider("damping", "Damping", "kg/s", params.b, 0, 2, 0.01, value => params.b = value);
	sim.addSlider("mass", "Mass", "kg", params.m, 0.1, 5, 0.1, value => params.m = value);
	sim.addSlider("frequency", "Driving Frequency", "Hz", params.d_f, 0, 5, 0.01, value => {
		params.d_phi += sim.timer.getTime() * 2 * Math.PI * (params.d_f - value);
		params.d_f = value;
	});
	sim.addSlider("amplitude", "Driving Amplitude", "m", params.d_a, 0, 0.2, 0.01, value => params.d_a = value);
	sim.addSlider("scale", "Viewing Scale", "m", sim.scale, 3, 20, 0.1, value => sim.scale = value);

	sim.start();

});
