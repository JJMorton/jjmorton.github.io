import {Simulation, Button, Knob} from './main.js';
import {Vector} from './vector.js';


function hexToRGB(hex) {
	if (hex.substring(0, 1) === '#') hex = hex.substring(1);
	var bigint = parseInt(hex, 16);
	var r = (bigint >> 16) & 255;
	var g = (bigint >> 8) & 255;
	var b = bigint & 255;

	return [r, g, b];
}


class GLPolygon {

	vertices;
	buffer;
	gl;

	constructor(gl, vertices) {
		this.gl = gl;
		this.setVertices(vertices);
	}

	render() {
		this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.buffer);
		this.gl.vertexAttribPointer(0, 2, this.gl.FLOAT, false, 0, 0);
		this.gl.enableVertexAttribArray(0);
		this.gl.drawArrays(this.gl.TRIANGLE_FAN, 0, this.sides);
		return this;
	}

	/**
	 * The number of sides/vertices that this polygon has
	 */
	get sides() { return this.vertices.length; }

	createBuffer() {
		this.buffer = this.gl.createBuffer();
		this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.buffer);
		this.gl.bufferData(this.gl.ARRAY_BUFFER, this.asPositionArray(), this.gl.STATIC_DRAW);
		return this;
	}

	/**
	 * Convertes the `vertices` into a flat array of positions (2d)
	 * for the vertices of the triangles than fan from the first point.
	 * Returns a FLoat32Array.
	 */
	asPositionArray() { return new Float32Array(this.vertices.flat()); }

	setVertices(vertices) {
		this.vertices = vertices.map(vert => new Vector(vert));
		this.createBuffer();
		return this;
	}
}


class GLHexagon extends GLPolygon {

	constructor(gl) {
		const N = 6;
		const vertices = new Array(N)
			.fill(0)
			.map((_, i) => (i + 0.5) * 2 * Math.PI / N)
			.map(theta => new Vector([Math.cos(theta), Math.sin(theta)]));
		super(gl, vertices);
	}
}


class GLInstanced extends GLPolygon {

	nInstances;

	constructor({gl, vertices}, nInstances) {
		super(gl, vertices);
		this.nInstances = nInstances;
	}

	render() {
		this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.buffer);
		this.gl.vertexAttribPointer(0, 2, this.gl.FLOAT, false, 0, 0);
		this.gl.enableVertexAttribArray(0);
		this.gl.drawArraysInstanced(this.gl.TRIANGLE_FAN, 0, this.sides, this.nInstances);
		return this;
	}
}


class GLProgram {

	gl;
	program;
	uniforms = new Map();
	attributes = new Map();

	constructor(gl, program) {
		this.gl = gl;
		this.program = program;
	}

	addUniform(name, setter) {
		this.uniforms.set(name, {
			location: this.gl.getUniformLocation(this.program, "u_" + name),
			setter: setter.bind(this.gl),
		});
		return this;
	}

	setUniform(name, value) {
		if (!this.uniforms.has(name)) {
			console.error("Attempted to set non-existent uniform", name);
			return;
		}
		const uni = this.uniforms.get(name);
		this.gl.useProgram(this.program);
		uni.setter(uni.location, value);
		return this;
	}

	addAttribute(name, usage, size, type, stride, divisor=0, offset=0) {
		const loc = this.gl.getAttribLocation(this.program, "a_" + name);
		const buffer = this.gl.createBuffer();
		this.gl.bindBuffer(this.gl.ARRAY_BUFFER, buffer);
		this.gl.enableVertexAttribArray(loc);
		this.gl.vertexAttribPointer(loc, size, type, false, stride, offset);
		this.gl.vertexAttribDivisor(loc, divisor);
		this.attributes.set(name, { loc, buffer, usage });
		return this;
	}

	setAttribute(name, data) {
		if (!this.attributes.has(name)) {
			console.error("Attempted to set non-existent attribute", name);
			return;
		}
		const attrib = this.attributes.get(name);
		this.gl.bindBuffer(this.gl.ARRAY_BUFFER, attrib.buffer);
		this.gl.bufferData(this.gl.ARRAY_BUFFER, data, attrib.usage);
		return this;
	}
}


class HexagonGrid {

