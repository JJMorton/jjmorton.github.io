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

		bubble: async (arr, setter) => {

			let sorted = true;
			for (let i = 1; i < arr.length; i++) {

				state.comparisons++;
				if (arr[i] < arr[i - 1]) {
					state.swaps++;
					[arr[i - 1], arr[i]] = [arr[i], arr[i - 1]];
					sorted = false;
					setter(arr);
					await delay();
				}
			}

			if (!sorted) await sortmethods.bubble(arr, setter);
		},

		quick: async (arr, setter) => {

			const partition = async (lo, hi) => {
				const pivot = arr[Math.floor((lo + hi) / 2)];
				let i = lo - 1,
				    j = hi + 1;

				while (true) {
					do {
						i++;
						state.comparisons++;
					} while (arr[i] < pivot)
					do {
						j--;
						state.comparisons++;
					} while (arr[j] > pivot)
					if (i >= j) {
						return j;
					}
					[ arr[i], arr[j] ] = [ arr[j], arr[i] ];
					state.swaps++;
					setter(arr);
					await delay();
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
		datalength: 50,
		delay: 0,
		datagen: gendata.random,
		method: sortmethods.bubble
	};

	const state = {
		data: gendata.sorted(params.datalength),
		comparisons: 0,
		swaps: 0,
		redraw: true,
		setter: arr => {
			state.data = arr;
			state.redraw = true;
		}
	};

	const delay = () => {
		return new Promise(res => setTimeout(res, params.delay));
	};


	async function runsort(arr, method) {
		startbutton.disabled = true;
		state.comparisons = 0;
		state.swaps = 0;
		state.setter(arr);
		await method(arr, state.setter);
		startbutton.disabled = false;
	};

	/* We need to redraw the canvas when the window is resized */
	window.addEventListener("resize", () => state.redraw = true);

	sim.render = function() {

		if (!state.redraw) return;
		state.redraw = false;
	
		sim.ctx.clearRect(0, 0, sim.canvas.width, sim.canvas.height);

		const barwidth = sim.canvas.width / state.data.length;
		state.data
			.map(h => h * sim.canvas.height)
			.forEach((h, i) => sim.ctx.fillRect(barwidth * i, sim.canvas.height - h, barwidth, h));

		sim.ctx.fillText(`comparisons: ${state.comparisons}, swaps: ${state.swaps}`, 10, 20);

	};


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

	const methodoptions = [ "Bubble Sort", "Quick Sort" ];
	sim.addComboBox("Sorting Method", methodoptions, 0).addEventListener("update", e => {
		switch (e.detail) {
			case 0: params.method = sortmethods.bubble; break;
			case 1: params.method = sortmethods.quick; break;
		}
	});

	const startbutton = sim.addButton("Sort", () => runsort(params.datagen(params.datalength), params.method));

	sim.addSlider("Speed", "", 10 - params.delay, 0, 10, 1).addEventListener("update", e => params.delay = 10 - e.detail);

	sim.start();

});
