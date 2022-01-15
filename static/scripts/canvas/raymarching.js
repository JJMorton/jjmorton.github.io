import {Simulation} from './main.js';
import {Mouse} from './main.js';
import {Vector} from './vector.js';

const createShaderProgram = (gl, vertFile, fragFile) => new Promise((resolve, reject) => {
	// Creates a shader program from vertex and fragment shader files

	const fetchFile = path => new Promise((resolve, reject) => {
		const request = new XMLHttpRequest();
		request.addEventListener("load", () => {
			if (request.status != 200) return reject(`Failed to fetch "${path}", response status ${request.status}`);
			resolve(request.responseText);
		});
		request.addEventListener("error", reject);
		request.addEventListener("abort", reject);
		request.open("GET", path);
		request.send();
	});

	const compileShader = (gl, src, type) => {
		const shader = gl.createShader(type);
		gl.shaderSource(shader, src);
		gl.compileShader(shader);
		if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
			console.error(`Could not compile ${type === gl.VERTEX_SHADER ? "vertex" : "fragment"} shader: ${gl.getShaderInfoLog(shader)}`)
			return null;
		}
		return shader;
	};

	fetchFile(vertFile).then(vertSrc => {
		fetchFile(fragFile).then(fragSrc => {

			// We have both the shaders as source code, compile them
			const vertShader = compileShader(gl, vertSrc, gl.VERTEX_SHADER);
			const fragShader = compileShader(gl, fragSrc, gl.FRAGMENT_SHADER);
			if (!vertShader || !fragShader) return reject("Failed to compile shaders, aborting");

			// Shaders compiled correctly, create and link program
			const program = gl.createProgram();
			gl.attachShader(program, vertShader);
			gl.attachShader(program, fragShader);
			gl.linkProgram(program);
			if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
				return reject(`Failed to link shader program: ${gl.getProgramInfoLog(program)}`)
			}

			// done :)
			resolve(program)

		}).catch(reject);
	}).catch(reject);

});

