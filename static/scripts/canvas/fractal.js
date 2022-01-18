import {Simulation} from './main.js';
import {Mouse} from './main.js';
import {Vector} from './vector.js';

function hexToRGB(hexString) {
	if (hexString.startsWith('#')) hexString = hexString.substring(1);
	if (hexString.length === 3) hexString = hexString.split('').map(c => c + c).join('');
	if (hexString.length !== 6) return [0, 0, 0];

	return [0, 2, 4].map(i => parseInt(hexString.substring(i, i + 2), 16) / 255);
}

window.addEventListener("load", function() {

	'use strict';

	const sim = new Simulation("webgl2");
	const gl = sim.ctx;

	sim.createShaderProgram("/shaders/passthrough.vs", "/shaders/fractal.fs").then(program => {

		// We just want to draw a square covering the entire canvas surface and let the fragment shader do the rest
		const positions = new Float32Array([
			-1.0, -1.0, 0.0, // bottom left
			 1.0, -1.0, 0.0, // bottom right
			-1.0,  1.0, 0.0, // top left

			 1.0, -1.0, 0.0, // bottom right
			 1.0,  1.0, 0.0, // top right
			-1.0,  1.0, 0.0  // top left
		]);

		const positionBuffer = gl.createBuffer();
		gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
		gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);
		gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);
		gl.enableVertexAttribArray(0);

		gl.useProgram(program);

		let needsRender = true;
		window.addEventListener("resize", () => needsRender = true);

		const type = {
			MANDELBROT: 0,
			JULIA: 1,
			TRICORN: 2,
			BURNINGSHIP: 3
		}

		const state = {
			position: new Vector([0, 0]),
			zoom: 0.5,
			iterations: 100,
			mousePos: new Vector([0, 0]),
			coeffs: new Vector([0, 0, 0, 0]),
			type: 0
		};

		// Get locations of uniforms we can control
		const resolutionLoc = gl.getUniformLocation(program, "u_resolution");
		const timeLoc = gl.getUniformLocation(program, "u_time");
		const zoomLoc = gl.getUniformLocation(program, "u_zoom");
		const iterationsLoc = gl.getUniformLocation(program, "u_iterations");
		const colorfgLoc = gl.getUniformLocation(program, "u_colorfg");
		const colorbgLoc = gl.getUniformLocation(program, "u_colorbg");
		const coloraccentLoc = gl.getUniformLocation(program, "u_coloraccent");
		const positionLoc = gl.getUniformLocation(program, "u_position");
		const coeffsLoc = gl.getUniformLocation(program, "u_coeffs");
		const typeLoc = gl.getUniformLocation(program, "u_type");

		gl.uniform3fv(colorfgLoc, new Float32Array(hexToRGB(sim.colours.foreground)));
		gl.uniform3fv(colorbgLoc, new Float32Array(hexToRGB(sim.colours.accent)));
		gl.uniform3fv(coloraccentLoc, new Float32Array(hexToRGB(sim.colours.background)));
		gl.uniform2fv(positionLoc, new Float32Array([0, 0]));

		// Add the sliders to control them
		const playButton = sim.addButton("playpause", "Start/stop animation", () => {
			if (sim.timer.isPaused)
				sim.timer.start();
			else
				sim.timer.pause();
		});
		sim.addSlider("zoom", "Zoom", "%", 0, 0, 100, 0.1, value => {
			state.zoom = Math.exp(value/9 - 0.8);
			needsRender = true;
		}).setValue(0);
		sim.addSlider("iterations", "Iterations (level of detail)", "", 0, 5, 500, 5, value => {
			state.iterations = value;
			needsRender = true;
		}).setValue(200);

		const coeffElts = [0, 1, 2, 3].map(x => document.getElementById("coeff" + x));
		for (let i = 0; i < coeffElts.length; i++) {
			const elt = coeffElts[i];
			elt.value = 0;
			elt.addEventListener("input", () => {
				if (!elt.textContent) return;
				state.coeffs[i] = parseFloat(elt.textContent) || 0;
				playButton.disabled = state.coeffs[2] === 0;
				needsRender = true;
			});
			elt.addEventListener("blur", () => {
				elt.textContent = state.coeffs[i];
			})
		}

		sim.addComboBox("type", "Presets", value => {
			state.type = value === 0 ? 0 : 1;

			switch (value) {
				case 0: state.coeffs = [2, 0, 0, 0]; state.type = type.MANDELBROT; break;
				case 1: state.coeffs = [7, 0, 0, 0]; state.type = type.MANDELBROT; break;
				case 2: state.coeffs = [2, -0.38197, 0.61803, 0.01]; state.type = type.JULIA; break;
				case 3: state.coeffs = [2, 0.285, 0.01, 0.001]; state.type = type.JULIA; break;
				case 4: state.coeffs = [2, -0.8, 0.156, 0.001]; state.type = type.JULIA; break;
				case 5: state.coeffs = [6, 0.736, -0.417355, 0]; state.type = type.JULIA; break;
				case 6: state.coeffs = [1.5, -0.1948, 0, 0]; state.type = type.JULIA; break;
				case 7: state.coeffs = [0, 0, 0, 0]; state.type = type.TRICORN; break;
				case 8: state.coeffs = [0, 0, 0, 0]; state.type = type.BURNINGSHIP; break;
			}
			for (let i = 0; i < state.coeffs.length; i++) {
				coeffElts[i].textContent = state.coeffs[i];
			}

			const hideElts = className => [...document.getElementsByClassName(className)].forEach(elt => elt.setAttribute("hidden", ""));
			const showElts = className => [...document.getElementsByClassName(className)].forEach(elt => elt.removeAttribute("hidden"));
			hideElts("julia-custom");
			hideElts("mandelbrot-custom");
			if (state.type === type.MANDELBROT) showElts("mandelbrot-custom");
			else if (state.type === type.JULIA) showElts("julia-custom");

			playButton.disabled = state.coeffs[3] === 0;
			needsRender = true;

		}).setOptions([ "Mandelbrot", "Multibrot (7th power)", "Julia Set 1", "Julia Set 2", "Julia Set 3", "Julia Set 4 (6-point star)", "Julia Set 5 (Glynn fractal)", "Tricorn", "Burning Ship" ]).setValue(0);

		sim.onmousedown = function() {
			state.mousePos = new Vector([sim.mouse.x, sim.mouse.y]);
		};

		sim.render = function() {

			if (sim.mouse.pressed === Mouse.buttons.LEFT && (sim.mouse.x != state.mousePos.x || sim.mouse.y != state.mousePos.y)) {
				const mousePos = new Vector([sim.mouse.x, sim.mouse.y]);
				state.position = state.position.add(state.mousePos.sub(mousePos).divide(0.5 * sim.canvas.width * state.zoom));
				gl.uniform2fv(positionLoc, new Float32Array(state.position));
				state.mousePos = mousePos;
				needsRender = true;
			}

			if (sim.timer.isPaused && !needsRender) return;
			needsRender = false;
			if (state.coeffs[2] === 0) sim.timer.pause();

			gl.clearColor(0, 1, 0, 1);
			gl.clear(gl.COLOR_BUFFER_BIT);

			gl.useProgram(program);

			gl.uniform1i(iterationsLoc, state.iterations);
			gl.uniform4fv(coeffsLoc, new Float32Array(state.coeffs));
			gl.uniform2fv(resolutionLoc, new Float32Array([sim.canvas.width, sim.canvas.height]));
			gl.uniform1f(timeLoc, sim.timer.getTime());
			gl.uniform1f(zoomLoc, state.zoom);
			gl.uniform1i(typeLoc, state.type);

			gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
			gl.drawArrays(gl.TRIANGLES, 0, positions.length / 3);
		};

		sim.start();
		sim.timer.pause();

	}).catch(console.error);

});

