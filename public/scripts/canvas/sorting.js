window.addEventListener("load", function() {

	'use strict';

	const sim = new Simulation();

	const gendata = {
		sorted: n => new Array(n)
			.fill(1)
			.map((x, i) => i / (n - 1)),
		random: n => gendata.sorted(n)
			.map(val => ({ val, rand: Math.random() }))
			.sort((a, b) => a.rand < b.rand)
			.map(({ val, rand }) => val),
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
		showcompare: false,
		datalength: 50,
		delay: 20,
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
	};


	function delay() {
		return new Promise(res => setTimeout(res, params.delay));
	};

	async function swap(arr, i, j) {
		[ arr[i], arr[j] ] = [ arr[j], arr[i] ];
		state.swaps++;
		state.arr = arr;
		if (params.showswap) {
			state.hiswap = [i, j];
		}
		state.redraw = true;
		await delay();
	};

	// Tests that arr[lo] < arr[hi]
	async function islessthan(arr, lo, hi) {
		state.comparisons++;
		if (params.showcompare) {
			state.hicompare = [lo, hi];
			state.redraw = true;
			await delay();
		}
		return arr[lo] < arr[hi];
	};

	async function runsort(arr, method) {
		startbutton.disabled = true;
		state.comparisons = 0;
		state.swaps = 0;
		state.hiswap = [ -1, -1 ];
		state.hicompare = [ -1, -1 ];
		state.sorted = false;
		state.data = arr;

		await method(arr);

		startbutton.disabled = false;
		state.hiswap = [ -1, -1 ];
		state.hicompare = [ -1, -1 ];
		state.sorted = true;
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
			state.data.map(h => h * sim.canvas.height).forEach((h, i) => {
				let barcolor = fillStyle;
				if (state.hiswap.includes(i)) barcolor = "#ff0000";
				else if (state.hicompare.includes(i)) barcolor = sim.colours.accent;
				drawWithFillStyle(
					barcolor,
					() => sim.ctx.fillRect(barwidth * i, sim.canvas.height - h, barwidth, h)
				);
			});

		});
	
		sim.ctx.fillText(`comparisons: ${state.comparisons}, swaps: ${state.swaps}`, 10, 20);

	};


	/* We need to redraw the canvas when the window is resized */

	window.addEventListener("resize", () => state.redraw = true);


	/* Create controls */

	sim.addSlider("Data points", "", params.datalength, 10, 500, 1).addEventListener("update", e => params.datalength = e.detail);

	const datagenoptions = [ "Random", "Backwards", "Triangle", "Single Swap", "Sorted" ];
	sim.addComboBox("Data distribution", datagenoptions, 0).addEventListener("update", e => {
		switch (e.detail) {
			case 0: params.datagen = gendata.random; break;
			case 1: params.datagen = gendata.backwards; break;
			case 2: params.datagen = gendata.triangle; break;
			case 3: params.datagen = gendata.singleswap; break;
			case 4: params.datagen = gendata.sorted; break;
		}
	});

	const methodoptions = [ "Bubble Sort", "Quick Sort", "Insertion Sort", "Selection Sort" ];
	sim.addComboBox("Sorting Method", methodoptions, 0).addEventListener("update", e => {
		switch (e.detail) {
			case 0: params.method = sortmethods.bubble; break;
			case 1: params.method = sortmethods.quick; break;
			case 2: params.method = sortmethods.insertion; break;
			case 3: params.method = sortmethods.selection; break;
		}
	});

	const startbutton = sim.addButton("Sort", () => runsort(params.datagen(params.datalength), params.method));

	sim.addCheckbox("Show swaps", params.showswap).addEventListener("update", e => {
		params.showswap = e.detail;
		state.hiswap = [ -1, -1 ];
		state.redraw = true;
	});
	sim.addCheckbox("Show comparisons", params.showcompare).addEventListener("update", e => {
		params.showcompare = e.detail;
		state.hicompare = [ -1, -1 ];
		state.redraw = true;
	});

	sim.addSlider("Speed", "", (200 - params.delay) / 2, 0, 100, 1).addEventListener("update", e => params.delay = 200 - 2 * e.detail);

	sim.start();

});
