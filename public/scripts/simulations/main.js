(function() {

	// A bunch of variables and functons that I'll want in all the simulations

	window.Sim = {};
	

	// Get colours defined on root element in css
	style = window.getComputedStyle(document.documentElement);

	Sim.colours = {
		background: style.getPropertyValue("--background-color"),
		foreground: style.getPropertyValue("--text-color"),
		accent: style.getPropertyValue("--accent-color")
	};
	

	Sim.getLength = percent => Sim.canvas.height * percent / 100;


	Sim.addButton = function(label, func) {
		const container = document.getElementById("controls");
		const btn = document.createElement("button");
		btn.textContent = label;
		btn.addEventListener("click", func);
		container.appendChild(btn);
	};

	Sim.addSlider = function(label, obj, prop, min, max, step) {
		const container = document.getElementById("controls");
		const slider = document.createElement("input");
		slider.setAttribute("type", "range");
		slider.min = min;
		slider.max = max;
		slider.step = step;
		slider.addEventListener("input", () => obj[prop] = parseFloat(slider.value));
		slider.textContent = label;
		container.appendChild(slider);
	};


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


	Sim.start = function() {

		// Get the canvas element and context
		Sim.canvas = document.querySelector("canvas");
		Sim.ctx = Sim.canvas.getContext("2d");
		
		// Automatically resize the canvas with the window
		const resizeCanvas = function() {
			const size = Math.min(window.innerHeight * 0.8, document.body.clientWidth);
			Sim.canvas.width = size;
			Sim.canvas.height = size;
		}
		resizeCanvas();
		window.addEventListener("resize", resizeCanvas);

		// Track mouse
		Sim.mouse = { pressed: -1, x: 0, y: 0 };
		Sim.canvas.addEventListener("click", e => { if (Sim.onlick) Sim.onclick(e); });
		Sim.canvas.addEventListener("mousedown", e => Sim.mouse.pressed = e.button);
		Sim.canvas.addEventListener("mouseup", e => Sim.mouse.pressed = -1);
		Sim.canvas.addEventListener("mousemove", e => {
			Sim.mouse.x = 100 * e.clientX / Sim.canvas.height;
			Sim.mouse.y = 100 * e.clientY / Sim.canvas.width;
			if (Sim.onmousemove) Sim.onmousemove(e);
		});

		// Init colours
		Sim.ctx.strokeStyle = Sim.colours.accent;
		Sim.ctx.fillStyle = Sim.colours.foreground;

		// Start animation loop
		Sim.timeStart = performance.now();
		if (Sim.init) Sim.init();
		beginRender();
	};

}());
