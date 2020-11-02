const strToElt = str => new DOMParser().parseFromString(str, "text/html").body.firstChild;

class Simulation {

	constructor(contextType = "2d") {
		// These functions should be set by the simulation using this class
		this.render = null;
		this.init = null;

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

		this.time = 0;

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
			if (button === -1) {
				if (this.onmouseup) this.onmouseup();
			}
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
	}

	resize() {
		const size = Math.min(window.innerHeight * 0.7, document.body.clientWidth) - 10;
		this.canvas.width = size;
		this.canvas.height = size;

		// When the window is resized, stroke and fill styles are lost so we need to set them again
		this.ctx.strokeStyle = this.colours.accent;
		this.ctx.fillStyle = this.colours.foreground;

		if (this.contextType === "webgl2" || this.contextType === "webgl") {
			this.ctx.viewport(0, 0, size, size);
		}

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

	addButton(id, label, onclick) {
		const btn = document.getElementById(id);
		if (!btn) return null;
		btn.textContent = label;
		btn.addEventListener("click", onclick);
		return {
			click: () => btn.click()
		};
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
		const control = {
			getValue: () => value,
			setValue: newValue => {
				slider.value = newValue;
				output.textContent = newValue;
				value = newValue;
				onupdate(value);
			}
		};
		
		// Show the slider when the label is clicked
		this.controls.push(outer);
		outer.addEventListener("click", e => {
			if (e.target === slider) return;
			// Toggle clicked label and contract all others
			this.controls.forEach(x => x.classList[
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

	// Remove this if not being used
	addSelector(name, arr, onupdate) {
		// A selector has two arrow buttons that can be used to select on of the options given in arr

		// Create DOM elements
		const id = "selector-" + name.toLowerCase().replace(' ', '-');
		const container = document.getElementById("controls");
		const label = strToElt(`
			<label class="selector" for="${id}">
				<button class="selector-left box-shadow">&lt;</button>
				<span class="selector-label">
					<span class="selector-name">${name}</span>
					<output>0</output>
				</span>
				<button class="selector-right box-shadow">&gt;</button>
			</label>
		`);
		const leftArrow = label.querySelector(".selector-left");
		const rightArrow = label.querySelector(".selector-right");
		const output = label.querySelector("output");

		const validateValue = value => value >= 0 && value < arr.length;

		// External control
		let value = 0;
		const control = {
			getValue: () => value,
			setValue: newValue => {
				leftArrow.disabled = !validateValue(newValue - 1);
				rightArrow.disabled = !validateValue(newValue + 1);
				output.value = newValue + 1;
				value = newValue;
				onupdate(value);
			}
		};

		// Event listeners
		const onclick = newValue => {
			if (!validateValue(newValue)) return;
			control.setValue(newValue);
			onupdate(newValue);
		};
		leftArrow.addEventListener("click", () => onclick(control.getValue() - 1));
		rightArrow.addEventListener("click", () => onclick(control.getValue() + 1));

		return control;
	}

	addComboBox(id, label, onupdate) {

		// Create DOM elements
		const outer = document.getElementById(id);
		if (!outer) return null;
		outer.querySelector("label").textContent = label;
		const select = outer.querySelector("select");

		// External control
		const control = {
			getValue: () => select.selectedIndex,
			setValue: newValue => {
				select.selectedIndex = newValue;
				onupdate(select.selectedIndex);
			},
			setOptions: labels => {
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
			}
		};

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
		const control = {
			getValue: () => checkbox.checked,
			setValue: newValue => {
				checkbox.checked = newValue;
				onupdate(checkbox.checked);
			}
		};

		// Event listener
		checkbox.addEventListener("input", () => onupdate(checkbox.checked));

		return control;
	}

}

