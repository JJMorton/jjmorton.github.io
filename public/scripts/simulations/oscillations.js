window.addEventListener("load", function() {

	'use strict';

	const wavefunc = function(t, A, {m, k, b, phi}) {
		// First convert all parameters from s to ms
		k /= 1000000; // m s^-2
		b /= 1000; // kg s^-1

		return A * Math.exp(-(b*t) / 2*m) * Math.cos(t * Math.sqrt(k / m) + phi);
	};


	Sim.params = {
		m: 0.2, // kg
		k: 200, // N m^-1
		b: 0, // kg s^-1
	};

	Sim.state = {
		pos: 40, // Percent of height
		vel: 0
	};

	window.getAcc = function() {
		// First adjust units from s to ms
		const k = Sim.params.k / 1000000;
		const b = Sim.params.b / 1000;
		return (-k * Sim.state.pos - b * Sim.state.vel) / Sim.params.m;
	};

	Sim.init = function() {
		Sim.state.pos = 40;
		Sim.state.vel = 0;
	};

	Sim.render = function() {
		
		Sim.state.vel += getAcc();
		Sim.state.pos += Sim.state.vel;
		
		if (Sim.mouse.pressed === 0) Sim.state.pos = Math.max(Math.min(Sim.mouse.y, 90), 10) - 50;
		const pos = Sim.getLength(Sim.state.pos + 50);

		Sim.ctx.clearRect(0, 0, Sim.canvas.width, Sim.canvas.height);
		Sim.ctx.fillRect(Sim.getLength(49.5), 0, Sim.getLength(1), pos);
		Sim.ctx.fillRect(Sim.getLength(47), pos, Sim.getLength(6), Sim.getLength(6));
	};

	Sim.addButton("Restart", () => Sim.init());
	Sim.addSlider("k", Sim.params, "k", 10, 1000, 10);
	Sim.addSlider("b", Sim.params, "b", 0, 10, 0.5);
	Sim.addSlider("m", Sim.params, "m", 0.1, 3, 0.1);

	Sim.start();

});