	// The number of hexagonal 'layers' from the centre (not including centre piece)
	radius;
	cells;

	constructor(radius) {
		this.radius = radius;
		this.cells = new Map();
	}

	init(initFunc) {
		for (const [q, r] of this) {
			this.setCell(q, r, initFunc(q, r), true);
		}
		console.log(`Initialised hex grid of radius ${this.radius} with ${this.cells.size} cells`);
		return this;
	}

	/**
	 * Total number of cells in the grid
	 */
	get cellCount() {
		const sumN = N => N * (N + 1) / 2;
		return 1 + sumN(this.radius) * 6;
	}

	get cellArray() {
		const arr = [];
		// Cartesian coordinates (i, j)
		for (let i = -this.radius; i <= this.radius; i++) {
			for (let j = -this.radius; j <= this.radius; j++) {
				// Convert to axial coordinates (q, r)
				const q = j - (i + (i & 1)) / 2;
			    const r = i;
			    const cell = this.getCell(q, r);
			    if (cell !== undefined) arr.push(cell);
			}
		}
		return arr;
	}

	#axialHash(q, r) {
		return q.toString() + ',' + r.toString();
	}

	getCell(q, r) {
		const hash = this.#axialHash(q, r);
		return this.cells.get(hash);
	}

	setCell(q, r, value, canCreate=false) {
		if (Math.abs(q) > this.radius || Math.abs(r) > this.radius) {
			// Not a valid cell
			console.warn(`Attempted to set invalid cell (${q}, ${r})`);
			return;
		}
		const hash = this.#axialHash(q, r);
		if (!canCreate && !this.hasCell(q, r)) {
			console.error(`Cell (${q}, ${r}) does not exist`);
			return;
		}
		this.cells.set(hash, value);
	}

	hasCell(q, r) {
		return this.cells.has(this.#axialHash(q, r));
	}

	neighboursOf(q, r) {
		return [
			[q, r+1],
			[q, r-1],
			[q+1, r],
			[q-1, r],
			[q+1, r-1],
			[q-1, r+1]
		].filter(([q, r]) => this.hasCell(q, r));
	}

	*[Symbol.iterator]() {
		for (let q = -this.radius; q <= this.radius; q++) {
			for (let r = 1; r <= this.radius && Math.abs(r + q) <= this.radius; r++) {
				yield([q, r]);
			}
			for (let r = 0; r >= -this.radius && Math.abs(r + q) <= this.radius; r--) {
				yield([q, r]);
			}
		}
	}
}


class SnowflakeCell {

	u = 0; v = 0; u_next = 0; v_next = 0;

	constructor(s) {
		this.v = s;
	}

	get s() { return this.u + this.v; }
	get frozen() { return this.s >= 1; }
}


function evolveSnowflake(hexgrid, alpha, beta, gamma) {
	for (const [q, r] of hexgrid) {
		const cell = hexgrid.getCell(q, r);
		const neighbours = hexgrid.neighboursOf(q, r).map(([q, r]) => hexgrid.getCell(q, r));

		const receptive = cell.frozen || neighbours.some(c => c.frozen);
		if (receptive) {
			// This cell is frozen or has frozen neighbours, so it is receptive
			cell.v = cell.s;
			cell.u = 0;
		} else {
			cell.u = cell.s;
			cell.v = 0;
		}

		cell.u_next = cell.u;
		cell.v_next = cell.v;
	}

	for (const [q, r] of hexgrid) {
		const cell = hexgrid.getCell(q, r);
		const neighbours = hexgrid.neighboursOf(q, r).map(([q, r]) => hexgrid.getCell(q, r));
		const receptive = cell.frozen || neighbours.some(c => c.frozen);

		if (neighbours.length < 6) {
			// This is an edge cell, just ensure it keeps background state
			cell.u = cell.u_next = beta;
			cell.v = cell.v_next = 0;
			continue;
		}

		// Constant addition
		if (receptive) {
			cell.v_next = cell.v + gamma;
		}

		// Diffusion
		const u_avg = neighbours.reduce((acc, c) => acc + c.u, 0) / 6;
		cell.u_next = cell.u + 0.5 * alpha * (u_avg - cell.u);
	}

	// Finally, update all the cells to their new values
	let maximum = 1;
	for (const [q, r] of hexgrid) {
		const cell = hexgrid.getCell(q, r);
		cell.u = cell.u_next;
		cell.v = cell.v_next;
		maximum = Math.max(maximum, cell.s);
	}

	return maximum;
}


