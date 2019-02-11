window.addEventListener("load", function() {

	'use strict';


	const wavefunc = function(t, A, {m, k, b, phi}) {
		// First convert all parameters from s to ms
		k /= 1000000; // m s^-2
		b /= 1000; // kg s^-1

		return A * Math.exp(-(b*t) / 2*m) * Math.cos(t * Math.sqrt(k / m) + phi);
	};


	Sim.params = {
		m: 1, // kg
		k: 200, // N m^-1
		b: 1, // kg s^-1
		phi: 0
	};

	Sim.init = function() {
	};

	Sim.render = function() {
		Sim.ctx.clearRect(0, 0, Sim.canvas.width, Sim.canvas.height);
		const pos = wavefunc(Sim.time, Sim.canvas.height/2, Sim.params) + Sim.canvas.height / 2;
		Sim.ctx.fillRect(Sim.canvas.width / 2 - 5, pos, 10, 10);
	};

	Sim.start();

});
