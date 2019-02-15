window.addEventListener("load", function() {

	'use strict';

	const sim = new Simulation();
	
	// Initial parameters
	const params = {
	};
	
	// Initial state
	const state = {
	};

	const regions = [];

	const getAcc = function() {
	};

	sim.render = function() {

		// Draw everything
		sim.ctx.clearRect(0, 0, sim.canvas.width, sim.canvas.height);
	};

	sim.start();

});
