window.addEventListener("load", function() {

	'use strict';

	const sim = new Simulation();
	sim.scale = 5;

	const params = {
		k: 1,
		b: 0.5,
		mass: 0.1,
		bond_length: 1
	};

	const state = {
		atoms: [],
		selected: null
	};

	const getDisplacement = (p1, p2) =>
		({ x: p2.x - p1.x, y: p2.y - p1.y });

	const getMagnitude = ({ x, y }) =>
		Math.sqrt(Math.pow(x, 2) + Math.pow(y, 2));

	const getDistance = (p1, p2) =>
		getMagnitude(getDisplacement(p1, p2));

	const createAtom = (x, y, mass) =>
		state.atoms.push({
			pos: { x, y },
			vel: { x: 0, y: 0 },
			acc: { x: 0, y: 0 },
			mass,
			bonds: []
		});

	const calcRadius = atom =>
		Math.cbrt(3/(4 * Math.PI) * atom.mass);

	const toggleBond = (atom1, atom2) => {
		const i = atom1.bonds.findIndex(x => x === atom2);
		if (i > -1) {
			// Bond already exists, remove
			atom1.bonds.splice(i, 1);
			atom2.bonds.splice(atom2.bonds.findIndex(x => x === atom1), 1);
		} else {
			atom1.bonds.push(atom2);
			atom2.bonds.push(atom1);
		}
	};

	const clearForcesOnAtom = atom =>
		atom.acc.x = atom.acc.y = 0;

	const calcForcesOnAtom = atom =>
		atom.bonds.forEach(other => {
			const d = getDisplacement(atom.pos, other.pos);
			let d_mag = getMagnitude(d);
			if (d_mag === 0) d_mag = 1; // Remove the singularity where the atoms are in the same place
			const d_unit = { x: d.x / d_mag, y: d.y / d_mag };
			const spring_force_mag = params.k * (d_mag - params.bond_length);

			let vel_mag = Math.sqrt(Math.pow(atom.vel.x, 2) + Math.pow(atom.vel.y, 2));
			if (vel_mag === 0) vel_mag = 1;
			const vel_unit = { x: atom.vel.x / vel_mag, y: atom.vel.y / vel_mag };
			const damping_force_mag = -params.b * vel_mag;

			atom.acc.x += (d_unit.x * spring_force_mag + vel_unit.x * damping_force_mag) / atom.mass;
			atom.acc.y += (d_unit.y * spring_force_mag + vel_unit.y * damping_force_mag) / atom.mass;
		});

	const updateAtom = (atom, delta) => {
		atom.vel.x += atom.acc.x * delta;
		atom.vel.y += atom.acc.y * delta;
		atom.pos.x += atom.vel.x * delta;
		atom.pos.y += atom.vel.y * delta;
	};

	const renderBond = (p1, p2, c) => {
		c.beginPath();
		c.moveTo(sim.mToPx(p1.x), sim.mToPx(p1.y));
		c.lineTo(sim.mToPx(p2.x), sim.mToPx(p2.y));
		c.closePath();
		c.stroke();
	};

	const renderAtom = (atom, c) => {
		const r = Math.cbrt(3/(4 * Math.PI) * atom.mass);
		c.beginPath();
		c.arc(sim.mToPx(atom.pos.x), sim.mToPx(atom.pos.y), sim.mToPx(r), 0, 2 * Math.PI);
		c.closePath();
		c.fill();
		atom.bonds.forEach(other => renderBond(atom.pos, other.pos, c));
	};

	sim.onmousedown = function() {
		if (sim.mouse.pressed !== 0) return;
		// Start making a bond if the mouse is over an existing atom, otherwise create a new atom
		const mousePos = { x: sim.pxToM(sim.mouse.x), y: sim.pxToM(sim.mouse.y) };
		state.selected = state.atoms.find(atom => getDistance(mousePos, atom.pos) < calcRadius(atom));
		if (!state.selected) createAtom(mousePos.x, mousePos.y, params.mass);
	};

	sim.onmouseup = function() {
		if (!state.selected) return;
		const mousePos = { x: sim.pxToM(sim.mouse.x), y: sim.pxToM(sim.mouse.y) };
		const selected = state.atoms.find(atom => getDistance(mousePos, atom.pos) < calcRadius(atom));
		if (selected && selected !== state.selected) {
			toggleBond(selected, state.selected);
		}
		state.selected = null;
	}

	sim.render = function(c) {
		state.atoms.forEach(clearForcesOnAtom);
		state.atoms.forEach(calcForcesOnAtom);
		state.atoms.forEach(atom => updateAtom(atom, sim.delta));

		c.clearRect(0, 0, sim.canvas.width, sim.canvas.height);
		state.atoms.forEach(atom => renderAtom(atom, c));
		if (state.selected) renderBond({ x: sim.mToPx(state.selected.pos.x), y: sim.mToPx(state.selected.pos.y) }, sim.mouse, c);
	};

	sim.addSlider("Damping", "kg/s", params.b, 0.1, 1, 0.01)
		.addEventListener("update", e => params.b = e.detail);
	sim.addSlider("Spring Constant", "N/m", params.k, 0.1, 3, 0.01)
		.addEventListener("update", e => params.k = e.detail);
	sim.addSlider("Equilibrium length", "m", params.bond_length, 0.1, 3, 0.01)
		.addEventListener("update", e => params.bond_length = e.detail);
	sim.addSlider("Mass for new particles", "kg", params.mass, 0.01, 0.1, 0.001)
		.addEventListener("update", e => params.mass = e.detail);

	sim.start();

});
