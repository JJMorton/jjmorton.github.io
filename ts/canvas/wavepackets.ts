import {Simulation2D, ComboBox, Button, Knob, Checkbox} from './main.js';

type Wave = {amp: number, freq: number, wavelength: number, offset: number, reverse: boolean};

window.addEventListener("load", function() {

	'use strict';


	/* Initialise stuff */

	const sim = new Simulation2D();

	const state: {waves: Wave[], selectedIndex: number, selected: Wave | null, scale: number} = {
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

	const scaleSlider = new Knob("scale", "Viewing Scale", "m", sim.scale, 1, 20, 0.1, value => sim.scale = value);

	const selectCombo = new ComboBox<number>("select", "Selected Wave", index => {
		if (index === null) return;
		// Set the selected wave and update the sliders associated with its properties
		console.log("Selecting wave index", index);
		state.selectedIndex = index;
		state.selected = state.waves[index];
		if (!state.selected) {
			selectCombo.select.selectedIndex = 0;
			return;
		}
		for (const prop in sliders) {
			// @ts-ignore TS doesn't understand `.hasOwnProperty()`?
			if (sliders.hasOwnProperty(prop)) sliders[prop].setValue(state.selected[prop]);
		}
	});

	const addBtn = new Button("add", "Add Wave", () => {
		addWave(createWave(defaultWave));
	});

	const dupeBtn = new Button("duplicate", "Duplicate Wave", () => {
		if (!state.selected) return;
		addWave(createWave(state.selected));
	});

	const remBtn = new Button("remove", "Remove Wave", () => {
		if (state.waves.length <= 1) return;
		state.waves.splice(state.selectedIndex, 1);
		selectCombo.clearOptions();
		state.waves.forEach((_, i) => selectCombo.addOption({name: "Wave " + (i + 1), value: i}));
		remBtn.setDisabled(state.waves.length <= 1);
	});

	const sliders = {
		wavelength: new Knob("wavelength", "Wavelength", "m", 0, 0.1, 10, 0.01, value => {
			if (!state.selected) return;
			state.selected.wavelength = value;
			state.selected.freq = 1 / value;
		}),
		amp: new Knob("amplitude", "Amplitude", "m", 0, 0.1, 5, 0.01, value => {
			if (!state.selected) return;
			state.selected.amp = value;
		}),
		offset: new Knob("offset", "Phase Offset", "degrees", 0, 0, 360, 1, value => {
			if (!state.selected) return;
			state.selected.offset = value * Math.PI / 180
		})
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
	sliders.wavelength.DOM.addEventListener("wheel", () => sim.timer.reset());


	new Checkbox("reverse", "Reverse direction", false, value => {
		if (!state.selected) return;
		state.selected.reverse = value
	});



	/* Modify array of waves, keeping sliders and selector in sync */

	function createWave({ amp, freq, wavelength, offset, reverse }: Wave) {
		return { amp, freq, wavelength, offset, reverse };
	}

	function addWave(wave: Wave) {
		state.waves.push(wave);
		selectCombo.addOption({name: "Wave " + state.waves.length, value: state.waves.length - 1});
		// selectCombo.setOptions(state.waves.map((_, i) => `Wave ${i + 1}`));
		selectCombo.setValue(state.waves.length - 1);
		remBtn.setDisabled(state.waves.length <= 1);
	}

	function drawWave(c: CanvasRenderingContext2D, points: number[]) {
		c.beginPath();
		c.moveTo(0, points[0]);
		for (let x = 1; x < points.length; x++) {
			c.lineTo(x, points[x]);
		}
		c.stroke();
		c.closePath();
	}


	/* Funcs for calculations */

	const getAngFreq = (wave: Wave) => 2 * Math.PI * wave.freq;
	const getWaveNum = (wave: Wave) => 2 * Math.PI / wave.wavelength;
	const getDisplacement = (wave: Wave, x: number, t: number) =>
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

