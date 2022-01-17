const strToElt = str => new DOMParser().parseFromString(str, "text/html").body.firstChild;

function Timer() {
	// Timer with play and pause functionality

	let timePaused = 0; // -1 -> not paused
	let offset = 0; // amounts to the amount of time spent paused

	let userPaused = true;

	this.isPaused = true;

	this.start = function() {
		if (!this.isPaused) return;
		offset += performance.now() - timePaused;
		timePaused = -1;
		this.isPaused = false;
	};

	this.pause = function() {
		if (this.isPaused) return;
		timePaused = performance.now();
		this.isPaused = true;
		userPaused = true;
	}

	this.getTime = function() {
		if (this.isPaused) {
			return (timePaused - offset) / 1000;
		} else {
			return (performance.now() - offset) / 1000;
		}
	}

	this.reset = function() {
		offset = performance.now();
		timePaused = 0;
	}

	document.addEventListener("visibilitychange", () => {
		if (document.visibilityState === "visible") {
			if (!userPaused) this.start();
		} else if (!this.isPaused) {
			this.pause();
			userPaused = false;
		}
	});
}

export function Mouse(elt, onclick) {
	// Tracks mouse position relative to element 'elt'

	this.pressed = Mouse.buttons.NONE;
	this.x = 0;
	this.y = 0;

	// These two functions are called from the event listeners when needed
	const mousemove = ({ pageX, pageY }) => {
		this.x = pageX - elt.offsetLeft;
		this.y = pageY - elt.offsetTop;
	};
	const mousepress = button => {
		if (Object.values(Mouse.buttons).includes(button)) {
			this.pressed = button;
			onclick(button);
		} else {
			// Ignore buttons that we don't care abouut
			this.pressed = Mouse.buttons.NONE;
		}
	};

	// Listeners for touchscreen
	elt.addEventListener("touchstart", e => {
		mousemove(e.changedTouches[0]);
		mousepress(Mouse.buttons.LEFT);
		e.preventDefault();
	});
	window.addEventListener("touchend", () => mousepress(Mouse.buttons.NONE));
	elt.addEventListener("touchmove", e => mousemove(e.changedTouches[0]));

	// Listeners for mouse
	elt.addEventListener("mousedown", e => {
		mousepress(e.button);
		e.preventDefault();
	});
	window.addEventListener("mouseup", () => mousepress(Mouse.buttons.NONE));
	elt.addEventListener("mousemove", e => mousemove(e));
}

Mouse.buttons = {
	NONE: -1,
	LEFT: 0,
	MIDDLE: 1,
	RIGHT: 2
};

export class Simulation {

	constructor(contextType = "2d") {
		// This function should be set by the simulation using this class
		this.render = null;

		// Get the canvas element and drawing context
		this.contextType = contextType;
		this.canvas = document.querySelector("canvas");
		this.ctx = this.canvas.getContext(contextType);

		// Get colours defined on root element in css
		const style = window.getComputedStyle(document.documentElement);
		this.colours = {
			background: style.getPropertyValue("--background-color"),
			foreground: style.getPropertyValue("--text-color"),
			accent: style.getPropertyValue("--accent-color")
		};

		// The number of metres that the canvas should cover.
		this.scale = 5;

		// Track the user's mouse
		this.mouse = new Mouse(this.canvas, button => {
			if (button === Mouse.buttons.NONE) {
				if (this.onmouseup) this.onmouseup();
			} else if (button === Mouse.buttons.LEFT) {
				if (this.onmousedown) this.onmousedown();
			}
		});

		// Track time and time between frames
		this.timer = new Timer();
		this.frame = 0;
		this.delta = 0;

		// Automatically resize the canvas with the window
		this.resize();
		window.addEventListener("resize", () => this.resize());
	}


