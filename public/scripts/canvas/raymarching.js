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

		const resolutionLoc = gl.getUniformLocation(program, "u_resolution");
		const cameraposLoc = gl.getUniformLocation(program, "u_camerapos");

		const shadowsharpLoc = gl.getUniformLocation(program, "u_shadowsharp");
		const smoothingLoc = gl.getUniformLocation(program, "u_smoothing");
		const reflectLoc = gl.getUniformLocation(program, "u_reflect");
		const reflectcountLoc = gl.getUniformLocation(program, "u_reflectcount");
		const floorreflectLoc = gl.getUniformLocation(program, "u_floorreflect");

		const sphereposLoc = gl.getUniformLocation(program, "u_spherepos");
		const sphereradLoc = gl.getUniformLocation(program, "u_sphererad");
		const boxposLoc = gl.getUniformLocation(program, "u_boxpos");
		const boxdimsLoc = gl.getUniformLocation(program, "u_boxdims");
		const torusposLoc = gl.getUniformLocation(program, "u_toruspos");
		const torusdimsLoc = gl.getUniformLocation(program, "u_torusdims");
		const cylinderposLoc = gl.getUniformLocation(program, "u_cylinderpos");
		const cylinderdimsLoc = gl.getUniformLocation(program, "u_cylinderdims");

		gl.uniform1f(shadowsharpLoc, 24);
		gl.uniform1f(smoothingLoc, 0.00666);
		gl.uniform1f(reflectLoc, 10 / 150);
		gl.uniform1i(reflectcountLoc, 2);
		gl.uniform1i(floorreflectLoc, 0);

		let cameraangle = 130 * Math.PI / 180;
		let cameraheight = 0.6;

		sim.render = function() {
			const camera = new Float32Array([Math.sin(cameraangle), cameraheight, 1.0 + Math.cos(cameraangle)]);

			gl.clearColor(0, 1, 0, 1);
			gl.clear(gl.COLOR_BUFFER_BIT);

			gl.useProgram(program);

			gl.uniform2fv(resolutionLoc, new Float32Array([sim.canvas.width, sim.canvas.height]));
			gl.uniform3fv(cameraposLoc, camera);

			gl.uniform3fv(sphereposLoc, new Float32Array([0.1, 0.1, 1.0]));
			gl.uniform1f(sphereradLoc, 0.1);

			gl.uniform3fv(boxposLoc, new Float32Array([-0.2, 0.15, 1.0]));
			gl.uniform3fv(boxdimsLoc, new Float32Array([0.07, 0.15, 0.1]));

			gl.uniform3fv(torusposLoc, new Float32Array([0.1, 0.22 + 0.03 * Math.sin(sim.time), 1.0]));
			gl.uniform2fv(torusdimsLoc, new Float32Array([0.06, 0.015]));

			gl.uniform3fv(cylinderposLoc, new Float32Array([-0.2, 0.24, 1.0]));
			gl.uniform2fv(cylinderdimsLoc, new Float32Array([0.03, 0.07]));

			gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
			gl.drawArrays(gl.TRIANGLES, 0, positions.length / 3);
		};

		sim.addSlider("cameraangle", "Camera angle", "°", 130, 0, 360, 0.1, value => cameraangle = value * Math.PI / 180);
		sim.addSlider("cameraheight", "Camera height", "m", 6, 2, 20, 0.1, value => cameraheight = value / 10);
		sim.addSlider("shadowsharp", "Shadow sharpness", "%", 20, 0, 100, 1, value => gl.uniform1f(shadowsharpLoc, 8 + 80 * value / 100));
		sim.addSlider("smoothing", "Union smoothing", "%", 20, 0, 100, 1, value => gl.uniform1f(smoothingLoc, value / 3000));
		sim.addSlider("reflect", "Reflectiveness", "%", 10, 0, 100, 1, value => gl.uniform1f(reflectLoc, (value + 1) / 200));
		sim.addSlider("reflectcount", "Number of reflections", "", 2, 0, 4, 1, value => gl.uniform1i(reflectcountLoc, value));
		sim.addCheckbox("floorreflect", "Reflective floor", false, value => gl.uniform1i(floorreflectLoc, value ? 1 : 0));

		sim.start();

	}).catch(console.error);

});