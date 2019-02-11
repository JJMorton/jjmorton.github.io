(function() {

	// A bunch of variables and functons that I'll want in all the simulations

	window.Sim = {};


	// This function should be set by the simulation
	Sim.render = null;
	Sim.init = null;
	const beginRender = function() {
	
		const time = performance.now() - Sim.timeStart;
		Sim.delta = time - Sim.time;
		Sim.time = time;

		if (Sim.render) Sim.render();
		window.requestAnimationFrame(beginRender);
	};

	
	// Get colours defined on root element in css
	style = window.getComputedStyle(document.documentElement);

	Sim.colours = {
		background: style.getPropertyValue("--background-color"),
		foreground: style.getPropertyValue("--text-color"),
		accent: style.getPropertyValue("--accent-color")
	}
	

	// This function can be called to get the canvas and its context
	Sim.start = function() {

		// Get the canvas element and context
		Sim.canvas = document.querySelector("canvas");
		Sim.ctx = Sim.canvas.getContext("2d");
		
		// Automatically resize the canvas with the window
		const resizeCanvas = function() {
			Sim.canvas.width = document.body.clientWidth;
			Sim.canvas.height = window.innerHeight / window.innerWidth * Sim.canvas.width;
		}
		resizeCanvas();
		window.addEventListener("resize", resizeCanvas);

		// Init colours
		Sim.ctx.strokeStyle = Sim.colours.accent;
		Sim.ctx.fillStyle = Sim.colours.foreground;

		// Start animation loop
		Sim.timeStart = performance.now();
		if (Sim.init) Sim.init();
		beginRender();

		// Bind to buttons
		document.getElementById("btn-reset").addEventListener("click", function() {
			Sim.timeStart = performance.now();
			if (Sim.init) Sim.init();
		});
	};

}());