window.addEventListener("load", async function() {

	const sim = new Simulation("webgl2");
	const gl = sim.ctx;
	const program = await sim.createShaderProgram("/shaders/snowflake.vs", "/shaders/snowflake.fs");

	const programWrapper = new GLProgram(gl, program)
		// Define uniforms
		.addUniform("resolution", gl.uniform2fv)
		.addUniform("gridradius", gl.uniform1i)
		.addUniform("accentcolor", gl.uniform3fv)
		// Add attributes
		.addAttribute("color", gl.DYNAMIC_DRAW, 1, gl.FLOAT, 4, 1);

	gl.useProgram(program);
	gl.enable(gl.DEPTH_TEST);

	const params = {
		alpha: 2.003,
		beta: 0.4,
		gamma: 0.0001,
	};

	// Set up the grid and the hexagon we're going to render many times
	let grid = new HexagonGrid(100).init(() => new SnowflakeCell(params.beta));
	grid.setCell(0, 0, new SnowflakeCell(1));
	const hex = new GLInstanced(new GLHexagon(gl), grid.cellCount);
	let oneRender = true;

	// Set up the UI
	const playPauseButton = new Button("playpause", "Pause", playPause);
	const gridKnob = new Knob("gridradius", "Grid Radius", "cells", grid.radius, 10, 150, 1, value => {
		const new_grid = new HexagonGrid(value).init((q, r) => grid.getCell(q, r) || new SnowflakeCell(params.beta));
		grid = new_grid;
		hex.nInstances = grid.cellCount;
		if (!sim.timer.isPaused) playPause();
		oneRender = true;
	});
	new Knob("alpha", "Diffusion (alpha)", "", params.alpha, 0.2, 2.5, 0.01, value => params.alpha = value);
	const betaKnob = new Knob("beta", "Background Vapour Level (beta)", "", params.beta, 0, 0.95, 0.01, value => {
		params.beta = value;
		grid.init(() => new SnowflakeCell(params.beta));
		grid.setCell(0, 0, new SnowflakeCell(1));
		oneRender = true;
	});
	new Knob("gamma", "Vapour Addition (gamma)", "", params.gamma, 0, 0.01, 0.0001, value => params.gamma = value);
	new Button("reset", "Reset", () => {
		if (!sim.timer.isPaused) playPause();
		gridKnob.setDisabled(false);
		betaKnob.setDisabled(false);
		grid.init(() => new SnowflakeCell(params.beta));
		grid.setCell(0, 0, new SnowflakeCell(1));
		oneRender = true;
	});

	// A function to toggle the play state, changing the text on the button as appropriate
	function playPause() {
		if (playPauseButton) playPauseButton.DOM.removeEventListener("click", playPause);
		if (sim.timer.isPaused) {
			sim.timer.start();
			playPauseButton.DOM.textContent = "Pause";
		} else {
			sim.timer.pause();
			playPauseButton.DOM.textContent = "Play";
		}
	};

	sim.render = function() {

		if (!sim.timer.isPaused) {
			gridKnob.setDisabled(true);
			betaKnob.setDisabled(true);
			evolveSnowflake(grid, params.alpha, params.beta, params.gamma);
		}

		if (sim.timer.isPaused && !oneRender) return;

		gl.clearColor(...hexToRGB(sim.colours.accent).map(x => x/255), 1.0);
		gl.clear(gl.COLOR_BUFFER_BIT);

		gl.useProgram(program);
		programWrapper
			.setUniform("resolution", new Float32Array([sim.canvas.width, sim.canvas.height]))
			.setUniform("gridradius", grid.radius)
			.setUniform("accentcolor",
				new Float32Array(hexToRGB(sim.colours.accent).map(x => x/255))
			)
			.setAttribute("color", new Float32Array(grid.cellArray.map(c => c.s)));

		hex.render();

		oneRender = false;
	};

	window.addEventListener("keypress", e => {
		if (e.code === "Enter") {
			console.log(grid.getCell(grid.radius, 0).s);
		}
	});

	sim.start();
	playPause();

});
