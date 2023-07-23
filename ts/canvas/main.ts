/**
 * Timer with play and pause functionality
 */
class Timer {

	/** Time at which the timer was paused, -1 -> not paused */
	private timePaused: number = 0;
	/** amounts to the amount of time spent paused */
	private offset: number = 0;
	/** Speed of the timer, 1 corresponds to actual time */
	private scale: number = 1;
	/** Whether the user explicitly paused the timer */
	private userPaused: boolean = true;
	/** Whether the timer is currently paused */
	private paused: boolean = true;

	// Wrapper to disallow setting pause state externally
	public get isPaused(): boolean { return this.paused; }

	public getTimescale(): number { return this.scale; }
	public setTimescale(newScale: number) {
		const t = this.getTime();
		this.scale = newScale;
		this.setTime(t);
	}

	public start() {
		if (!this.isPaused) return;
		this.offset += (performance.now() - this.timePaused) * this.scale;
		this.timePaused = -1;
		this.paused = false;
	};

	public pause() {
		if (this.isPaused) return;
		this.timePaused = performance.now();
		this.paused = true;
		this.userPaused = true;
	}

	public getTime() {
		if (this.isPaused) {
			return (this.scale * this.timePaused - this.offset) / 1000;
		} else {
			return (this.scale * performance.now() - this.offset) / 1000;
		}
	}

	public setTime(newTime: number) {
		// Adjust offset such that it is now `newTime`
		const time = this.getTime();
		this.offset += (time - newTime) * 1000;
	}

	public reset() {
		this.setTime(0);
	}

	constructor() {
		document.addEventListener("visibilitychange", () => {
			if (document.visibilityState === "visible") {
				if (!this.userPaused) this.start();
			} else if (!this.isPaused) {
				this.pause();
				this.userPaused = false;
			}
		});
	}
}

export enum MouseButton {
	NONE=-1, LEFT, MIDDLE, RIGHT
}

/**
 * Tracks mouse position relative to a DOM element
 */
export class Mouse {

	public pressed: MouseButton = MouseButton.NONE;
	public x: number = 0;
	public y: number = 0;

	/**
	 * @param elt The DOM element to track the mouse relative to
	 * @params onclick A callback function, provided with the mouse button pressed
	 */
	constructor(elt: HTMLElement, onclick: (mbutton: number) => void) {

		// These two functions are called from the event listeners when needed
		const mousemove = ({ pageX, pageY }: {pageX: number, pageY: number}) => {
			let offsetTop = elt.offsetTop;
			let offsetLeft = elt.offsetLeft;
			let parent: HTMLElement | null = elt.offsetParent;
			while (parent) {
				offsetTop += parent.offsetTop;
				offsetLeft += parent.offsetLeft;
				parent = parent.offsetParent;
			}
			this.x = (pageX - offsetLeft) * window.devicePixelRatio;
			this.y = (pageY - offsetTop) * window.devicePixelRatio;
		};
		const mousepress = (button: MouseButton) => {
			if (Object.values(MouseButton).includes(button)) {
				this.pressed = button;
				onclick(button);
			} else {
				// Ignore buttons that we don't care abouut
				this.pressed = MouseButton.NONE;
			}
		};

		// Listeners for touchscreen
		elt.addEventListener("touchstart", e => {
			mousemove(e.changedTouches[0]);
			mousepress(MouseButton.LEFT);
			e.preventDefault();
		});
		window.addEventListener("touchend", () => mousepress(MouseButton.NONE));
		window.addEventListener("touchmove", e => mousemove(e.changedTouches[0]));

		// Listeners for mouse
		elt.addEventListener("mousedown", e => {
			mousepress(e.button);
			e.preventDefault();
		});
		window.addEventListener("mouseup", () => mousepress(MouseButton.NONE));
		window.addEventListener("mousemove", e => mousemove(e));
	}
}

type AnyWebGLRenderingContext = WebGLRenderingContext | WebGL2RenderingContext
function isWebGL(ctx: RenderingContext): ctx is AnyWebGLRenderingContext {
	return (ctx instanceof WebGLRenderingContext) || (ctx instanceof WebGL2RenderingContext)
}

