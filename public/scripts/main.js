const strToElt = str => new DOMParser().parseFromString(str, "text/html").body.firstChild;

class Simulation {

	constructor() {
		// These functions should be set by the simulation using this class
		this.render = null;
		this.init = null;

		// Get the canvas element and drawing context
		this.canvas = document.querySelector("canvas");
		this.ctx = this.canvas.getContext("2d");

		// Get colours defined on root element in css
		const style = window.getComputedStyle(document.documentElement);
		this.colours = {
			background: style.getPropertyValue("--background-color"),
			foreground: style.getPropertyValue("--text-color"),
			accent: style.getPropertyValue("--accent-color")
		};

		// Automatically resize the canvas with the window
		this.resize();
		window.addEventListener("resize", () => this.resize());
		
		// The sliders, buttons etc in the controls panel
		this.controls = [];

		// The number of metres that the canvas should cover.
		this.scale = 5;

		// Track mouse and touches through event listeners
		this.mouse = { pressed: -1, x: 0, y: 0 };

		// These two functions are called from the event listeners when needed
		const mousemove = ({ pageX, pageY }) => {
			this.mouse.x = pageX - this.canvas.offsetLeft;
			this.mouse.y = pageY - this.canvas.offsetTop;
			if (this.onmousemove) this.onmousemove();
		};
		const mousepress = button => {
			this.mouse.pressed = button;
			if (button === -1 && this.onmouseup) this.onmouseup();
			else if (this.onmousedown) this.onmousedown();
		};

		// Attach all the event listeners for inputs from the user
		window.addEventListener("touchend", () => mousepress(-1));
		window.addEventListener("mouseup", () => mousepress(-1));
		this.canvas.addEventListener("touchmove", e => mousemove(e.changedTouches[0]));
		this.canvas.addEventListener("mousemove", e => mousemove(e));
		this.canvas.addEventListener("touchstart", e => {
			mousemove(e.changedTouches[0]);
			mousepress(0);
			e.preventDefault();
		});
		this.canvas.addEventListener("mousedown", e => {
			mousemove(e);
			mousepress(e.button);
			e.preventDefault();
		});
		this.canvas.addEventListener("contextmenu", e => {
			e.preventDefault();
		});
	}

	resize() {
		const size = Math.min(window.innerHeight * 0.7, document.body.clientWidth) - 10;
		this.canvas.width = size;
		this.canvas.height = size;

		// When the window is resized, stroke and fill styles are lost so we need to set them again
		this.ctx.strokeStyle = this.colours.accent;
		this.ctx.fillStyle = this.colours.foreground;

		return this.canvas;
	}


	/*
	 * A wrapper for the main animation loop
	 */

	start() {

		const render = () => {
			// We want all the units in seconds, to make other units more realistic
			const time = performance.now() / 1000 - this.timeStart;
			this.delta = time - this.time;
			this.time = time;

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
			}
			window.requestAnimationFrame(render);
		}

		// Start animation loop
		this.timeStart = performance.now() / 1000;
		this.delta = 0;
		this.time = this.timeStart;
		if (this.init) this.init();
		render();
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

	groupControls(elts) {
		// Puts all the given control elements into a div container
		const container = document.getElementById("controls");
		const innerContainer = strToElt(`<div class="control-group"></div>`);
		for (const elt of elts) {
			innerContainer.appendChild(elt);
		}
		container.appendChild(innerContainer);
	}

	addProgressBar(label) {
		const container = document.getElementById("controls");
		const progress = strToElt(`<progress max="100" value="0">${label}</progress>`);
		container.appendChild(progress);
		return progress;
	}

	addButton(label, func) {
		const container = document.getElementById("controls");
		const btn = strToElt(`<button class="button box-shadow">${label}</button>`);
		btn.addEventListener("click", func);
		container.appendChild(btn);
		return btn;
	}

	addSlider(name, units, init, min, max, step) {
		// A slider that can be used to choose a float value
		const container = document.getElementById("controls");
		const id = "range-" + name.toLowerCase().replace(' ', '-');
		
		// Create the DOM elements
		const label = strToElt(`
			<label class="slider left-border" for="${id}">
				<span class="name">${name}</span>
				<output for="${id}">${init}</output>
				<span class="units">${units}</span>
				<input
					type="range"
					id="${id}"
					min="${min}"
					max="${max}"
					step="${step}" 
					value="${init}"
				/>
			</label>
		`);
		const slider = label.querySelector("input");
		const output = label.querySelector("output");

		// Add them to the document
		container.appendChild(label);
		
		// Show the slider when the label is clicked
		this.controls.push(label);
		label.addEventListener("click", e => {
			if (e.target === slider) return;
			// Toggle clicked label and contract all others
			this.controls.forEach(x => x.classList[
				x.htmlFor === label.htmlFor ? "toggle" : "remove"
			]("expanded"));
		});
		
		// Change the label and the object property on input
		const inputHandler = val => {
			output.textContent = val;
			slider.dispatchEvent(new CustomEvent("update", { detail: val }));
		};
		slider.addEventListener("input", e => inputHandler(e.target.valueAsNumber))
		slider.update = val => {
			slider.value = val;
			inputHandler(val);
		};

		return slider;
	}

	addSelector(name, arr, init) {
		// A selector has two arrow buttons that can be used to select on of the options given in arr
		const id = "selector-" + name.toLowerCase().replace(' ', '-');
		const container = document.getElementById("controls");

		const label = strToElt(`
			<label class="selector" for="${id}">
				<button class="selector-left box-shadow">&lt;</button>
				<span class="selector-label">
					<span class="selector-name">${name}</span>
					<output>${init}</output>
				</span>
				<button class="selector-right box-shadow">&gt;</button>
			</label>
		`);

		const validateValue = value => value >= 1 && value <= arr.length;
		const dispatchUpdate = adjustment => {
			// Map to zero-based range
			label.dispatchEvent(new CustomEvent("update", { detail: adjustment }));
		};

		const leftArrow = label.querySelector(".selector-left");
		const rightArrow = label.querySelector(".selector-right");
		const output = label.querySelector("output");
		leftArrow.addEventListener("click", () => dispatchUpdate(-1));
		rightArrow.addEventListener("click", () => dispatchUpdate(1));

		label.updateDisplay = value => {
			if (!validateValue(value)) return;
			leftArrow.disabled = !validateValue(value - 1);
			rightArrow.disabled = !validateValue(value + 1);
			output.value = value;
		};

		container.appendChild(label);

		return label;
	}
}

