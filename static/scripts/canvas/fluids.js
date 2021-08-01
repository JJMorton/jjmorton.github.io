window.addEventListener("load", function() {

	'use strict';

	const sim = new Simulation();

	// Initial parameters
	const params = {
		mass: 1,
		b_density: 800,
		f_density: 1000,
		f_viscosity: 0.001,
		elasticity: 0.7,
		gravity: 9.81,
		showforces: false
	};

	// Initial state
	const state = {
		pos: [ sim.percToM(50), sim.percToM(30) ],
		vel: [ 0, 0 ],
		acc: [ 0, 0 ],
		upthrust: [ 0, 0 ],
		drag: [ 0, 0 ],
		getVolume: () => params.mass / params.b_density,
		getRadius: () => Math.cbrt(3/(4 * Math.PI) * state.getVolume()),
		getArea: () => Math.PI * Math.pow(state.getRadius(), 2)
	};

	// In percentages so as to resize properly
	const regions = [
		[ 0, 50, 100, 50 ]
	];

	const getRegionIntersect = function([x, y, w, h], radius) {
		// Made complicated by handling the cases where the ball is not fully submerged
		const isAbove = state.pos[1] - radius < y;
		const isBelow = state.pos[1] + radius > y + h;
		let volume;
		if (isAbove && isBelow) {
			const r1 = Math.pow(radius, 2) - Math.pow(state.pos[1] - y, 2);
			const r2 = Math.pow(radius, 2) - Math.pow(state.pos[1] - y + h, 2);
			volume = 1/6 * Math.PI * h * (3 * r1 + 3 * r2 + Math.pow(h, 2));
		} else if (isAbove) {
			const rel_h = state.pos[1] + radius - y;
			volume = 1/3 * Math.PI * Math.pow(rel_h, 2) * (3 * radius - rel_h);
		} else if (isBelow) {
			const rel_h = y + h - state.pos[1] - radius;
			volume = 1/3 * Math.PI * Math.pow(rel_h, 2) * (3 * radius - rel_h);
		} else {
			volume = state.getVolume();
		}
		return volume;
	};

	const getFluidDrag = function([x, y, w, h], radius, area) {
		const vel2 = Math.pow(state.vel[0], 2) + Math.pow(state.vel[1], 2);
		if (vel2 > 0) {
			let drag = 6 * Math.PI * params.f_viscosity * radius
			             + 0.5 * 0.47 * params.f_density * area * Math.sqrt(vel2);
			return [-drag * state.vel[0], -drag * state.vel[1]];
		}
		return [0, 0];
	};

	const updateAcc = function() {

		state.drag = [0, 0];
		state.upthrust = [0, 0];
		const radius = state.getRadius();
		const area = state.getArea();

		regions
		.map(x => x.map(y => sim.percToM(y)))
		.forEach(([x, y, w, h]) => {

			const inside =
				x <= state.pos[0] + radius && x + w >= state.pos[0] - radius &&
				y <= state.pos[1] + radius && y + h >= state.pos[1] - radius;

			if (inside) {
				
				// Upthrust
				const volume = getRegionIntersect([x, y, w, h], radius);
				state.upthrust[1] -= params.f_density * volume * params.gravity;
				
				// Drag
				// The area used here is just the cross-sectional area of the ball
				// This is fine when the ball is fully submerged, but isn't correct when
				// it's only partially submerged. However, I don't think the error is
				// very large compared with the error in the simulation overall so I'm
				// not going to bother changing it
				const drag = getFluidDrag([x, y, w, h], radius, area);
				state.drag[0] += drag[0];
				state.drag[1] += drag[1];
			}
		});

		state.acc = [0, params.gravity];
		state.acc[0] += state.drag[0] / params.mass;
		state.acc[1] += (state.upthrust[1] + state.drag[1]) / params.mass;
	};


	const drawArrow = function(x1, y1, lx, ly) {
		// Uses pixel coordinates
		if (lx === 0 && ly === 0) return;
		let p1 = new Vector(x1, y1);
		let p2 = new Vector(x1 + lx, y1 + ly);
		let tip = new Vector(-lx, -ly).normalise().scale(10);
		let p3 = Vector.add(p2, Vector.rotate(tip, Math.PI / 4));
		let p4 = Vector.add(p2, Vector.rotate(tip, -Math.PI / 4));
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


	sim.render = function() {

		// Update acceleration
		updateAcc();

		// Calculate new position
		if (sim.mouse.pressed === 0) {
			state.vel = [0, 0]
		} else {
			state.vel[0] += state.acc[0] * sim.delta;
			state.vel[1] += state.acc[1] * sim.delta;
			state.pos[0] += state.vel[0] * sim.delta;
			state.pos[1] += state.vel[1] * sim.delta;
		}
		
		const pos = [
			sim.mToPx(state.pos[0]),
			sim.mToPx(state.pos[1])
		];
		const radius = sim.mToPx(state.getRadius());

		// Check collisions
		
		let changed = 0;
		if (pos[0] <= radius) {
			pos[0] = radius;
			changed |= 1;
			state.vel[0] *= -params.elasticity;
		}
		else if (pos[0] >= sim.canvas.width - radius) {
			changed |= 1;
			pos[0] = sim.canvas.width - radius;
			state.vel[0] *= -params.elasticity;
		}
		if (pos[1] >= sim.canvas.width - radius) {
			changed |= 2;
			pos[1] = sim.canvas.width - radius;
			state.vel[1] *= -params.elasticity;
		}
		else if (pos[1] <= radius) {
			changed |= 2;
			pos[1] = radius;
			state.vel[1] *= -params.elasticity;
		}

		if (changed & 1) state.pos[0] = sim.pxToM(pos[0]);
		if (changed & 2) state.pos[1] = sim.pxToM(pos[1]);


		// Draw everything

		sim.ctx.clearRect(0, 0, sim.canvas.width, sim.canvas.height);
		sim.ctx.globalAlpha = 0.3;
		regions
			.map(x => x.map(y => sim.percToPx(y)))
			.forEach(([ x, y, w, h ]) => sim.ctx.fillRect(x, y, w, h));
		sim.ctx.globalAlpha = 1;

		if (sim.mouse.pressed === 0) {
			sim.ctx.beginPath();
			sim.ctx.moveTo(pos[0], pos[1]);
			sim.ctx.lineTo(sim.mouse.x, sim.mouse.y);
			sim.ctx.closePath();
			sim.ctx.stroke();
		}

		sim.ctx.beginPath();
		sim.ctx.arc(pos[0], pos[1], radius, 0, 2 * Math.PI);
		sim.ctx.closePath();
		sim.ctx.fill();

		if (params.showforces) {
			let strokeStyleTmp = sim.ctx.strokeStyle;
			sim.ctx.strokeStyle = `#0000FF`;
			drawArrow(pos[0], pos[1], 0, state.upthrust[1] / params.mass * 5);
			sim.ctx.strokeStyle = `#008800`;
			drawArrow(pos[0], pos[1], 0, params.gravity * 5);
			sim.ctx.strokeStyle = `rgba(255, 0, 0, ${(Math.pow(state.drag[0], 2) + Math.pow(state.drag[1], 2)) * 0.2})`;
			drawArrow(pos[0], pos[1], state.drag[0] / params.mass * 5, state.drag[1] * 5);
			sim.ctx.strokeStyle = strokeStyleTmp;
		}

	};


	// Allow the user to 'fire' the ball with their mouse
	let mouseDownPos = { x: 0, y: 0 };
	sim.onmousedown = function() {
		mouseDownPos = { x: sim.mouse.x, y: sim.mouse.y };
		state.pos = [
			sim.pxToM(sim.mouse.x),
			sim.pxToM(sim.mouse.y)
		];
	};
	sim.onmouseup = function() {
		if (!mouseDownPos.x || !mouseDownPos.y) return;
		state.vel = [
			sim.pxToM(mouseDownPos.x - sim.mouse.x) * 5,
			sim.pxToM(mouseDownPos.y - sim.mouse.y) * 5
		];
		mouseDownPos = { x: 0, y: 0 };
	};

	
	sim.addSlider("ballmass", "Ball Mass", "kg", params.mass, 0.1, 5, 0.1, value => params.mass = value);
	sim.addSlider("balldensity", "Ball Density", "kg/m^3", params.b_density, 50, 1500, 10, value => params.b_density = value);
	sim.addSlider("liquiddensity", "Liquid Density", "kg/m^3", params.f_density, 50, 1500, 10, value => params.f_density = value);
	sim.addSlider("liquidviscosity", "Liquid Viscosity", "Pa s", params.f_viscosity, 0.001, 10, 0.001, value => params.f_viscosity = value);
	sim.addSlider("gravity", "Gravitational Acceleration", "m/s^2", params.gravity, 0, 20, 0.01, value => params.gravity = value);
	sim.addCheckbox("arrows", "Show forces", params.showforces, value => params.showforces = value);
	

	sim.start();

});

