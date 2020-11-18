window.addEventListener("load", function() {

	'use strict';

	const sim = new Simulation();

	const params = {
		g: 9.81,
		m: 0.5,
		k: 5.0,
		l: 0.4
	};

	const state = {
		lastupdate: 0,
		theta: 0.8,
		omega: 0,
		x: params.m * params.g / params.k,
		vx: 0
	};

	function eom_theta(t, theta, { omega, x, vx }) {
		return omega;
	}

	function eom_omega(t, omega, { theta, x, vx }) {
		if (params.l + x < 0.01)
			return 0;
		else
			return -(2 * vx * omega + params.g * Math.sin(theta)) / (params.l + x)
	}

	function eom_x(t, x, { theta, omega, vx }) {
		return vx;
	}

	function eom_vx(t, vx, { theta, omega, x }) {
		// Replace Math.max(x, 0) with x for a spring
		return params.g * Math.cos(theta) - params.k / params.m * x + (params.l + x) * omega * omega;
	}

	// Params for this simulation:
	function rungekutta(f, x, t, tnext, params) {
		const h = tnext - t;
		const k1 = h * f(t, x, params);
		const k2 = h * f(t + h/2, x + k1/2, params);
		const k3 = h * f(t + h/2, x + k2/2, params);
		const k4 = h * f(t + h, x + k3, params);
		const xnext = x + (k1 + 2 * k2 + 2 * k3 + k4) / 6;
		return xnext;
	}

	const drawline = (x1, y1, x2, y2) => {
		sim.ctx.beginPath();
		sim.ctx.moveTo(x1, y1);
		sim.ctx.lineTo(x2, y2);
		sim.ctx.stroke();
	}

	const drawcircle = (x, y, r) => {
		sim.ctx.beginPath();
		sim.ctx.arc(x, y, r, 0, 2 * Math.PI);
		sim.ctx.fill();
	}

	const TIME_STEP = 0.01;
	sim.render = function() {

		const time = sim.timer.getTime();

		if (sim.mouse.pressed === 0) {
			const x = sim.pxToM(sim.mouse.x - sim.canvas.width / 2);
			const y = sim.pxToM(sim.mouse.y - sim.canvas.height / 2);
			const dist = Math.sqrt(x*x + y*y);
			state.omega = 0;
			state.theta = Math.atan2(x, y);
			state.x = dist - params.l;
			state.vx = 0;
			state.lastupdate = time;
		} else {
			// Make sure that we recalculate the angle in time steps no larger than TIME_STEP
			const divisions = Math.ceil((time - state.lastupdate) / TIME_STEP);
			const deltat = (time - state.lastupdate) / divisions;
			for (let t = state.lastupdate + deltat; t <= time; t += deltat) {
				state.vx = rungekutta(eom_vx, state.vx, state.lastupdate, t, state);
				state.omega = rungekutta(eom_omega, state.omega, state.lastupdate, t, state);
				state.x = rungekutta(eom_x, state.x, state.lastupdate, t, state);
				state.x = Math.max(0.2 - params.l, state.x); // Stop the pendulum from reaching the singularity in the middle
				state.theta = rungekutta(eom_theta, state.theta, state.lastupdate, t, state);
				state.lastupdate = t;
			}
		}

		const midx = sim.canvas.width / 2;
		const midy = sim.canvas.height / 2;

		const x = sim.mToPx((params.l + state.x) * Math.sin(state.theta)) + midx;
		const y = sim.mToPx((params.l + state.x) * Math.cos(state.theta)) + midy;

		sim.ctx.clearRect(0, 0, sim.canvas.width, sim.canvas.height);

		drawline(midx, midy, x, y);
		drawcircle(x, y, Math.pow(params.m * 1000, 1/3));

	}

	sim.addSlider("Scale", "m", sim.scale, 0.05, 20, 0.01, value => sim.scale = value);
	sim.addSlider("Mass", "kg", params.m, 0.01, 5, 0.01, value => params.m = value);
	sim.addSlider("Spring Constant", "N/m", params.k, 0.1, 20, 0.1, value => params.k = value);
	sim.addSlider("Equilibrium Length", "m", params.l, 0.1, 5, 0.01, value => params.l = value);
	sim.addSlider("Gravity", "m/s^2", params.g, 0, 20, 0.1, value => params.g = value);

	sim.start();

});
