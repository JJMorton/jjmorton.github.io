window.addEventListener("load", function() {

	'use strict';


	/* Initialise stuff */

	const sim = new Simulation();

	const state = {
		waves: [],
		selectedIndex: 0,
		selected: null,
		scale: 5
	};

	const defaultWave = {
		amp: 0.5, freq: 1, wavelength: 1, offset: 0
	};
	
	sim.scale = state.scale;


	/* Create DOM elements */

	const scaleSlider = sim.addSlider("Scale", "m", sim.scale, 1, 20, 0.1, value => sim.scale = value);

	const waveSelector = sim.addSelector("Wave", state.waves, value => {
		selectWave(value);
	});

	const addBtn = sim.addButton("Add Wave", () => {
		addWave(createWave(defaultWave));
	});

	const dupeBtn = sim.addButton("Duplicate Wave", () => {
		addWave(createWave(state.selected));
	});

	const remBtn = sim.addButton("Remove Wave", () => {
		if (state.waves.length <= 1) return;
		state.waves.splice(state.selectedIndex, 1);
		selectWave(state.selectedIndex - 1 < 0 ? 0 : state.selectedIndex - 1);
		waveSelector.setValue(state.selectedIndex);
	});

	sim.groupControls([addBtn, dupeBtn, remBtn]);

	const sliders = {
		wavelength: sim.addSlider("Wavelength", "m", 0, 0.1, 10, 0.01, value => state.selected.wavelength = value),
		freq: sim.addSlider("Frequency", "Hz", 0, 0.1, 10, 0.1, value => state.selected.freq = value),
		amp: sim.addSlider("Amplitude", "m", 0, 0.1, 5, 0.1, value => state.selected.amp = value),
		offset: sim.addSlider("Phase Offset", "", 0, 0, 2 * Math.PI, 0.01, value => state.selected.offset = value)
	};


	/* Modify array of waves, keeping sliders and selector in sync */

	function createWave({ amp, freq, wavelength, offset }) {
		return { amp, freq, wavelength, offset };
	}

	function selectWave(index) {
		// Set the selected wave and update the sliders associated with its properties
		state.selectedIndex = index;
		state.selected = state.waves[index];
		for (const prop in sliders) {
			if (sliders.hasOwnProperty(prop)) sliders[prop].setValue(state.selected[prop]);
		}
	}

	function addWave(wave) {
		state.waves.push(wave);
		waveSelector.setValue(state.waves.length - 1);
		selectWave(state.waves.length - 1);
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
		wave.amp * Math.cos(getAngFreq(wave) * sim.time - getWaveNum(wave) * x + wave.offset);



	sim.render = function(c) {
		const halfHeight = sim.canvas.height / 2;
		const halfWidth = sim.canvas.width / 2;
		c.clearRect(0, 0, sim.canvas.width, sim.canvas.height);
		
		// Sum all the waves and calculate the selected one's points
		let sums = new Array(sim.canvas.width).fill(0);
		let selected = new Array(sim.canvas.width).fill(0);
		for (const wave of state.waves) {
			const drawWave = wave === state.selected;
			for (let x = 0; x < sim.canvas.width; x++) {
				const y = getDisplacement(wave, sim.pxToM(x - halfWidth), sim.time);
				if (drawWave) selected[x] = y;
				sums[x] += y;
			}
		}
		
		// Draw selected and resultant waves
		c.globalAlpha = 0.5;
		drawWave(c, selected.map(y => halfHeight + sim.mToPx(y)));
		c.globalAlpha = 1;
		drawWave(c, sums.map(y => halfHeight + sim.mToPx(y)));
	};
	
	addWave(createWave(defaultWave));
	
	sim.start();

});
