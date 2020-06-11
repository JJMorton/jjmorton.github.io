'use strict';

const examples = [
	[ "" ],
	[ "INP", "OUT", "HLT" ],
	[ "// Get inputs", "INP", "STA num", "INP", "", "// Add together", "ADD num", "", "// Output", "OUT", "HLT", "num DAT 0" ],
	[ "// Get inputs", "INP", "STA numa", "INP", "STA numb", "STA result", "", "// Loop adding", "loop LDA numa", "SUB one", "STA numa", "BRZ end", "LDA numb", "ADD result", "STA result", "BRA loop", "", "// Print result", "end LDA result", "OUT", "HLT", "", "// Data", "result DAT 0", "numa DAT 0", "numb DAT 0", "one DAT 1" ],
	[ "// Outputs 1 if the first number is less,", "// 0 otherwise", "INP", "STA first", "INP", "SUB first", "BRP less", "", "LDA zero", "OUT", "HLT", "", "less LDA one", "OUT", "HLT", "", "first DAT 0", "zero DAT 0", "one DAT 1" ]
];


// Translates assembly code into machine code
const assemble = function(lines) {
	

	/*
	 * 1. Set up the state machine
	 */

	const states = {
		START: 0,
		HAVE_LABEL: 1, // After reading a label at the beginning of the line
		NEED_ADDR: 2,  // After an instruction that requires an address
		NEED_DATA: 3,  // After a DAT instruction
		VALID: 4,
		INVALID: 5
	};
	const transitions = {
		INSTR: 0,       // Instruction not requiring an argument
		INSTR_ADDR: 1,  // Instruction requiring address
		INSTR_DATA: 2,  // Instruction requiring data
		LABEL: 3,
		ADDR: 4,        // Memory address (or data, as an instruction is also valid data)
		DATA: 5,
		INVALID: 6
	};
	// Returns what type a symbol is
	const getTransition = function(symbol) {
		if (/^(INP|OUT|HLT)$/.test(symbol)) return transitions.INSTR;
		if (/^(ADD|SUB|STA|LDA|BRA|BRZ|BRP)$/.test(symbol)) return transitions.INSTR_ADDR;
		if (/^DAT$/.test(symbol)) return transitions.INSTR_DATA;
		if (/^[A-Z|a-z]+$/.test(symbol)) return transitions.LABEL;
		if (/^[0-9]{1,2}$/.test(symbol)) return transitions.ADDR;
		if (/^[0-9]{1,3}$/.test(symbol)) return transitions.DATA;
		return transitions.INVALID;
	};
	// The machine says which state to change to when given a symbol of a certain type
	// There is one state for every possible transition
	const machine = {
		[states.START]: [
			states.VALID, states.NEED_ADDR, states.NEED_DATA,
			states.HAVE_LABEL, states.INVALID, states.INVALID,
			states.INVALID
		],
		[states.HAVE_LABEL]: [
			states.VALID, states.NEED_ADDR, states.NEED_DATA,
			states.INVALID, states.INVALID, states.INVALID,
			states.INVALID
		],
		[states.NEED_ADDR]: [
			states.INVALID, states.INVALID, states.INVALID,
			states.VALID, states.VALID, states.INVALID,
			states.INVALID
		],
		[states.NEED_DATA]: [
			states.INVALID, states.INVALID, states.INVALID,
			states.INVALID, states.VALID, states.VALID,
			states.INVALID
		],
		[states.VALID]: [
			states.INVALID, states.INVALID, states.INVALID,
			states.INVALID, states.INVALID, states.INVALID,
			states.INVALID
		],
		[states.INVALID]: [
			states.INVALID, states.INVALID, states.INVALID,
			states.INVALID, states.INVALID, states.INVALID,
			states.INVALID
		]
	};
	const instructionCodes = {
		"ADD": 100,
		"SUB": 200,
		"STA": 300,
		"LDA": 500,
		"BRA": 600,
		"BRZ": 700,
		"BRP": 800,
		"INP": 901,
		"OUT": 902,
		"HLT": 0
	};


	/*
	 * 2. Remove comments and whitespace, anything that doesn't get executed
	 */

	console.info("[ASSEMBLER] Removing comments and whitespace...");
	lines = lines.map(line => line.trim());
	lines = lines.map(line => {
		const commentIndex = line.indexOf("//");
		return commentIndex > -1 ? line.substring(0, commentIndex) : line;
	});
	lines = lines.filter(line => line != "");
	if (lines.length === 0) {
		console.error("[ASSEMBLER] No instructions found");
		return null;
	}


	/*
	 * 3. Translate all the symbols into their machine codes, leaving out labels for now
	 */

	console.info("[ASSEMBLER] Parsing symbols...");

	// We will save labels for resolving afterwards
	const knownLabels = []; // { name, address } - labels that are defined in the assembly code
	const needLabels = [];  // { name, address } labels that are referenced in the assembly code

	let code = lines.map((line, lineIndex) => {

		// Sum the instructions, addresses and data on the line to find the machine code
		let state = states.START;
		const translatedLine = line.trim().split(/[ ]+/).filter(x => x != "").reduce((translatedSymbol, symbol, symbolIndex) => {

			// Set the new state of the state machine
			symbol = symbol.toUpperCase();
			const transition = getTransition(symbol);
			state = machine[state][transition];

			// Add any instructions, addresses or data to the result and save labels for resolving later
			if (state === states.INVALID) {
				console.error(`[ASSEMBLER] Invalid input on code line ${lineIndex + 1} at symbol ${symbol}`);
				return 0;
			} else if (transition === transitions.INSTR || transition === transitions.INSTR_ADDR) {
				return translatedSymbol + instructionCodes[symbol];
			} else if (transition === transitions.ADDR || transition === transitions.DATA) {
				return translatedSymbol + parseInt(symbol);
			} else if (transition === transitions.LABEL && state === states.HAVE_LABEL) {
				// Label was at beginning of line, definition
				knownLabels.push({name: symbol, address: lineIndex});
			} else if (transition === transitions.LABEL) {
				// Otherwise label is a reference
				needLabels.push({name: symbol, address: lineIndex});
			}

			return translatedSymbol;
		}, 0);

		if (state != states.VALID) {
			console.error(`[ASSEMBLER] Invalid syntax on code line ${lineIndex + 1}`);
			return null;
		} else {
			return translatedLine;
		}

	});

	// There was an invalid line
	if (code.includes(null)) return null;


	/*
	 * 4. Resolve all the labels
	 */

	console.info("[ASSEMBLER] Resolving labels...");
	for (const label of needLabels) {
		const matches = knownLabels.filter(x => x.name === label.name);
		if (matches.length === 0) {
			console.error(`[ASSEMBLER] Undefined reference to label ${label.name}`);
			return null;
		} else if (matches.length > 1) {
			console.error(`[ASSEMBLER] Conflicting definitions of label ${label.name}`);
			return null;
		} else {
			code[label.address] += matches[0].address;
		}
	}

	console.info("[ASSEMBLER] Assembled successfully");

	return code;
};

