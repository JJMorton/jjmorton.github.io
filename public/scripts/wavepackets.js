window.addEventListener("load", function() {

	'use strict';

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
	
	/* Create DOM elements */
	sim.addSlider("Scale", "m", sim.scale, 1, 20, 0.1)
		.addEventListener("update", e => sim.scale = e.detail);
	const waveSelector = sim.addSelector("Wave", state.waves, 1);
	waveSelector.addEventListener("update", e => {
		state.selectedIndex += e.detail;
		selectWave(state.selectedIndex);
		waveSelector.updateDisplay(state.selectedIndex + 1);
	});
	sim.groupControls([
		sim.addButton("Add Wave", () => {
			addWave(createWave(defaultWave));
		}),
		sim.addButton("Duplicate Wave", () => {
			addWave(createWave(state.waves[state.waves.length - 1]));
		}),
		sim.addButton("Remove Wave", () => {
			if (state.waves.length <= 1) return;
			state.waves.splice(state.selectedIndex, 1);
			selectWave(state.selectedIndex - 1 < 0 ? 0 : state.selectedIndex - 1);
			waveSelector.updateDisplay(state.selectedIndex + 1);
		})
	]);

	const sliders = {
		wavelength: sim.addSlider("Wavelength", "m", 0, 0.1, 10, 0.01),
		freq: sim.addSlider("Frequency", "Hz", 0, 0.1, 10, 0.1),
		amp: sim.addSlider("Amplitude", "m", 0, 0.1, 5, 0.1),
		offset: sim.addSlider("Phase Offset", "", 0, 0, 2 * Math.PI, 0.01)
	};
	for (const prop in sliders) {
		if (sliders.hasOwnProperty(prop)) sliders[prop].addEventListener("update", e => state.selected[prop] = e.detail);
	}

	sim.scale = state.scale;

	function createWave({ amp, freq, wavelength, offset }) {
		return { amp, freq, wavelength, offset };
	}

	function selectWave(index) {
		// Set the selected wave and update the sliders associated with its properties
		state.selectedIndex = index;
		state.selected = state.waves[index];
		for (const prop in sliders) {
			if (sliders.hasOwnProperty(prop)) sliders[prop].update(state.selected[prop]);
		}
	}

	function addWave(wave) {
		state.waves.push(wave);
		waveSelector.updateDisplay(state.waves.length);
		selectWave(state.waves.length - 1);
	}

	const getAngFreq = wave => 2 * Math.PI * wave.freq;
	const getWaveNum = wave => 2 * Math.PI / wave.wavelength;
	const getDisplacement = (wave, x, t) =>
		wave.amp * Math.cos(getAngFreq(wave) * sim.time - getWaveNum(wave) * x + wave.offset);

	sim.render = function(c) {
		c.clearRect(0, 0, sim.canvas.width, sim.canvas.height);
		c.globalAlpha = 0.3;
		const halfHeight = sim.canvas.height / 2;
		const halfWidth = sim.canvas.width / 2;
		let sums = new Array(sim.canvas.width);
		sums.fill(0);
		for (const wave of state.waves) {
			const drawWave = wave === state.selected;
			if (drawWave) c.beginPath();
			const origin = getDisplacement(wave, 0, sim.time);
			if (drawWave) c.moveTo(0, halfHeight + sim.mToPx(origin));
			sums[0] += origin;
			for (let x = 1; x < sim.canvas.width; x++) {
				const y = getDisplacement(wave, sim.pxToM(x - halfWidth), sim.time);
				sums[x] += y;
				if (drawWave) c.lineTo(x, halfHeight + sim.mToPx(y));
			}
			if (drawWave) c.stroke();
			if (drawWave) c.closePath();
		}
		c.globalAlpha = 1;
		c.beginPath();
		c.moveTo(0, halfHeight + sums[0]);
		for (let x = 1; x < sums.length; x++) {
			c.lineTo(x, halfHeight + sim.mToPx(sums[x]));
		}
		c.stroke();
		c.closePath();
	};
	
	addWave(createWave(defaultWave));
	
	sim.start();

});