	createShaderProgram(vertFile, fragFile) {
		if (!(this.contextType === "webgl" || this.contextType === "webgl2"))
			throw Error("Canvas must have webgl context to add shaders");

		const gl = this.ctx;

		// Creates a shader program from vertex and fragment shader files
		return new Promise((resolve, reject) => {

			const fetchFile = path => new Promise((resolve, reject) => {
				const request = new XMLHttpRequest();
				request.addEventListener("load", () => {
					if (request.status != 200) return reject(`Failed to fetch "${path}", response status ${request.status}`);
					resolve(request.responseText);
				});
				request.addEventListener("error", reject);
				request.addEventListener("abort", reject);
				request.open("GET", path);
				request.send();
			});

			const compileShader = (gl, src, type) => {
				const shader = gl.createShader(type);
				gl.shaderSource(shader, src);
				gl.compileShader(shader);
				if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
					console.error(`Could not compile ${type === gl.VERTEX_SHADER ? "vertex" : "fragment"} shader: ${gl.getShaderInfoLog(shader)}`)
					return null;
				}
				return shader;
			};

			fetchFile(vertFile).then(vertSrc => {
				fetchFile(fragFile).then(fragSrc => {

					// We have both the shaders as source code, compile them
					const vertShader = compileShader(gl, vertSrc, gl.VERTEX_SHADER);
					const fragShader = compileShader(gl, fragSrc, gl.FRAGMENT_SHADER);
					if (!vertShader || !fragShader) return reject("Failed to compile shaders, aborting");

					// Shaders compiled correctly, create and link program
					const program = gl.createProgram();
					gl.attachShader(program, vertShader);
					gl.attachShader(program, fragShader);
					gl.linkProgram(program);
					if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
						return reject(`Failed to link shader program: ${gl.getProgramInfoLog(program)}`)
					}

					// done :)
					resolve(program)

				}).catch(reject);
			}).catch(reject);

		});
	}


	resize() {
		const size = Math.min(window.innerHeight * 0.73, document.querySelector("#content").clientWidth) - 60;
		this.canvas.width = size;
		this.canvas.height = size;

		// When the window is resized, stroke and fill styles are lost so we need to set them again
		this.ctx.strokeStyle = this.colours.accent;
		this.ctx.fillStyle = this.colours.foreground;
		this.ctx.lineJoin = "round";
		this.ctx.font = "bold 0.8em sans-serif";

		if (this.contextType === "webgl2" || this.contextType === "webgl") {
			this.ctx.viewport(0, 0, size, size);
		}

		return this.canvas;
	}


	withCanvasState(f) {
		this.ctx.save();
		f();
		this.ctx.restore();
	}


	/*
	 * A wrapper for the main animation loop
	 */

	start() {

		let prevTime = 0;
		this.delta = 0;

		const render = () => {
			// We want all the units in seconds, to make other units more realistic
			const time = this.timer.getTime();
			this.delta = time - prevTime;
			prevTime = time;

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
			if (this.render && 1 / this.delta >= 10) {
				this.render(this.ctx);
				this.frame++;
			}
			window.requestAnimationFrame(render);
		}

		// Start animation loop
		this.timer.start();
		window.requestAnimationFrame(render);
	}


	/*
	 * Conversions between different length units
	 */
	
	mToPx(metres) {
		return this.canvas.height * metres / this.scale;
	}
	pxToM(px) {
		return px / this.canvas.height * this.scale;
	}
	percToPx(perc) {
		return this.canvas.height * perc / 100;
	}
	pxToPerc(px) {
		return px / this.canvas.height * 100;
	}
	percToM(perc) {
		return this.pxToM(this.percToPx(perc));
	}
	mToPerc(m) {
		return this.pxToPerc(this.mToPx(m));
	}


	/*
	 * Methods to add various types of controls to the DOM
	 */

	addButton(id, label, onclick) {
		const btn = document.getElementById(id);
		if (!btn) return null;
		btn.textContent = label;
		const control = {
			DOM: btn,
			click: () => btn.click(),
			set disabled(value) {
				btn.disabled = value;
			}
		};
		btn.addEventListener("click", onclick.bind(control));
		return control;
	}

	/*
	 * The following controls all return an object with a getter and setter
	 * for the control's relevant value, and potentially other useful methods.
	 * The setter simulates a user interaction so calls the 'onupdate' callback
	 */

	addSlider(id, label, units, init, min, max, step, onupdate) {
		// A slider that can be used to choose a float value

		// Get DOM elements
		const outer = document.getElementById(id);
		if (!outer) return null;
		outer.querySelector(".name").textContent = label;
		outer.querySelector(".units").textContent = units;
		const slider = outer.querySelector("input");
		const output = outer.querySelector("output");
		slider.min = min; slider.max = max; slider.step = step; slider.value = init;
		output.value = init;
		
		// External control
		let value = init;
		const control = {};
		onupdate = onupdate.bind(control);
		control.DOM = slider;
		control.getValue = () => value;
		control.setValue = newValue => {
			slider.value = newValue;
			output.textContent = newValue;
			value = newValue;
			onupdate(value);
			return control;
		}
		
		// Show the slider when the label is clicked
		outer.addEventListener("click", e => {
			if (e.target === slider) return;
			// Toggle clicked label and contract all others
			document.querySelectorAll(".slider").forEach(x => x.classList[
				x === outer ? "toggle" : "remove"
			]("expanded"));
		});

		// Input event listener
		slider.addEventListener("input", e => {
			output.textContent = e.target.valueAsNumber;
			onupdate(e.target.valueAsNumber);
		});

		return control;
	}

	addComboBox(id, label, onupdate) {

		// Create DOM elements
		const outer = document.getElementById(id);
		if (!outer) return null;
		outer.querySelector("label").textContent = label;
		const select = outer.querySelector("select");

		// External control
		const control = {};
		control.DOM = select,
		control.getValue = () => select.selectedIndex;
		control.setValue = newValue => {
			select.selectedIndex = newValue;
			onupdate(select.selectedIndex);
			return control;
		}
		control.setOptions = labels => {
			// Clear existing options
			while (select.length > 0) select.remove(0);
			// Add new options
			labels.map(label => {
				const option = document.createElement("option");
				option.text = label;
				return option;
			}).forEach(option => select.add(option));
			// Emit update
			onupdate(select.selectedIndex);
			return control;
		}

		// Event listener
		select.addEventListener("input", () => onupdate(select.selectedIndex));

		return control;
	}

	addCheckbox(id, label, init, onupdate) {

		// Create DOM elements
		const outer = document.getElementById(id);
		outer.querySelector("label").textContent = label;
		const checkbox = outer.querySelector("input");
		checkbox.checked = init;

		// External control
		const control = {};
		control.DOM = checkbox;
		control.getValue = () => checkbox.checked;
		control.setValue = newValue => {
			checkbox.checked = newValue;
			onupdate(checkbox.checked);
			return control;
		}

		// Event listener
		checkbox.addEventListener("input", () => onupdate(checkbox.checked));

		return control;
	}

	addMeter(id, label, units, init, min, max) {
		// A slider that can be used to choose a float value

		// Get DOM elements
		const outer = document.getElementById(id);
		if (!outer) return null;
		outer.querySelector(".name").textContent = label;
		outer.querySelector(".units").textContent = units;
		const meter = outer.querySelector("progress");
		const output = outer.querySelector("output");
		meter.min = min; meter.max = max; meter.value = init;
		output.value = init;
		
		// External control
		let value = init;
		const control = {};
		control.DOM = meter;
		control.getValue = () => value;
		control.setValue = newValue => {
			meter.value = newValue;
			output.textContent = newValue.toString();
			value = newValue;
			return control;
		}

		return control;
	}

}

