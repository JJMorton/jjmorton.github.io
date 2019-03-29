window.addEventListener("load", function() {

	'use strict';

	const sim = new Simulation();

	const state = {
		waves: [],
		scale: 5
	};

	sim.scale = state.scale;

	const createWave = ({ amp, freq, wavelength, offset }) => ({
		amp, freq, wavelength, offset
	});

	const getAngFreq = wave => 2 * Math.PI * wave.freq;
	const getWaveNum = wave => 2 * Math.PI / wave.wavelength;
	const getDisplacement = (wave, x, t) => wave.amp * Math.cos(getAngFreq(wave) * sim.time - getWaveNum(wave) * x + wave.offset);

	sim.render = function(c) {
		c.clearRect(0, 0, sim.canvas.width, sim.canvas.height);
		for (const wave of state.waves) {
			c.beginPath();
			const origin = getDisplacement(wave, 0, sim.time);
			c.moveTo(0, sim.canvas.height / 2 + sim.mToPx(origin));
			for (let x = 1; x < sim.canvas.width; x++) {
				const y = getDisplacement(wave, sim.pxToM(x), sim.time);
				c.lineTo(x, sim.canvas.height / 2 + sim.mToPx(y));
			}
			c.stroke();
			c.closePath();
		}
	};
	
	state.waves.push(createWave({
		amp: 0.5, freq: 1, wavelength: 0.2, offset: 0
	}));

	sim.addSlider("Scale", "m", sim.scale, 1, 10, 0.1)
		.addEventListener("update", e => sim.scale = e.detail);

	window.addEventListener("keypress", e => {
		if (e.keyCode === 13) console.log(state.waves[0]);
	})

	sim.start();

});