/**
 * A class containing logic for a 'simulation'.
 * Manages a HTML canvas, a mouse handler, a timer, etc.
 */
export class Simulation {

	/** This function should be set by the simulation using this class */
	public render: ((c: RenderingContext) => void) | null = null;
	public canvas: HTMLCanvasElement;
	public ctx: RenderingContext;
	/** The number of metres that the canvas should cover */
	public scale: number = 5;
	public mouse: Mouse;
	public timer: Timer;
	/** Current frame number */
	public frame: number;
	/** Time between current frame and previous */
	public delta: number;

	public colours: {
		background: string, foreground: string, accent: string
	} = {
		background: "#000", foreground: "#000", accent: "#000"
	}

	/** Set this to trigger it when the user lifts a mouse button */
	public onmouseup?: () => void;
	/** Set this to trigger it when the user presses down a mouse button */
	public onmousedown?: () => void;

	private offscreenCanvases: {canvas: HTMLCanvasElement, ctx: RenderingContext}[] = [];

	constructor(contextType: string = "2d") {

		// Get the canvas element and drawing context
		const canvas = document.querySelector("canvas");
		if (!canvas) throw Error("Cannot find HTMLCanvasElement");
		this.canvas = canvas;
		const ctx = this.canvas.getContext(contextType);
		if (!ctx) throw Error("Cannot find HTMLCanvasElement");
		this.ctx = ctx;

		this.recolour();
		window.addEventListener("recolour", () => this.recolour());

		this.scale = 5;

		// Track the user's mouse
		this.mouse = new Mouse(this.canvas, button => {
			if (button === MouseButton.NONE) {
				if (this.onmouseup) this.onmouseup();
			} else if (button === MouseButton.LEFT) {
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


	recolour() {
		// Get colours defined on root element in css
		const style = window.getComputedStyle(document.documentElement);
		this.colours = {
			background: style.getPropertyValue("--background-color"),
			foreground: style.getPropertyValue("--text-color"),
			accent: style.getPropertyValue("--accent-color")
		};
	}


	createOffscreenCanvas() {
		// Creates a separate canvas (with the 2d context) that is automatically drawn to the main canvas each frame
		// The offscreen canvases are drawn over the main canvas, in the order of their creation
		const canvas = document.createElement("canvas");
		const ctx = canvas.getContext("2d");
		if (!ctx) throw Error("Failed to create offscreen canvas rendering context");
		const obj = {canvas, ctx};
		this.offscreenCanvases.push(obj);
		this.resize();
		return obj;
	}


	renderOffscreenCanvases() {
		if (!(this.ctx instanceof CanvasRenderingContext2D)) {
			throw Error("Main canvas must have a context type of 2d to use an offscreen canvas");
		}
		for (const {canvas} of this.offscreenCanvases) {
			this.ctx.drawImage(canvas, 0, 0);
		}
	}


	createShaderProgram(vertFile: string, fragFile: string) {
		if (!isWebGL(this.ctx))
			throw Error("Canvas must have webgl context to add shaders");

		const gl = this.ctx;

		// Creates a shader program from vertex and fragment shader files
		return new Promise((resolve, reject) => {

			const fetchFile = (path: string): Promise<string> =>
				new Promise((resolve, reject) => {
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

			const compileShader = (gl: AnyWebGLRenderingContext, src: string, type: number) => {
				const shader = gl.createShader(type);
				if (!shader) throw Error("Failed to create shader");
				gl.shaderSource(shader, src);
				gl.compileShader(shader);
				if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
					const shaderType = type === gl.VERTEX_SHADER ? "vertex" : "fragment";
					console.error(`Could not compile ${shaderType} shader: ${gl.getShaderInfoLog(shader)}`)
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
					if (!program) throw Error("Failed to create shader program");
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
		const parent = this.canvas.parentElement;
		const width = (parent ? parent.clientWidth : window.innerWidth) * scaling;
		const height = (parent ? parent.clientHeight : window.innerHeight) * scaling;

		const resizeCanvas = (canvas: HTMLCanvasElement, ctx: RenderingContext) => {
			canvas.width = width;
			canvas.height = height;
			if (ctx instanceof CanvasRenderingContext2D) {
				// When the window is resized, stroke and fill styles are lost so we need to set them again
				ctx.strokeStyle = this.colours.accent;
				ctx.fillStyle = this.colours.foreground;
				ctx.lineJoin = "round";
				ctx.font = "bold 0.8em sans-serif";
			}
		};

		resizeCanvas(this.canvas, this.ctx);
		for (const {canvas, ctx} of this.offscreenCanvases) resizeCanvas(canvas, ctx);

		if (isWebGL(this.ctx)) {
			this.ctx.viewport(0, 0, width, height);
		}

		this.canvas.style.width = `${width / scaling}px`;
		this.canvas.style.height = `${height / scaling}px`;

		return this.canvas;
	}


	withCanvasState(f: () => void) {
		if (!(this.ctx instanceof CanvasRenderingContext2D)) {
			console.warn("Can only save canvas state with 2d context");
			f();
			return;
		}
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
		if (this.render) this.render(this.ctx);
	}


	/*
	 * Conversions between different length units
	 */
	
	mToPx(metres: number) {
		return this.canvas.height * metres / this.scale;
	}
	pxToM(px: number) {
		return px / this.canvas.height * this.scale;
	}
	percToPx(perc: number) {
		return this.canvas.height * perc / 100;
	}
	pxToPerc(px: number) {
		return px / this.canvas.height * 100;
	}
	percToM(perc: number) {
		return this.pxToM(this.percToPx(perc));
	}
	mToPerc(m: number) {
		return this.pxToPerc(this.mToPx(m));
	}

}


class Control<T, DOMT extends HTMLElement> {

	private value: T;
	private disabled = false;
	private onupdate: (val: T) => void;

	DOM: DOMT;

	constructor(id: string, init: T, onupdate = (val: T) => { return; }) {
		const DOM = document.getElementById(id);
		if (!DOM) throw Error("Control does not exist");
		// @ts-ignore WARNING: No check to make sure that the DOM element is of the specified type
		this.DOM = DOM;
		this.value = init;
		this.onupdate = onupdate;
	}

	onUpdate(func: (val: T) => void) {
		this.onupdate = func;
	}

	getValue() {
		return this.value;
	}
	setValue(val: T) {
		this.value = val;
		this.onupdate(this.value);
		this.DOM.dispatchEvent(new Event("change"));
		return this;
	}

	isDisabled() {
		return this.disabled;
	}
	setDisabled(val: boolean): Control<T, DOMT> {
		this.disabled = val;
		this.DOM.classList[val ? "add" : "remove"]("disabled");
		return this;
	}
}

export class Button extends Control<null, HTMLButtonElement> {
	constructor(id: string, label: string, onclick = undefined) {
		super(id, null, onclick);
		this.DOM.textContent = label;
		this.DOM.addEventListener("click", () => this.setValue(null));
	}
	setDisabled(val: boolean) {
		this.DOM.disabled = val;
		return super.setDisabled(val);
	}
	click() {
		this.DOM.click();
	}
}

export class Knob extends Control<number, HTMLDivElement> {

	// The unrounded value so that scrolling can change it at a reasonable rate
	// instead of by a step every scroll event
	private scrollValue = 0;
	public wheel: HTMLDivElement;
	public marker: HTMLDivElement;
	public output: HTMLOutputElement;

	private min: number;
	private max: number;
	private step: number;

	constructor(id: string, label: string, units: string, init: number, min: number, max: number, step: number, onupdate: (val: number) => void) {
		super(id, 0, onupdate);
		// We're just going to assume these elements are present here, not worth type checking
		this.DOM.querySelector(".name").textContent = label;
		this.DOM.querySelector(".units").textContent = units;
		this.wheel = this.DOM.querySelector(".wheel");
		this.marker = this.DOM.querySelector(".marker");
		this.output = this.DOM.querySelector("output");
		this.min = min;
		this.max = max;
		this.step = step;

		// Input event listener
		const listener = (e: MouseEvent | TouchEvent) => {
			let pageY = 0;
			if (e instanceof MouseEvent) pageY = e.pageY;
			else if (e.type === "touchstart") pageY = e.touches[0].pageY;
			else return;

			e.preventDefault();
			if (this.isDisabled()) return;
			this.wheel.classList.add("changing");

			const startY = pageY;
			const startValue = this.getValue();
			const moveListener = (e: MouseEvent | TouchEvent) => {
				const pageY = e instanceof MouseEvent ? e.pageY : e.touches[0].pageY;
				let val = startValue + (this.max - this.min) * (startY - pageY) * 3 / window.screen.height;
				val = Math.min(this.max, Math.max(this.min, val));
				this.setValue(val);
			};
			const upListener = (e: MouseEvent | TouchEvent) => {
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
			this.scrollValue = Math.min(this.max, Math.max(this.min, this.scrollValue + e.deltaY/100 * scale));
			this.setValue(this.scrollValue);
		});

		// Reset on right click
		this.wheel.addEventListener("dblclick", e => {
			e.preventDefault();
			if (!this.isDisabled()) this.setValue(init);
		});

		this.setValue(init);
	}

	setDisabled(val: boolean) {
		return super.setDisabled(val);
	}

	updateKnob() {
		const value = this.getValue();
		this.output.textContent = value.toString();
		this.wheel.style = `transform: rotate(${(value - this.min) / (this.max - this.min) * 2 * Math.PI}rad);`;
	}

	setValue(value: number) {
		value = parseFloat((this.step * Math.round(value / this.step)).toFixed(10));
		if (value === this.getValue()) return this;
		super.setValue(value);
		this.scrollValue = this.getValue();
		this.updateKnob();
		return this;
	}
}

export class ComboBox extends Control<{name: string, value: any} | null, HTMLDivElement> {

	select: HTMLSelectElement;
	options: {name: string, value: any}[];

	constructor(id: string, label: string, onupdate = undefined) {
		super(id, null, onupdate);
		// @ts-ignore Assume element exists
		this.DOM.querySelector("label").textContent = label;
		// @ts-ignore
		this.select = this.DOM.querySelector("select");
		this.options = [];

		this.select.addEventListener("input", () => {
			this.setValue(this.options[this.select.selectedIndex].value);
		});
	}

	setDisabled(val: boolean) {
		this.select.disabled = val;
		return super.setDisabled(val);
	}

	setValue(val: any) {
		this.select.selectedIndex = this.options.map(o => o.value).indexOf(val);
		return super.setValue(val);
	}

	addOption({ name, value }: {name: string, value: any}) {
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

export class Checkbox extends Control<boolean, HTMLDivElement> {

	checkbox: HTMLInputElement;

	constructor(id: string, label: string, init: boolean, onupdate = undefined) {
		super(id, init, onupdate);
		// @ts-ignore
		this.DOM.querySelector("label").textContent = label;
		// @ts-ignore
		this.checkbox = this.DOM.querySelector("input");
		this.setValue(init);

		this.checkbox.addEventListener("input", () => {
			this.setValue(this.checkbox.checked);
		});
	}
	setDisabled(val: boolean) {
		this.checkbox.disabled = val;
		return super.setDisabled(val);
	}
	setValue(val: boolean) {
		this.checkbox.checked = val;
		return super.setValue(val);
	}
}

export class Meter extends Control<number, HTMLDivElement> {

	meter: HTMLProgressElement;
	output: HTMLOutputElement;

	constructor(id: string, label: string, units: string, init: number, min: number, max: number) {
		super(id, init);
		this.DOM.querySelector(".name").textContent = label;
		this.DOM.querySelector(".units").textContent = units;
		this.meter = this.DOM.querySelector("progress");
		this.output = this.DOM.querySelector("output");
		this.meter.min = min; this.meter.max = max;
		this.setValue(init);
	}
	setDisabled(val: boolean) {
		console.warn("Disabling a meter has no effect");
		return super.setDisabled(val);
	}
	setValue(val: number) {
		this.meter.value = val;
		this.output.textContent = val.toString();
		return super.setValue(val);
	}
}
