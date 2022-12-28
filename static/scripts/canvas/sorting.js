import {Simulation, ComboBox, Checkbox, Knob, Button} from './main.js';

window.addEventListener("load", function() {

	'use strict';

	const sim = new Simulation();

	const gendata = {
		sorted: n => new Array(n)
			.fill(1)
			.map((x, i) => i / (n - 1)),
		random: n => gendata.sorted(n)
			.map(val => [val, Math.random()])
			.sort((a, b) => a[1] - b[1])
			.map(arr => arr[0]),
		backwards: n => gendata.sorted(n)
			.reverse(),
		triangle: n => gendata.sorted(n)
			.map(x => Math.min(2 * x, 2 * (1 - x))),
		singleswap: n => {
			const arr = gendata.sorted(n);
			let i = Math.floor(Math.random() * n/2),
			    j = Math.floor(n/2 + Math.random() * n/2);
			[ arr[i], arr[j] ] = [ arr[j], arr[i] ];
			return arr;
		}
	};

	const sortmethods = {

		bubble: async (arr) => {
			let sorted = false;
			while (!sorted) {
				sorted = true;
				for (let i = 1; i < arr.length; i++) {
					if (await islessthan(arr, i, i - 1)) {
						await swap(arr, i, i - 1);
						sorted = false;
					}
				}
			}
		},

		insertion: async (arr) => {
			for (let i = 1; i < arr.length; i++) {
				let j = i;
				while (j > 0 && await islessthan(arr, j, j - 1)) {
					await swap(arr, j, j - 1);
					j--;
				}
			}
		},

		selection: async (arr) => {
			for (let i = 0; i < arr.length - 1; i++) {
				let minimum = i;
				for (let j = i + 1; j < arr.length; j++) {
					if (await islessthan(arr, j, minimum)) minimum = j;
				}
				if (minimum != i) await swap(arr, i, minimum);
			}
		},

		quick: async (arr) => {

			const partition = async (lo, hi) => {
				let p = Math.floor((lo + hi) / 2);
				let i = lo - 1,
				    j = hi + 1;

				while (true) {
					do {
						i++;
					} while (await islessthan(arr, i, p))
					do {
						j--;
					} while (await islessthan(arr, p, j))
					if (i >= j) {
						return j;
					}

					/*
					 * Because we want to highlight the values that are being compared,
					 * we have to know the index of the pivot. This is why we defined
					 * p as the index of the pivot, rather than its value.
					 * Due to this, if the pivot is swapped, we need to update p to address
					 * the new position of the pivot value.
					 */
					if (p == j) p = i;
					else if (p == i) p = j;

					await swap(arr, i, j);
				}

			};

			const sort = async (lo, hi) => {
				if (lo < hi) {
					const p = await partition(lo, hi);
					await sort(lo, p);
					await sort(p + 1, hi);
				}
			};

			await sort(0, arr.length - 1);

		}
	};

	const params = {
		showswap: true,
		showcompare: true,
		datalength: 50,
		delay: 10,
		datagen: gendata.random,
		method: sortmethods.bubble
	};

	const state = {
		data: gendata.sorted(params.datalength),
		comparisons: 0,
		swaps: 0,
		redraw: true,
		hiswap: [ -1, -1 ],
		hicompare: [ -1, -1 ],
		sorted: true,
		sorting: false
	};


	function delay() {
		return new Promise(res => setTimeout(res, params.delay));
	};

	async function swap(arr, i, j) {
		await delay();
		[ arr[i], arr[j] ] = [ arr[j], arr[i] ];
		state.swaps++;
		state.arr = arr;
		if (params.showswap) {
			state.hiswap = [i, j];
		}
		state.redraw = true;
	};

	// Tests that arr[lo] < arr[hi]
	async function islessthan(arr, lo, hi) {
		await delay();
		state.comparisons++;
		if (params.showcompare) {
			state.hicompare = [lo, hi];
			state.redraw = true;
		}
		return arr[lo] < arr[hi];
	};

	async function runsort(method) {
		startbutton.setDisabled(true);
		state.comparisons = 0;
		state.swaps = 0;
		state.hiswap = [ -1, -1 ];
		state.hicompare = [ -1, -1 ];
		state.sorted = false;
		state.sorting = true;

		await method(state.data);

		startbutton.setDisabled(false);
		state.hiswap = [ -1, -1 ];
		state.hicompare = [ -1, -1 ];
		state.sorted = true;
		state.sorting = false;
		state.redraw = true;
	};

	function drawWithFillStyle(fillStyle, drawFunc) {
		const fillStyleOrig = sim.ctx.fillStyle;
		sim.ctx.fillStyle = fillStyle;
		drawFunc(fillStyle);
		sim.ctx.fillStyle = fillStyleOrig;
	};


	/* Main render loop */

	sim.render = function() {

		if (!state.redraw) return;
		state.redraw = false;

		sim.ctx.clearRect(0, 0, sim.canvas.width, sim.canvas.height);

		drawWithFillStyle(state.sorted ? sim.colours.accent : sim.ctx.fillStyle, fillStyle => {

			const barwidth = sim.canvas.width / state.data.length;
			state.data.map(h => h * sim.canvas.height * 0.9).forEach((h, i) => {
				let barcolor = fillStyle;
				if (state.hiswap.includes(i)) barcolor = "#ff0000";
				else if (state.hicompare.includes(i)) barcolor = sim.colours.accent;
				drawWithFillStyle(
					barcolor,
					() => sim.ctx.fillRect(barwidth * i, sim.canvas.height - h, barwidth, h)
				);
			});

		});
	
		sim.ctx.font = `${0.7 * window.devicePixelRatio}em sans-serif`;
		sim.ctx.fillText(`comparisons: ${state.comparisons}, swaps: ${state.swaps}`, 20, 30);

	};


	/* We need to redraw the canvas when the window is resized */

	window.addEventListener("resize", () => state.redraw = true);
	window.addEventListener("recolour", () => state.redraw = true);


	/* Create controls */

	new Knob("datalength", "Data points", "", params.datalength, 10, 100, 1, value => params.datalength = value);

	new ComboBox("datagen", "Data distribution", value => {
		params.datagen = value;
		if (state.sorting) return;
		state.data = value(params.datalength);
		state.sorted = false;
		state.redraw = true;
	})
		.addOption({name: "Random",      value: gendata.random})
		.addOption({name: "Backwards",   value: gendata.backwards})
		.addOption({name: "Triangle",    value: gendata.triangle})
		.addOption({name: "Single Swap", value: gendata.singleswap})
		.addOption({name: "Sorted",      value: gendata.sorted});

	new ComboBox("method", "Sorting Method", value => params.method = value)
		.addOption({name: "Bubble Sort", value: sortmethods.bubble})
		.addOption({name: "Quick Sort", value: sortmethods.quick})
		.addOption({name: "Insertion Sort", value: sortmethods.insertion})
		.addOption({name: "Selection Sort", value: sortmethods.selection});

	const startbutton = new Button("start", "Sort", () => {
		if (state.sorted) state.data = params.datagen(params.datalength);
		runsort(params.method);
	});

	new Checkbox("showswap", "Show swaps", params.showswap, value => {
		params.showswap = value;
		state.hiswap = [ -1, -1 ];
		state.redraw = true;
	});
	new Checkbox("showcompare", "Show comparisons", params.showcompare, value => {
		params.showcompare = value;
		state.hicompare = [ -1, -1 ];
		state.redraw = true;
	});

	new Knob("speed", "Speed", "operations/s", 1000/params.delay, 1, 200, 1, value => params.delay = 1000/value);

	sim.start();

});
