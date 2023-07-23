import {Simulation, Button, Knob, ComboBox, MouseButton} from './main.js';
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

		const type = {
			MANDELBROT: 0,
			JULIA: 1,
			TRICORN: 2,
			BURNINGSHIP: 3,
			NEWTON: 4
		}

		const state = {
			needsRender: true,
			position: new Vector([0, 0]),
			zoom: 0.5,
			iterations: 100,
			mousePos: new Vector([0, 0]),
			coeffs: new Vector([0, 0, 0, 0]),
			newton: [-1, 0, 0, 1, 0, 0, 0, 0, 0],
			type: 0
		};

		window.addEventListener("resize", () => state.needsRender = true);

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
		const newtonLoc = gl.getUniformLocation(program, "u_newton");

		function setColours() {
			gl.uniform3fv(colorfgLoc, new Float32Array(hexToRGB(sim.colours.foreground)));
			gl.uniform3fv(colorbgLoc, new Float32Array(hexToRGB(sim.colours.accent)));
			gl.uniform3fv(coloraccentLoc, new Float32Array(hexToRGB(sim.colours.background)));
			gl.uniform2fv(positionLoc, new Float32Array([0, 0]));
		}
		setColours();
		window.addEventListener("recolour", () => {
			setColours();
			state.needsRender = true;
		});

		// Add the sliders to control them
		const playButton = new Button("playpause", "Start/stop animation", () => {
			if (sim.timer.isPaused)
				sim.timer.start();
			else
				sim.timer.pause();
		});

		new Knob("zoom", "Zoom", "%", 0, 0, 100, 0.1, value => {
			state.zoom = Math.exp(value/9 - 0.7);
			state.needsRender = true;
		}).setValue(0);

		new Knob("iterations", "Iterations (level of detail)", "", 0, 5, 500, 5, value => {
			state.iterations = value;
			state.needsRender = true;
		}).setValue(300);

		function CoeffInput(id, setter, callback) {
			this.elt = document.getElementById(id);
			this.getValue = () => parseFloat(this.elt.textContent) || null;
			this.update = () => this.elt.textContent = setter();
			this.elt.addEventListener("input", () => callback(this.getValue()));
			this.elt.addEventListener("blur", () => this.update());

			this.update();
			callback(this.getValue());
		}

		const coeffElts = new Array(state.coeffs.length).fill(0).map((_, i) => new CoeffInput(
			"coeff" + i,
			() => state.coeffs[i],
			val => {
				state.coeffs[i] = val || 0;
				playButton.disabled = state.coeffs[2] === 0;
				state.needsRender = true;
			}
		));

		const newtonElts = new Array(state.newton.length).fill(0).map((_, i) => new CoeffInput(
			"newton" + i,
			() => state.newton[i],
			val => {
				state.newton[i] = val || 0;
				gl.uniform1fv(newtonLoc, new Float32Array(state.newton));
				state.needsRender = true;
			}
		));

		new ComboBox("type", "Presets", value => {
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
				case 9: state.coeffs = [0, 0, 0, 0]; state.type = type.NEWTON; break;
			}
			for (let i = 0; i < state.coeffs.length; i++) {
				coeffElts[i].update();
			}

			const hideElts = className => [...document.getElementsByClassName(className)].forEach(elt => elt.setAttribute("hidden", ""));
			const showElts = className => [...document.getElementsByClassName(className)].forEach(elt => elt.removeAttribute("hidden"));
			hideElts("julia-custom");
			hideElts("mandelbrot-custom");
			hideElts("newton-custom");
			if (state.type === type.MANDELBROT) showElts("mandelbrot-custom");
			else if (state.type === type.JULIA) showElts("julia-custom");
			else if (state.type === type.NEWTON) showElts("newton-custom");

			playButton.disabled = state.coeffs[3] === 0;
			state.needsRender = true;

		})	.addOption({name: "Mandelbrot", value: 0})
			.addOption({name: "Multibrot (7th power)", value: 1})
			.addOption({name: "Julia Set 1", value: 2})
			.addOption({name: "Julia Set 2", value: 3})
			.addOption({name: "Julia Set 3", value: 4})
			.addOption({name: "Julia Set 4 (6-point star)", value: 5})
			.addOption({name: "Julia Set 5 (Glynn fractal)", value: 6})
			.addOption({name: "Tricorn", value: 7})
			.addOption({name: "Burning Ship", value: 8})
			.addOption({name: "Newton (Polynomials)", value: 9})
			.setValue(0);

		sim.onmousedown = function() {
			state.mousePos = new Vector([sim.mouse.x, sim.mouse.y]);
		};

		sim.render = function() {

			if (sim.mouse.pressed === MouseButton.LEFT && (sim.mouse.x != state.mousePos.x || sim.mouse.y != state.mousePos.y)) {
				const mousePos = new Vector([sim.mouse.x, sim.mouse.y]);
				state.position = state.position.add(state.mousePos.sub(mousePos).divide(0.5 * sim.canvas.width * state.zoom));
				state.mousePos = mousePos;
				state.needsRender = true;
			}

			if (sim.timer.isPaused && !state.needsRender) return;
			state.needsRender = false;
			if (state.coeffs[2] === 0) sim.timer.pause();

			gl.clearColor(0, 1, 0, 1);
			gl.clear(gl.COLOR_BUFFER_BIT);

			gl.useProgram(program);

			gl.uniform2fv(positionLoc, new Float32Array(state.position));
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

