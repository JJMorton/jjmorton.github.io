'use strict';

window.addEventListener("load", function() {

	/*
	 * The DOM elements used for user input
	 */

	const buttons = {
		start: document.getElementById("lmc-btn-start"),
		stop: document.getElementById("lmc-btn-stop"),
		reset: document.getElementById("lmc-btn-reset"),
		load: document.getElementById("lmc-btn-load"),
		input: document.getElementById("lmc-btn-input")
	};
	const textboxes = {
		program: document.getElementById("lmc-code-input"),
		input: document.getElementById("lmc-input"),
		output: document.getElementById("lmc-output"),
		pc: document.getElementById("lmc-program-counter"),
		acc: document.getElementById("lmc-accumulator")
	};
	const memoryboxes = Array.from(document.getElementsByClassName("lmc-memory"));


	/*
	 * The memory and registers for the LMC
	 */

	const computer = {
		memory: new Array(99).fill(0),
		pc: 0,
		acc: 0,
		timerID: 0 // The ID of the timer executing instructions
	};

	computer.setMemory = function(addr, val) {
		computer.memory[addr] = val;
		memoryboxes[addr].value = val;
	};

	computer.setProgramCounter = function(addr) {
		computer.pc = addr;
		textboxes.pc.value = addr;
		memoryboxes.forEach((elt, addr) => {
			elt.setAttribute("highlight", addr === computer.pc);
		});
	};

	computer.setAccumulator = function(val) {
		computer.acc = val;
		textboxes.acc.value = val;
	};

	computer.start = function() {
		computer.timerID = window.setInterval(function() {
			switch (computer.execute()) {
				case 0:
					statemachine.dispatch("stop");
					break;
				case 1:
					break;
				case 2:
					statemachine.dispatch("wait");
					break;
			}
		}, 1000);
	};

	computer.stop = function() {
		window.clearInterval(computer.timerID);
	};

	computer.giveInput = function(input) {
		computer.setAccumulator(input);
		computer.start();
	};

	// Returns the state of the computer:
	// 0: finished, should be stopped
	// 1: still running
	// 2: requires input
	computer.execute = function() {
		const code = computer.memory[computer.pc];
		const instruction = Math.floor(code / 100);
		const address = code % 100;
		computer.setProgramCounter(computer.pc + 1);
		switch (instruction) {
			case 0: // HLT
				return 0;
			case 1: // ADD
				computer.setAccumulator(computer.acc + computer.memory[address]);
				break;
			case 2: // SUB
				computer.setAccumulator(computer.acc - computer.memory[address]);
				break;
			case 3: // STA
				computer.setMemory(address, computer.acc);
				break;
			case 5: // LDA
				computer.setAccumulator(computer.memory[address]);
				break;
			case 6: // BRA
				computer.setProgramCounter(address);
				break;
			case 7: // BRZ
				if (computer.acc === 0) computer.setProgramCounter(address);
				break;
			case 8: // BRP
				if (computer.acc >= 0) computer.setProgramCounter(address);
				break;
			case 9:
				if (address === 1) { // INP
					return 2;
					break;
				} else if (address === 2) { // OUT
					textboxes.output.value += `${computer.acc}\n`;
					break;
				}
			default:
				console.error("Invalid instruction reached, halting...");
				return 0;
		}

		return 1;
	};


	/*
	 * State machine to keep track of allowed user interactions based on the state of the computer
	 */

	const statemachine = new (function() {

		// Available states for the computer to be in
		const states = {
			EMPTY: "empty",     // No code has been loaded, memory is all zero
			IDLE: "idle",       // Code has been loaded, but computer is not running
			RUNNING: "running", // Computer is running
			INPUT: "input"      // An input is required
		};

		// State currently occupied
		let state = null;

		// Operations allowed in each state
		const transitions = {

			[states.EMPTY]: {
				load: () => {
					// Load the written machine code into the computer's memory

					let valid = true;

					// A line representing an instruction
					const instructionExp = new RegExp("^([1-3|5-8][0-9]{2}|901|902|000)$");
					// A line representing data
					const datExp = new RegExp("^[0-9]+$");
					// A line that should be ignored
					const ignoreExp = new RegExp("^$|^//");

					// Validate the program and remove comments and blank lines
					const codes = [];
					for (let line of textboxes.program.value.split("\n")) {
						line = line.trim();
						if (instructionExp.test(line) || datExp.test(line)) {
							codes.push(parseInt(line));
						} else if (!ignoreExp.test(line)) {
							valid = false;
						}
					}
					if (codes.length === 0) valid = false;

					if (!valid) {
						textboxes.program.setAttribute("invalid", "");
						return;
					} else {
						textboxes.program.removeAttribute("invalid");
					}

					// Put the instructions and data in the computer's memory
					codes.forEach((code, addr) => computer.setMemory(addr, code));
					changeStateTo(states.IDLE);
				}
			},

			[states.IDLE]: {
				start: () => {
					// Start running the computer from the current instruction
					computer.start();
					changeStateTo(states.RUNNING);
				},
				reset: () => {
					// Reset the computer
					for (let addr = 0; addr < computer.memory.length; addr++) computer.setMemory(addr, 0);
					computer.setProgramCounter(0);
					computer.setAccumulator(0);
					textboxes.output.value = textboxes.input.value = "";
					changeStateTo(states.EMPTY);
				}
			},

			[states.RUNNING]: {
				stop: () => {
					// Stop the computer's execution
					computer.stop();
					changeStateTo(states.IDLE);
				},
				wait: () => {
					computer.stop();
					changeStateTo(states.INPUT);
				},
			},

			[states.INPUT]: {
				input: () => {
					// Get an input from the user
					if (!textboxes.input.checkValidity()) return;
					computer.giveInput(parseInt(textboxes.input.value));
					textboxes.input.value = "";
					changeStateTo(states.RUNNING);
				}
			}

		};

		// Change state and update button availability
		function changeStateTo(newstate) {
			console.info(`Changing to state "${newstate}"`);
			state = newstate;
			// These elements get enabled when the respective action is available
			buttons.start.disabled = !transitions[state].hasOwnProperty("start");
			buttons.stop.disabled = !transitions[state].hasOwnProperty("stop");
			buttons.reset.disabled = !transitions[state].hasOwnProperty("reset");
			buttons.load.disabled = !transitions[state].hasOwnProperty("load");
			buttons.input.disabled = !transitions[state].hasOwnProperty("input");
			textboxes.program.disabled = !transitions[state].hasOwnProperty("load");
			textboxes.pc.disabled = !transitions[state].hasOwnProperty("start");
			textboxes.acc.disabled = !transitions[state].hasOwnProperty("start");
			textboxes.input.disabled = !transitions[state].hasOwnProperty("input");
		};

		// Carry out a transition
		this.dispatch = function(actionName) {
			if (!Object.values(states).includes(state)) return console.error("Invalid state");
			if (transitions[state].hasOwnProperty(actionName)) {
				console.info(`Dispatching action "${actionName}"...`);
				transitions[state][actionName]();
			}
		};

		// Initialize computer
		changeStateTo(states.IDLE);
		this.dispatch("reset");

	})();

	buttons.start.addEventListener("click", () => statemachine.dispatch("start"));
	buttons.stop.addEventListener("click", () => statemachine.dispatch("stop"));
	buttons.reset.addEventListener("click", () => statemachine.dispatch("reset"));
	buttons.load.addEventListener("click", () => statemachine.dispatch("load"));
	buttons.input.addEventListener("click", () => statemachine.dispatch("input"));

});

