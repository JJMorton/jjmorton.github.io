window.addEventListener("load", function() {

	'use strict';

	const sim = new Simulation();

	const params = {
		g: 9.81,
		m: 0.5,
		k: 5.0,
		l: 0.8,
		timestep: 0.01,
		traillength: 500,
		trailstep: 3,
		showtrail: true
	};

	const state = {
		lastupdate: 0,
		theta: 0.8,
		omega: 0,
		x: params.m * params.g / params.k,
		vx: 0,
		trail: []
	};

	function getPivot() {
		return [sim.pxToM(sim.canvas.width / 2), sim.pxToM(sim.canvas.height / 8)];
	}

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

	sim.render = function() {

		const time = sim.timer.getTime();

		if (sim.mouse.pressed === 0) {
			const [piv_x, piv_y] = getPivot();
			const x = sim.pxToM(sim.mouse.x) - piv_x;
			const y = sim.pxToM(sim.mouse.y) - piv_y;
			const dist = Math.sqrt(x*x + y*y);
			state.omega = 0;
			state.theta = Math.atan2(x, y);
			state.x = dist - params.l;
			state.vx = 0;
			state.trail = [];
			state.lastupdate = time;
		} else {
			// Make sure that we recalculate the angle in time steps no larger than params.timestep
			const divisions = Math.ceil((time - state.lastupdate) / params.timestep);
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

		const [midx, midy] = getPivot();
		// const midx = sim.pxToM(sim.canvas.width / 2);
		// const midy = sim.pxToM(sim.canvas.height / 10);

		const x = (params.l + state.x) * Math.sin(state.theta) + midx;
		const y = (params.l + state.x) * Math.cos(state.theta) + midy;
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

	sim.start();

});