const parseMachineCode = function(lines) {
	console.info("[MACHINE CODE] Checking machine code...");
	let valid = true;

	// A line representing an instruction
	const instructionExp = new RegExp("^([1-3|5-8][0-9]{2}|901|902|000)$");
	// A line representing data
	const datExp = new RegExp("^[0-9]+$");
	// A line that should be ignored
	const ignoreExp = new RegExp("^$|^//");

	// Validate the program and remove comments and blank lines
	const codes = [];
	lines.forEach((line, lineIndex) => {
		line = line.trim();
		if (instructionExp.test(line) || datExp.test(line)) {
			codes.push(parseInt(line));
		} else if (!ignoreExp.test(line)) {
			console.error(`[MACHINE CODE] Error on line ${lineIndex + 1}`);
			valid = false;
		}
	});
	if (codes.length === 0) {
		valid = false;
		console.error("[MACHINE CODE] No instructions found");
	}

	if (valid) console.info("[MACHINE CODE] Success");

	return valid ? codes : null;
};

window.addEventListener("load", function() {

	/*
	 * The DOM elements used for user input
	 */

	const buttons = {
		start: document.getElementById("lmc-btn-start"),
		stop: document.getElementById("lmc-btn-stop"),
		reset: document.getElementById("lmc-btn-reset"),
		load: document.getElementById("lmc-btn-load"),
		assemble: document.getElementById("lmc-btn-assemble"),
		example: document.getElementById("lmc-example"),
		input: document.getElementById("lmc-btn-input")
	};
	const textboxes = {
		program: document.getElementById("lmc-code-input"),
		assembly: document.getElementById("lmc-assembly-input"),
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
		if (computer.pc > 99) {
			console.error("[LMC] Reached end of memory, halting...");
			statemachine.dispatch("stop");
			return;
		}
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
				console.error("[LMC] Invalid instruction reached, halting...");
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
			WAITING: "waiting"      // An input is required
		};

		// State currently occupied
		let state = null;

		// Operations allowed in each state
		const transitions = {

			[states.EMPTY]: {
				load: () => {
					// Load the written machine code into the computer's memory

					const codes = parseMachineCode(textboxes.program.value.split("\n"));

					if (codes === null) {
						textboxes.program.setAttribute("invalid", "");
						return;
					} else {
						textboxes.program.removeAttribute("invalid");
					}

					// Put the instructions and data in the computer's memory
					codes.forEach((code, addr) => computer.setMemory(addr, code));
					changeStateTo(states.IDLE);
				},
				assemble: () => {
					textboxes.program.value = "";
					const code = assemble(textboxes.assembly.value.split("\n"));
					if (code === null) {
						textboxes.assembly.setAttribute("invalid", "");
					} else {
						textboxes.assembly.removeAttribute("invalid");
						textboxes.program.value = code.join("\n");
					}
				},
				example: () => {
					const index = parseInt(buttons.example.value);
					if (examples[index]) {
						textboxes.assembly.value = examples[index].join("\n");
						textboxes.program.value = "";
					}
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
					changeStateTo(states.WAITING);
				},
			},

			[states.WAITING]: {
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
			console.info(`[STATE] Changing to state "${newstate}"`);
			state = newstate;
			// These elements get enabled when the respective action is available
			buttons.start.disabled = !transitions[state].hasOwnProperty("start");
			buttons.stop.disabled = !transitions[state].hasOwnProperty("stop");
			buttons.reset.disabled = !transitions[state].hasOwnProperty("reset");
			buttons.load.disabled = !transitions[state].hasOwnProperty("load");
			buttons.assemble.disabled = !transitions[state].hasOwnProperty("assemble");
			buttons.example.disabled = !transitions[state].hasOwnProperty("example");
			buttons.input.disabled = !transitions[state].hasOwnProperty("input");
			textboxes.program.disabled = !transitions[state].hasOwnProperty("load");
			textboxes.assembly.disabled = !transitions[state].hasOwnProperty("assemble");
			textboxes.pc.disabled = !transitions[state].hasOwnProperty("start");
			textboxes.acc.disabled = !transitions[state].hasOwnProperty("start");
			textboxes.input.disabled = !transitions[state].hasOwnProperty("input");
		};

		// Carry out a transition
		this.dispatch = function(actionName) {
			if (!Object.values(states).includes(state)) return console.error("[STATE] Invalid state");
			if (transitions[state].hasOwnProperty(actionName)) {
				console.info(`[STATE] Dispatching action "${actionName}"...`);
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
	buttons.assemble.addEventListener("click", () => statemachine.dispatch("assemble"));
	buttons.input.addEventListener("click", () => statemachine.dispatch("input"));
	buttons.example.addEventListener("input", () => statemachine.dispatch("example"));

});