window.addEventListener("load", function() {

	'use strict';

	const sim = new Simulation("webgl2");
	const gl = sim.ctx;

	createShaderProgram(gl, "/scripts/canvas/raymarching/shader.vs", "/scripts/canvas/raymarching/shader.fs").then(program => {

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

		// Get locations of uniforms we can control
		const resolutionLoc = gl.getUniformLocation(program, "u_resolution");
		const cameraposLoc = gl.getUniformLocation(program, "u_camerapos");

		const shadowsharpLoc = gl.getUniformLocation(program, "u_shadowsharp");
		const smoothingLoc = gl.getUniformLocation(program, "u_smoothing");
		const shininessLoc = gl.getUniformLocation(program, "u_shininess");
		const aoLoc = gl.getUniformLocation(program, "u_ao");
		const showstepsLoc = gl.getUniformLocation(program, "u_showsteps");
		const shownormalLoc = gl.getUniformLocation(program, "u_shownormal");
		const showshadowLoc = gl.getUniformLocation(program, "u_showshadow");
		const showspecLoc = gl.getUniformLocation(program, "u_showspec");
		const sunLoc = gl.getUniformLocation(program, "u_sun");
		const skyLoc = gl.getUniformLocation(program, "u_sky");
		const antialiasLoc = gl.getUniformLocation(program, "u_antialias");

		const sphereposLoc = gl.getUniformLocation(program, "u_spherepos");
		const sphereradLoc = gl.getUniformLocation(program, "u_sphererad");
		const boxposLoc = gl.getUniformLocation(program, "u_boxpos");
		const boxdimsLoc = gl.getUniformLocation(program, "u_boxdims");
		const torusposLoc = gl.getUniformLocation(program, "u_toruspos");
		const torusdimsLoc = gl.getUniformLocation(program, "u_torusdims");
		const cylinderposLoc = gl.getUniformLocation(program, "u_cylinderpos");
		const cylinderdimsLoc = gl.getUniformLocation(program, "u_cylinderdims");

		// Set default values for them
		gl.uniform1f(shadowsharpLoc, 24);
		gl.uniform1f(smoothingLoc, 0.00666);
		gl.uniform1f(shininessLoc, 0.6);
		gl.uniform1f(aoLoc, 20.0);
		gl.uniform1i(showstepsLoc, 0);
		gl.uniform1i(shownormalLoc, 0);
		gl.uniform1i(showshadowLoc, 1);
		gl.uniform1i(showspecLoc, 1);
		gl.uniform1i(sunLoc, 1);
		gl.uniform1i(skyLoc, 1);
		gl.uniform1i(antialiasLoc, 0);

		let cameraangle = 130 * Math.PI / 180;
		let cameraheight = 0.6;
		let lastMousePos = new Vector([0, 0]);
		sim.onmousedown = function() {
			lastMousePos = new Vector([sim.mouse.x, sim.mouse.y]);
		};

		let needsRender = true;
		window.addEventListener("resize", () => needsRender = true);

		// Add the sliders to control them
		sim.addButton("playpause", "Start/stop animation", () => {
			if (sim.timer.isPaused)
				sim.timer.start();
			else
				sim.timer.pause();
		});
		sim.addSlider("shadowsharp", "Shadow sharpness", "%", 20, 0, 100, 1, value => { gl.uniform1f(shadowsharpLoc, 8 + 80 * value / 100); needsRender = true; });
		sim.addSlider("smoothing", "Union smoothing", "%", 20, 0, 100, 1, value => { gl.uniform1f(smoothingLoc, value / 3000); needsRender = true; });
		sim.addSlider("shininess", "Specular size", "%", 60, 0, 100, 1, value => { gl.uniform1f(shininessLoc, value / 100); needsRender = true; });
		sim.addSlider("ao", "Ambient occlusion strength", "%", 50, 0, 100, 1, value => { gl.uniform1f(aoLoc, 40 * value / 100); needsRender = true; });
		const stepsSlider = sim.addCheckbox("showsteps", "Show steps taken to reach surface", false, value => { gl.uniform1i(showstepsLoc, value ? 1 : 0); needsRender = true; });
		const normalSlider = sim.addCheckbox("shownormal", "Visualise normals", false, value => {
			gl.uniform1i(shownormalLoc, value ? 1 : 0);
			if (value) stepsSlider.setValue(false);
			needsRender = true;
		});
		sim.addCheckbox("showshadow", "Show shadows", true, value => { gl.uniform1i(showshadowLoc, value ? 1 : 0); needsRender = true; });
		sim.addCheckbox("showspec", "Show specular highlights", true, value => { gl.uniform1i(showspecLoc, value ? 1 : 0); needsRender = true; });
		sim.addCheckbox("sun", "Enable sun lighting", true, value => { gl.uniform1i(sunLoc, value ? 1 : 0); needsRender = true; });
		sim.addCheckbox("sky", "Enable sky lighting", true, value => { gl.uniform1i(skyLoc, value ? 1 : 0); needsRender = true; });
		sim.addCheckbox("antialias", "Enable antialiasing (large performance hit)", false, value => { gl.uniform1i(antialiasLoc, value ? 1 : 0); needsRender = true; });

		sim.render = function() {

			if (sim.mouse.pressed === Mouse.buttons.LEFT && (sim.mouse.x != lastMousePos.x || sim.mouse.y != lastMousePos.y)) {
				cameraangle += (sim.mouse.x - lastMousePos.x) * 2 * Math.PI / sim.canvas.width;
				cameraheight += (sim.mouse.y - lastMousePos.y) * 5 / sim.canvas.height;
				cameraheight = Math.max(Math.min(2, cameraheight), 0.2);
				lastMousePos = new Vector([sim.mouse.x, sim.mouse.y]);
				needsRender = true;
			}

			if (sim.timer.isPaused && !needsRender) return;
			needsRender = false;

			const camera = new Float32Array([Math.sin(cameraangle), cameraheight, 1.0 + Math.cos(cameraangle)]);

			if (stepsSlider.getValue()) normalSlider.setValue(false);

			gl.clearColor(0, 1, 0, 1);
			gl.clear(gl.COLOR_BUFFER_BIT);

			gl.useProgram(program);

			gl.uniform2fv(resolutionLoc, new Float32Array([sim.canvas.width, sim.canvas.height]));
			gl.uniform3fv(cameraposLoc, camera);

			gl.uniform3fv(sphereposLoc, new Float32Array([0.1, 0.1, 1.0]));
			gl.uniform1f(sphereradLoc, 0.1);

			gl.uniform3fv(boxposLoc, new Float32Array([-0.2, 0.15, 1.0]));
			gl.uniform3fv(boxdimsLoc, new Float32Array([0.07, 0.15, 0.1]));

			gl.uniform3fv(torusposLoc, new Float32Array([0.1, 0.22 + 0.03 * Math.sin(sim.timer.getTime()), 1.0]));
			gl.uniform2fv(torusdimsLoc, new Float32Array([0.06, 0.015]));

			gl.uniform3fv(cylinderposLoc, new Float32Array([-0.2, 0.24, 1.0]));
			gl.uniform2fv(cylinderdimsLoc, new Float32Array([0.03, 0.07]));

			gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
			gl.drawArrays(gl.TRIANGLES, 0, positions.length / 3);
		};

		sim.start();
		sim.timer.pause();

	}).catch(console.error);

});

