const strToElt = str => new DOMParser().parseFromString(str, "text/html").body.firstChild;

function Timer() {
	// Timer with play and pause functionality

	let timePaused = 0; // -1 -> not paused
	let offset = 0; // amounts to the amount of time spent paused
	let scale = 1; // Speed of the timer, 1 corresponds to actual time

	let userPaused = true;

	this.isPaused = true;

	this.start = function() {
		if (!this.isPaused) return;
		offset += (performance.now() - timePaused) * scale;
		timePaused = -1;
		this.isPaused = false;
	};

	this.pause = function() {
		if (this.isPaused) return;
		timePaused = performance.now();
		this.isPaused = true;
		userPaused = true;
	}

	this.getTimescale = function() {
		return scale;
	}

	this.setTimescale = function(newScale) {
		const t = this.getTime();
		scale = newScale;
		this.setTime(t);
	}

	this.getTime = function() {
		if (this.isPaused) {
			return (scale * timePaused - offset) / 1000;
		} else {
			return (scale * performance.now() - offset) / 1000;
		}
	}

	this.setTime = function(newTime) {
		// Adjust offset such that it is now `newTime`
		const time = this.getTime();
		offset += (time - newTime) * 1000;
	}

	this.reset = function() {
		this.setTime(0);
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
		let offsetTop = elt.offsetTop;
		let offsetLeft = elt.offsetLeft;
		let parent = elt.offsetParent;
		while (parent) {
			offsetTop += parent.offsetTop;
			offsetLeft += parent.offsetLeft;
			parent = parent.offsetParent;
		}
		this.x = (pageX - offsetLeft) * window.devicePixelRatio;
		this.y = (pageY - offsetTop) * window.devicePixelRatio;
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
	window.addEventListener("touchmove", e => mousemove(e.changedTouches[0]));

	// Listeners for mouse
	elt.addEventListener("mousedown", e => {
		mousepress(e.button);
		e.preventDefault();
	});
	window.addEventListener("mouseup", () => mousepress(Mouse.buttons.NONE));
	window.addEventListener("mousemove", e => mousemove(e));
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

		this.offscreenCanvases = [];

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


	createOffscreenCanvas() {
		// Creates a separate canvas (with the 2d context) that is automatically drawn to the main canvas each frame
		// The offscreen canvases are drawn over the main canvas, in the order of their creation
		const canvas = document.createElement("canvas");
		const ctx = canvas.getContext("2d");
		const obj = {canvas, ctx};
		this.offscreenCanvases.push(obj);
		this.resize();
		return obj;
	}


	renderOffscreenCanvases() {
		for (const {canvas} of this.offscreenCanvases) {
			this.ctx.drawImage(canvas, 0, 0);
		}
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
		// Make the canvas fill its parent element
		const scaling = window.devicePixelRatio || 1;
		const width = this.canvas.parentNode.clientWidth * scaling;
		const height = this.canvas.parentNode.clientHeight * scaling;

		const resizeCanvas = (canvas, ctx) => {
			canvas.width = width;
			canvas.height = height;
			// When the window is resized, stroke and fill styles are lost so we need to set them again
			ctx.strokeStyle = this.colours.accent;
			ctx.fillStyle = this.colours.foreground;
			ctx.lineJoin = "round";
			ctx.font = "bold 0.8em sans-serif";
		};

		resizeCanvas(this.canvas, this.ctx);
		for (const {canvas, ctx} of this.offscreenCanvases) resizeCanvas(canvas, ctx);

		if (this.contextType === "webgl2" || this.contextType === "webgl") {
			this.ctx.viewport(0, 0, width, height);
		}

		this.canvas.style.width = `${width / scaling}px`;
		this.canvas.style.height = `${height / scaling}px`;

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
			const time = performance.now() / 1000;
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
	 * Render a single frame, manually
	 */

	oneshot() {
		this.render(this.ctx);
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

}


class Control {

	#value = null;
	#disabled = false;
	#onupdate = null;

	DOM = null;

	constructor(id, onupdate = () => { return; }) {
		this.#onupdate = onupdate;
		this.DOM = document.getElementById(id);
		if (!this.DOM) throw Error("Control does not exist");
	}

	onUpdate(func) {
		this.#onupdate = func;
	}

	getValue() {
		return this.#value;
	}
	setValue(val) {
		this.#value = val;
		this.#onupdate(this.#value);
		this.DOM.dispatchEvent(new Event("change"));
		return this;
	}

	isDisabled() {
		return this.#disabled;
	}
	setDisabled(val) {
		this.#disabled = val;
		this.DOM.classList[val ? "add" : "remove"]("disabled");
		return this;
	}
}

export class Button extends Control {
	constructor(id, label, onclick = undefined) {
		super(id, onclick);
		this.DOM.textContent = label;
		this.DOM.addEventListener("click", () => this.setValue(null));
	}
	setDisabled(val) {
		this.DOM.disabled = val;
		return super.setDisabled(val);
	}
	click() {
		this.DOM.click();
	}
}

export class Knob extends Control {

	// The unrounded value so that scrolling can change it at a reasonable rate
	// instead of by a step every scroll event
	#scrollValue = 0;

	constructor(id, label, units, init, min, max, step, onupdate = undefined) {
		super(id, onupdate);
		this.DOM.querySelector(".name").textContent = label;
		this.DOM.querySelector(".units").textContent = units;
		this.wheel = this.DOM.querySelector(".wheel");
		this.marker = this.DOM.querySelector(".marker");
		this.output = this.DOM.querySelector("output");
		this.min = min;
		this.max = max;
		this.step = step;

		this.#scrollValue = init;

		// Input event listener
		const listener = e => {
			let pageY = 0;
			if (e.type === "mousedown") pageY = e.pageY;
			else if (e.type === "touchstart") pageY = e.touches[0].pageY;
			else return;

			e.preventDefault();
			if (this.isDisabled()) return;
			this.wheel.classList.add("changing");

			const startY = pageY;
			const startValue = this.getValue();
			const moveListener = e => {
				const pageY = e.type === "mousemove" ? e.pageY : e.touches[0].pageY;
				let val = startValue + (this.max - this.min) * (startY - pageY) * 3 / window.screen.height;
				val = Math.min(this.max, Math.max(this.min, val));
				this.setValue(val);
			};
			const upListener = e => {
				if (e.type === "touchend" && e.touches.length !== 0) return;
				window.removeEventListener("mousemove", moveListener);
				window.removeEventListener("touchmove", moveListener);
				window.removeEventListener("mouseup", upListener);
				window.removeEventListener("touchend", upListener);
				this.wheel.classList.remove("changing");
			};
			window.addEventListener("mousemove", moveListener);
			window.addEventListener("touchmove", moveListener);
			window.addEventListener("mouseup", upListener);
			window.addEventListener("touchend", upListener);
		}
		this.wheel.addEventListener("mousedown", listener);
		this.DOM.addEventListener("touchstart", listener);

		// Change the value by scrolling
		this.wheel.addEventListener("wheel", e => {
			e.preventDefault();
			if (this.isDisabled()) return;
			const scale = (this.max - this.min) / 50;
			this.#scrollValue = Math.min(this.max, Math.max(this.min, this.#scrollValue + e.deltaY/100 * scale));
			this.setValue(this.#scrollValue);
		});

		// Reset on right click
		this.wheel.addEventListener("dblclick", e => {
			e.preventDefault();
			if (!this.isDisabled()) this.setValue(init);
		});

		this.setValue(init);
	}

	setDisabled(val) {
		return super.setDisabled(val);
	}

	updateKnob() {
		const value = this.getValue();
		this.output.textContent = value;
		this.wheel.style = `transform: rotate(${(value - this.min) / (this.max - this.min) * 2 * Math.PI}rad);`;
	}

	setValue(value) {
		value = parseFloat((this.step * Math.round(value / this.step)).toFixed(10));
		if (value === this.getValue()) return;
		super.setValue(value);
		this.#scrollValue = this.getValue();
		this.updateKnob();
		return this;
	}
}

export class ComboBox extends Control {
	constructor(id, label, onupdate = undefined) {
		super(id, onupdate);
		this.DOM.querySelector("label").textContent = label;
		this.select = this.DOM.querySelector("select");
		this.options = [];

		this.select.addEventListener("input", () => {
			this.setValue(this.options[this.select.selectedIndex].value);
		});
	}

	setDisabled(val) {
		this.select.disabled = val;
		return super.setDisabled(val);
	}

	setValue(val) {
		this.select.selectedIndex = this.options.map(o => o.value).indexOf(val);
		return super.setValue(val);
	}

	addOption({ name, value }) {
		this.options.push({ name, value });
		const option = document.createElement("option");
		option.text = name;
		this.select.add(option);
		const val = this.getValue() || this.options[0].value;
		this.setValue(val);
		return this;
	}

	clearOptions() {
		this.options = [];
		while (this.select.length) this.select.remove(0);
	}
}

export class Checkbox extends Control {
	constructor(id, label, init, onupdate = undefined) {
		super(id, onupdate);
		this.DOM.querySelector("label").textContent = label;
		this.checkbox = this.DOM.querySelector("input");
		this.setValue(init);

		this.checkbox.addEventListener("input", () => {
			this.setValue(this.checkbox.checked);
		});
	}
	setDisabled(val) {
		this.checkbox.disabled = val;
		return super.setDisabled(val);
	}
	setValue(val) {
		this.checkbox.checked = val;
		return super.setValue(val);
	}
}

export class Meter extends Control {
	constructor(id, label, units, init, min, max) {
		super(id);
		this.DOM.querySelector(".name").textContent = label;
		this.DOM.querySelector(".units").textContent = units;
		this.meter = this.DOM.querySelector("progress");
		this.output = this.DOM.querySelector("output");
		this.meter.min = min; this.meter.max = max;
		this.setValue(init);
	}
	setDisabled(val) {
		console.warn("Disabling a meter has no effect");
		return super.setDisabled(val);
	}
	setValue(val) {
		this.meter.value = val;
		this.output.textContent = val.toString();
		return super.setValue(val);
	}
}
