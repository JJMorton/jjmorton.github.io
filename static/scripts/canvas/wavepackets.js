import {Simulation} from './main.js';

window.addEventListener("load", function() {

	'use strict';


	/* Initialise stuff */

	const sim = new Simulation();

	const state = {
		waves: [],
		selectedIndex: 0,
		selected: null,
		scale: 10
	};

	const defaultWave = {
		amp: 0.5, freq: 1, wavelength: 1, offset: 0, reverse: false
	};
	
	sim.scale = state.scale;


	/* Create DOM elements */

	const scaleSlider = sim.addKnob("scale", "Viewing Scale", "m", sim.scale, 1, 20, 0.1, value => sim.scale = value);

	const selectCombo = sim.addComboBox("select", "Selected Wave", index => {
		// Set the selected wave and update the sliders associated with its properties
		console.log("Selecting wave index", index);
		state.selectedIndex = index;
		state.selected = state.waves[index];
		for (const prop in sliders) {
			if (sliders.hasOwnProperty(prop)) sliders[prop].setValue(state.selected[prop]);
		}
	});

	const addBtn = sim.addButton("add", "Add Wave", () => {
		addWave(createWave(defaultWave));
	});

	const dupeBtn = sim.addButton("duplicate", "Duplicate Wave", () => {
		addWave(createWave(state.selected));
	});

	const remBtn = sim.addButton("remove", "Remove Wave", () => {
		if (state.waves.length <= 1) return;
		state.waves.splice(state.selectedIndex, 1);
		selectCombo.setOptions(state.waves.map((_, i) => `Wave ${i + 1}`));
	});

	const sliders = {
		wavelength: sim.addKnob("wavelength", "Wavelength", "m", 0, 0.1, 10, 0.01, value => {
			state.selected.wavelength = value;
			state.selected.freq = 1 / value;
		}),
		amp: sim.addKnob("amplitude", "Amplitude", "m", 0, 0.1, 5, 0.01, value => state.selected.amp = value),
		offset: sim.addKnob("offset", "Phase Offset", "degrees", 0, 0, 360, 1, value => state.selected.offset = value * Math.PI / 180)
	};

	sliders.wavelength.DOM.addEventListener("mousedown", () => {
		sim.timer.reset();
		sim.timer.pause();
	});
	window.addEventListener("mouseup", () => {
		sim.timer.start();
	});
	sliders.wavelength.DOM.addEventListener("touchstart", () => {
		sim.timer.reset();
		sim.timer.pause();
	});
	window.addEventListener("touchend", () => {
		sim.timer.start();
	});


	sim.addCheckbox("reverse", "Reverse direction", false, value => state.selected.reverse = value);



	/* Modify array of waves, keeping sliders and selector in sync */

	function createWave({ amp, freq, wavelength, offset, reverse }) {
		return { amp, freq, wavelength, offset, reverse };
	}

	function addWave(wave) {
		state.waves.push(wave);
		selectCombo.setOptions(state.waves.map((_, i) => `Wave ${i + 1}`));
		selectCombo.setValue(state.waves.length - 1);
	}

	function drawWave(c, points) {
		c.beginPath();
		c.moveTo(0, points[0]);
		for (let x = 1; x < points.length; x++) {
			c.lineTo(x, points[x]);
		}
		c.stroke();
		c.closePath();
	}


	/* Funcs for calculations */

	const getAngFreq = wave => 2 * Math.PI * wave.freq;
	const getWaveNum = wave => 2 * Math.PI / wave.wavelength;
	const getDisplacement = (wave, x, t) =>
		wave.amp * Math.cos(getAngFreq(wave) * t + (wave.reverse ? 1 : -1) * getWaveNum(wave) * x + wave.offset);



	sim.render = function(c) {
		const halfHeight = sim.canvas.height / 2;
		const halfWidth = sim.canvas.width / 2;
		c.clearRect(0, 0, sim.canvas.width, sim.canvas.height);

		const time = sim.timer.getTime();
		
		// Sum all the waves and calculate the selected one's points
		let sums = new Array(sim.canvas.width).fill(0);
		for (const wave of state.waves) {
			const arr = [];
			for (let x = 0; x < sim.canvas.width; x++) {
				const y = getDisplacement(wave, sim.pxToM(x - halfWidth), time);
				arr[x] = y;
				sums[x] += y;
			}

			if (wave === state.selected)
				c.globalAlpha = 1;
			else
				c.globalAlpha = 0.3;
			drawWave(c, arr.map(y => halfHeight + sim.mToPx(y)));
		}

		// Draw resultant wave
		c.globalAlpha = 1;
		const strokeStyleTmp = c.strokeStyle;
		c.strokeStyle = "#FF0000";
		c.lineWidth *= 2;
		drawWave(c, sums.map(y => halfHeight + sim.mToPx(y)));
		c.lineWidth /= 2;
		c.strokeStyle = strokeStyleTmp;
	};

	addWave(createWave(defaultWave));

	sim.start();

});

