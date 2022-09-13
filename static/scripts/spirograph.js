
import {Simulation, Button, Knob, ComboBox, Checkbox} from './canvas/main.js';
import {Vector} from './canvas/vector.js';

/*
 * TODO: snap back to s=0 when detecting a completed pattern, to prevent slight drift due to
 * inexact perimeter matching.
 */

/*
 * TODO: cam shape with 4 circle segments?
 */


// I have visualised the parametric equations at https://www.desmos.com/calculator/ahhx7y1d00
class ParametricShape {

	/*
	 * A shape represented by a parametric equation, taking a single coordinate
	 * `s` (representing physical distance from 0 to the total perimeter) and
	 * returning (x, y).
	 *
	 * Within this class, `s` represents a physical distance along the perimeter,
	 * and `t` is the parametric coordinate
	 */

	static name = "";

	constructor() {
	}

	// The total perimeter of the shape
	get perimeter() {
		throw Error("Not implemented");
	}

	get maxRadius() {
		throw Error("Not implemented");
	}

	get minRadius() {
		throw Error("Not implemented");
	}

	// The sum of the external angles of the shape, up until `s` along the perimeter
	getAngle(s) {
// 		throw Error("Not implemented");
		const norm = this.getNormal(s);
		return Math.floor(s / this.perimeter) * 2 * Math.PI + Math.atan2(norm.y, norm.x);
	}

	// Returns the (outwards pointing) normal to the shape at the point `s`
	getNormal(s) {
		return this.getCoordinates(s).sub(this.getCoordinates(s - 0.0001)).rotate(-Math.PI/2).normalise();
	}

	// Returns the parametric equation, but takes a physical distance around the perimeter as input
	// Distance here can be negative
	getCoordinates(s) {
		const perim = this.perimeter;
		s = s % perim;
		if (s < 0) s += perim;
		return this.parametric(s);
	}

	getRotationAsWheel(guide, inside, sContact) {
		/*
		 * This shape is rotating around the guide shape.
		 * This shape and the guide are making contact a distance `sContact`
		 * along each of their perimeters (due to no slipping between them).
		 * Returns the angle that the wheel is rotated by.
		 * Assumes the guide shape to be centered at (0, 0).
		 */

		const sContactWheel = (inside ? 1 : -1) * sContact;

		// The normal to each of the shapes at their contact points
		const normGuide = guide.getNormal(sContact);
		const normWheel = this.getNormal(sContactWheel);

		// If the wheel is inside, align the normals. If outside, anti-align them.
		// theta = angle the wheel should be rotated by to make contact at the specified point.
		const theta = Math.atan2(normGuide.y, normGuide.x) - Math.atan2(normWheel.y, normWheel.x)
			+ (inside ? 0 : Math.PI);

		return theta;
	}

	getCentreAsWheel(guide, inside, sContact) {

		const theta = this.getRotationAsWheel(guide, inside, sContact);

		const sContactWheel = (inside ? 1 : -1) * sContact;

		// The point of contact on each of the shapes
		const contactGuide = guide.getCoordinates(sContact);
		const contactWheel = this.getCoordinates(sContactWheel);

		/*
		 * Take the vector from the centre of the wheel to its contact point,
		 * rotate it to (anti-)align the wheel's normal with the guide's, then
		 * subtract this vector from the guide's contact point position.
		 */
		const centreWheel = contactGuide.sub(contactWheel.rotate(theta));

		return centreWheel;
	}

	// `s` (from 0 to this.perimeter) --> (x, y)
	parametric(s) {
		throw Error("Not implemented");
	}

	draw(ctx, {fill=false, asring=false} = {}) {
		if (asring) {
			ctx.save();
			ctx.scale(1.3, 1.3);
			ctx.lineWidth /= 1.3;
			this.draw(ctx, {fill: true});
			ctx.restore();
		}
		ctx.moveTo(0, 0);
		ctx.beginPath();
		const perimeter = this.perimeter;
		const step = perimeter / 100;
		for (let s = 0; s <= perimeter + step; s += step) {
			const pos = this.getCoordinates(s);
			ctx.lineTo(pos.x, pos.y);
		}
		if (fill) {
			ctx.fill();
		}
		else if (asring) {
			ctx.globalCompositeOperation = "destination-out";
			ctx.save();
			ctx.fillStyle = "#000";
			ctx.fill();
			ctx.restore();
			ctx.globalCompositeOperation = "source-over";
		}
		ctx.stroke();
	}

	drawAsWheel(ctx, guide, inside, sContact) {
		const centre = this.getCentreAsWheel(guide, inside, sContact);
		const theta = this.getRotationAsWheel(guide, inside, sContact);
		ctx.save();
		ctx.translate(centre.x, centre.y);
		ctx.rotate(theta);
		this.draw(ctx, {fill: true});

		for (const point of this.penPoints()) {
			ctx.beginPath();
			ctx.arc(point.x, point.y, 0.02, 0, 2 * Math.PI);
			ctx.stroke();
		}

	}

	// Checks that `s` is equivalent to physical distance
	test() {
		console.log("===========", "Testing shape", this.constructor.name, "===========");
		console.log("Perimeter:", this.perimeter);
		let lengths = [];
		const step = 0.01;
		for (let i = 0; i < 500; i++) {
			const s1 = Math.random() * this.perimeter;
			const s2 = s1 + step;
			lengths.push(this.getCoordinates(s2).sub(this.getCoordinates(s1)).getSize());
		}
		const average = lengths.reduce((acc, val) => val + acc, 0) / lengths.length;
		console.log(`Average length: ${average} (Error of ${(average - step) / step})`);
	}

	// Creates a new shape with the specified perimeter, implement in derived classes with `withPerimeter`
	static _withPerimeter(shapeCreator, perim, rmin=0, rmax=10) {
		// Binary search for the correct parameter, must be between `rmin` and `rmax`
		const epsilon = 0.001;
		const maxIterations = 50;
		let r = 0.5 * (rmin + rmax);
		let shape, perimeter;
		for (let i = 0; i < maxIterations; i++) {
			shape = shapeCreator(r);
			perimeter = shape.perimeter;
			if (Math.abs(perimeter - perim) <= epsilon) {
				console.log(`Found ${shape.constructor.name} with specified perimeter in ${i} iterations`);
				return shape;
			}
			if (perimeter > perim) {
				rmax = r;
				r = 0.5 * (r + rmin);
			}
			else {
				rmin = r;
				r = 0.5 * (r + rmax);
			}
		}
		console.error(`Failed to find ${shape.constructor.name} with specified perimeter after ${maxIterations} iterations`)
		return shape;
	}

	penPoints() {
		throw Error("Not implemented");
	}

	static withPerimeter(perim, {param}) {
		throw Error("Not implemented");
	}
}

class Circle extends ParametricShape {
	static shape = "circle";
	constructor(radius) {
		super();
		this.r = radius;
	}
	get perimeter() {
		return 2 * Math.PI * this.r;
	}
	get minRadius() {
		return this.r;
	}
	get maxRadius() {
		return this.r;
	}
	parametric(s) {
		const t = s / this.r;
		return new Vector([this.r * Math.cos(t), this.r * Math.sin(t)]);
	}
	static withPerimeter(perim, _) {
		return new (this)(0.5 * perim / Math.PI); // Exact solution for a circle
	}
}

class CircleSpiral extends Circle {
	constructor(radius) {
		super(radius);
	}
	penPoints() {
		const points = [];
		const spacingR = 0.05;
		const arcLength = 0.3;
		let theta = 0;
		for (let r = spacingR; r < 0.9 * this.r; r += spacingR) {
			points.push(new Vector([r, 0]).rotate(theta));
			theta += arcLength / Math.pow(r, 0.7);
		}
		return points;
	}
}

class CircleArms extends Circle {
	constructor(radius) {
		super(radius);
	}
	penPoints() {
		const points = [new Vector([0, 0])];
		const spacingR = 0.2;
		const spacingTheta = Math.PI / 3;
		for (let r = spacingR; r < 0.9 * this.r; r += spacingR) {
			for (let angle = 0; angle < 6; angle++) {
				const theta = angle * spacingTheta;
				points.push(new Vector([r, 0]).rotate(theta));
			}
		}
		return points;
	}
}

class Rod extends ParametricShape {
	static shape = "rod";
	#l = 0; // Half-length of the rod
	#r = 0; // Radius of ends
	#a = 1; // Aspect ratio (width / length)
	constructor(length, aspectratio) {
		super();
		this.#a = aspectratio;
		this.#l = length * (1 - this.#a);
		this.#r = this.#a * length;
	}
	set length(val) {
		// When we set the length, scale up the entire rod, mantaining aspect ratio
		const gamma = val / this.length;
		this.#l *= gamma;
		this.#r *= gamma;
	}
	get length() {
		// Length is from tip to tip, i.e. the length of the straight section plus the radii of the ends
		return 2 * (this.#l + this.#r);
	}
	set aspectratio(val) {
		// When we set aspect ratio, keep the length the same and adjust width
		const length = this.length;
		this.#a = val;
		this.length = length;
	}
	get aspectratio() {
		return this.#a;
	}
	get perimeter() {
		return 2 * Math.PI * this.#r + 4 * this.#l;
	}
	get minRadius() {
		return this.#r;
	}
	get maxRadius() {
		return Infinity;
	}
	parametric(s) {
		// Make t=0 correspond with the centre of a straight edge
		s -= this.#l;
		if (s < 0) s += this.perimeter;

		// Curve on RHS
		if (s < Math.PI * this.#r) {
			return new Vector([-this.#r * Math.sin(s / this.#r) - this.#l, this.#r * Math.cos(s / this.#r)]);
		}
		// Straight edge at bottom
		else if (s < Math.PI * this.#r + 2 * this.#l) {
			return new Vector([-this.#l + s - Math.PI * this.#r, -this.#r]);
		}
		// Curve on LHS
		else if (s < 2 * Math.PI * this.#r + 2 * this.#l) {
			return new Vector([-this.#r * Math.sin((s - 2 * this.#l) / this.#r) + this.#l, this.#r * Math.cos((s - 2 * this.#l) / this.#r)]);
		}
		// Straight edge at top
		else {
			return new Vector([3 * this.#l - s + 2 * Math.PI * this.#r, this.#r]);
		}
	}
	penPoints() {
		const spacingR = 0.5 / (this.length);
		const spacingS = this.perimeter / 8;
		const points = [new Vector([0, 0])];
		for (let r = spacingR; r < 0.95; r += spacingR) {
			for (let s = 0; s < this.perimeter; s += spacingS) {
				points.push(this.getCoordinates(s).mult(r));
			}
		}
		return points;
	}
	static withPerimeter(perim, {aspectratio}) {
		const shapeCreator = r => new (this)(r, aspectratio);
		return super._withPerimeter(shapeCreator, perim);
	}
}

class Reuleaux extends ParametricShape {
	static shape = "reuleaux";
	#r = 0 // Radius of circle enclosing equilateral triangle
	#R = 0 // Radius of corners
	#h = 0 // Height below the top tip of the triangle that the centre of the corner circle is
	#phi = 0 // 1/2 the angle that the rounded corners cover
	constructor(radius, roundness) {
		super();
		this.#r = radius;
		this.#R = roundness * (Math.sqrt(3) - 1) * this.r;
		this.calcProperties();
	}
	set r(r) {
		this.#r = r;
		this.calcProperties();
	}
	get r() {
		return this.#r;
	}
	set roundness(val) {
		this.#R = val * (Math.sqrt(3) - 1) * this.r;
		this.calcProperties();
	}
	get roundness() {
		return this.#R / ((Math.sqrt(3) - 1) * this.r);
	}
	get perimeter() {
		const sideLength = Math.sqrt(3) * this.r * (2*Math.PI/3 - 2 * this.#phi);
		const cornerLength = this.#R * 2 * this.#phi;
		return (sideLength + cornerLength) * 3;
	}
	get minRadius() {
		return this.#R;
	}
	get maxRadius() {
		return this.roundness === 1 ? this.#R : Math.sqrt(3) * this.r;
	}
	calcProperties() {
		// Calculates this.#h and this.#phi
		const cospi6 = Math.cos(Math.PI / 6);
		const sinpi6 = Math.sin(Math.PI / 6);
		const root3 = Math.sqrt(3);
		const r = this.r;
		const R = this.#R;
		this.#h = root3 * r * cospi6 - Math.sqrt(Math.pow(root3 * r - R, 2) - 3 * r*r * sinpi6*sinpi6);
		const l = Math.sqrt(3 * r*r + this.#h*this.#h - 2 * root3 * r * this.#h * cospi6);
		this.#phi = Math.acos((3 * r*r + l*l - this.#h*this.#h) / (2 * root3 * r * l)) + Math.PI/6;
	}
	parametric(s) {
		const root3 = Math.sqrt(3);
		const sideLength = root3 * this.r * (2*Math.PI/3 - 2 * this.#phi);
		const cornerLength = this.#R * 2 * this.#phi;
		// For sides, 0 <= t <= 2pi/3 -2phi
		const side = t => new Vector([root3 * this.r * (Math.sin(t + this.#phi) - 0.5), this.r * (root3 * Math.cos(t + this.#phi) - 0.5)]);
		// For corners, 0 <= t <= 2phi
		const corner = t => new Vector([this.#R * Math.sin(t - this.#phi), this.#R * Math.cos(t - this.#phi) + this.r - this.#h]);

		const perim = this.perimeter;
		s = perim - s; // Defined the whole shape in the wrong direction, reverse s to fix
		s += sideLength/2; // Make s=0 correspond with centre of a side
		if (s > perim) s -= this.perimeter;

		if (s < sideLength) { // 1st side
			const t = s / (root3 * this.r);
			return side(t);
		}
		else if (s < sideLength + cornerLength) { // 1st corner
			const t = (s - sideLength) / this.#R;
			return corner(t).rotate(-2*Math.PI/3);
		}
		else if (s < 2*sideLength + cornerLength) { // 2nd side
			const t = (s - sideLength - cornerLength) / (root3 * this.r);
			return side(t).rotate(-2*Math.PI/3);
		}
		else if (s < 2*sideLength + 2*cornerLength) { // 2nd corner
			const t = (s - 2*sideLength - cornerLength) / this.#R;
			return corner(t).rotate(-4*Math.PI/3);
		}
		else if (s < 3*sideLength + 2 * cornerLength) { // 3rd side
			const t = (s - 2*sideLength - 2*cornerLength) / (root3 * this.r);
			return side(t).rotate(-4*Math.PI/3);
		}
		else { // 3rd corner
			const t = (s - 3*sideLength - 2*cornerLength) / this.#R;
			return corner(t);
		}
	}
	penPoints() {
		return [];
	}
	penPoints() {
		const spacingR = 0.25 / this.#r;
		const spacingS = this.perimeter / 6;
		const points = [new Vector([0, 0])];
		for (let r = spacingR; r < 0.95; r += spacingR) {
			for (let s = 0; s < this.perimeter; s += spacingS) {
				points.push(this.getCoordinates(s).mult(r));
			}
		}
		return points;
	}
	static withPerimeter(perim, {roundness}) {
		const shapeCreator = r => new (this)(r, roundness);
		return super._withPerimeter(shapeCreator, perim);
	}
}


class Line {
	constructor({width=0.01, colour="#000", lastTime=0} = {}) {
		// We inherit time from the previous line, but not position
		// as position can be discontinuous but time can't
		this.path = new Path2D();
		this.started = false;
		this.width = width;
		this.colour = colour;
		this.lastTime = lastTime;
		this.lastPoint = null;
		this.previousPoint = null;
	}
	get heading() {
		if (!this.lastPoint || !this.previousPoint) return null;
		const dl = this.lastPoint.sub(this.previousPoint);
		return dl.getHeading();
	}
	applyStyle(ctx) {
		ctx.lineWidth = this.width;
		ctx.strokeStyle = this.colour;
	}
	draw(ctx) {
		ctx.save();
		this.applyStyle(ctx);
		ctx.stroke(this.path);
		ctx.restore();
	}
	addPoint(point, time) {
		this.started = true;
		this.previousPoint = this.lastPoint;
		this.lastPoint = point;
		this.lastTime = time;
		this.path.lineTo(point.x, point.y);
	}
}

class Drawing {
	constructor() {
		this.lines = [new Line()];
		// The renderBuffer is used to store only the new section of the drawing

		this.renderBuffer = new Path2D();
	}
	get currentLine() {
		return this.lines[this.lines.length - 1];
	}
	get previousLine() {
		return this.lines.length === 1 ? null : this.lines[this.lines.length - 2];
	}
	get lastPoint() {
		return this.lines.length === 0 ? 0 : this.currentLine.lastPoint;
	}
	get lastTime() {
		return this.lines.length === 0 ? 0 : this.currentLine.lastTime;
	}
	get heading() {
		return this.currentLine ? this.currentLine.heading : null;
	}
	setStyle({ width, colour }) {
		// Set the current line's style
		// Will start a new line if anything has been drawn with the current one
		this.newLine();
		width = width || this.currentLine.width;
		colour = colour || this.currentLine.colour;
		this.currentLine.width = width;
		this.currentLine.colour = colour;
	}
	addPoint(point, time) {
		this.currentLine.addPoint(point, time);
		this.renderBuffer.lineTo(point.x, point.y);
	}
	newLine() {
		if (!this.currentLine.started) return;
		this.lines.push(new Line(this.currentLine));
		this.renderBuffer = new Path2D();
	}
	clear() {
		this.lines = [new Line(this.currentLine)];
		this.currentLine.lastTime = 0;
		this.renderBuffer = new Path2D();
	}
	undo() {
		if (this.lines.length > 1) {
			this.lines.pop();
		} else {
			this.lines[0] = new Line(this.currentLine);
			this.currentLine.lastTime = 0;
		}
		this.renderBuffer = new Path2D();
	}
	applyStyle(ctx) {
		this.currentLine.applyStyle(ctx);
	}
	draw(ctx) {
		this.lines.forEach(l => l.draw(ctx));
	}
	drawNewOnly(ctx) {
		// Draw only the new sections of the current line
		ctx.save();
		this.currentLine.applyStyle(ctx);
		ctx.stroke(this.renderBuffer);
		ctx.restore();
		// Create a new empty path for the buffer, and start it where the previous one left off
		this.renderBuffer = new Path2D();
		this.renderBuffer.lineTo(this.lastPoint.x, this.lastPoint.y);
	}
}


class Tutorial {

	currentStep;
	#hint;
	#stepCompleteCallback = this.nextStep.bind(this);
	steps;

	constructor() {
		this.currentStep = -1;
		this.steps = [];
		this.#hint = document.createElement("p");
		this.#hint.classList.add("hint");
		window.addEventListener("wheel", this.#repositionHint.bind(this));
		window.addEventListener("touchmove", this.#repositionHint.bind(this));
		window.addEventListener("resize", this.#repositionHint.bind(this));
	}

	get started() { return this.currentStep >= 0; }
	get finished() { return this.currentStep >= this.steps.length; }

	createStep(element, text, events=[]) {
		this.steps.push({element, text, events});
		return this;
	}

	#repositionHint() {
		if (!this.started || this.finished) return;
		const element = this.steps[this.currentStep].element;
		const hint = this.#hint;
		const boundsElement = element.getBoundingClientRect();
		const boundsHint = hint.getBoundingClientRect();
		const minY = boundsHint.height / 2;
		const maxY = window.innerHeight - boundsHint.height / 2;
		const y = Math.min(maxY, Math.max(minY, boundsElement.top + boundsElement.height / 2));
		hint.style.top = `${y}px`;
	}

	#loadCurrentStep() {
		if (!this.started || this.finished) return;
		const step = this.steps[this.currentStep];
		step.element.scrollIntoView({behaviour: "smooth", block: "nearest"})
		const parent = step.element.offsetParent;
		this.#hint.classList.add(parent.offsetLeft > window.innerWidth / 2 ? "left" : "right");
		this.#hint.textContent = step.text;
		parent.appendChild(this.#hint);
		step.element.classList.add("hint-element");
		step.events.forEach(ev => step.element.addEventListener(ev, this.#stepCompleteCallback));
		this.#repositionHint();
	}

	#unloadCurrentStep() {
		if (!this.started || this.finished) return;
		const step = this.steps[this.currentStep];
		this.#hint.classList.remove("left");
		this.#hint.classList.remove("right");
		this.#hint.parentElement.removeChild(this.#hint);
		step.element.classList.remove("hint-element");
		step.events.forEach(ev => step.element.removeEventListener(ev, this.#stepCompleteCallback));
	}

	nextStep() {
		if (!this.started) console.log("Tutorial starting...");
		this.#unloadCurrentStep();
		this.currentStep++;
		this.#loadCurrentStep();
		if (this.finished) console.log("Tutorial finished");
		return this;
	}
}


// Script's main starts here
window.addEventListener("load", function() {

	'use strict';

	const sim = new Simulation();
	const drawCtx = sim.createOffscreenCanvas().ctx;
	const toolCtx = sim.createOffscreenCanvas().ctx;
	sim.scale = 10; // 10 inches in height

	let guide = new Circle(1.3);
	let wheel = null;
	let penPosition = null;

	let reRenderTools = true; // Force re-rendering of tools
	let reRenderDrawing = true; // Force re-rendering of entire drawing
	let recreateWheels = true; // Recreate the guide and wheel according to the controls' values
	let wheelIncompat = true; // The wheel is incompatible with the guide, draw in red

	const drawing = new Drawing();

	// Parameters that can be changed by the user via the GUI
	const controls = {

		holeNumber: new Knob("holenumber", "Hole #", "", 7, 1, 100, 1, () => recreateWheels = true),
		inside: new Checkbox("inside", "Inside Guide", true, () => recreateWheels = true),
		showTools: new Checkbox("showtools", "Show Tools", true, () => reRenderTools = true),
		guideSize: new Knob("guidesize", "Size", "in", 2, 0.2, 5, 0.1, () => recreateWheels = true),
		ratioGuide: new Knob("ratioguide", "Guide", "parts", 40, 1, 100, 1, () => recreateWheels = true),
		ratioWheel: new Knob("ratiowheel", "Wheel", "parts", 18, 1, 100, 1, () => recreateWheels = true),
		guideParam: new Knob("guideparam", "Shape", "%", 50, 10, 100, 1, () => recreateWheels = true).setDisabled(true),
		wheelParam: new Knob("wheelparam", "Shape", "%", 50, 10, 100, 1, () => recreateWheels = true).setDisabled(true),

		wheelType: new ComboBox("wheeltype", "Type")
			.addOption({ name: "Circle (spiral)", value: CircleSpiral })
			.addOption({ name: "Circle (spokes)", value: CircleArms })
			.addOption({ name: "Rod", value: Rod })
			.addOption({ name: "Reuleaux", value: Reuleaux }),

		guideType: new ComboBox("guidetype", "Type")
			.addOption({ name: "Circle", value: Circle })
			.addOption({ name: "Rod", value: Rod })
			.addOption({ name: "Reuleaux", value: Reuleaux }),

		startstop: new Button("stopstart", "Start/Stop"),

		speed: new Knob("speed", "Drawing Speed", "in/s", sim.timer.getTimescale(), 1, 10, 1, val => {
			sim.timer.setTimescale(val);
		}).setValue(5),

		undo: new Button("undo", "", () => {
			drawing.undo();
			sim.timer.setTime(drawing.lastTime);
			reRenderDrawing = true;
			reRenderTools = true;
		}),

		clear: new Button("clear", "", () => {
			if (!confirm("Are you sure you want to erase everything?")) return;
			drawing.clear();
			sim.timer.reset();
			reRenderDrawing = true;
			reRenderTools = true;
		}),

		save: new Button("save", "", () => {
			window.open(drawCtx.canvas.toDataURL(), "_blank");
		}),

		thickness0: new Button("thickness-0", "", () => { reRenderTools = true; drawing.setStyle({ width: 0.02 }) }),
		thickness1: new Button("thickness-1", "", () => { reRenderTools = true; drawing.setStyle({ width: 0.03 }) }),
		thickness2: new Button("thickness-2", "", () => { reRenderTools = true; drawing.setStyle({ width: 0.05 }) }),

		colour0: new Button("colour-0", "", () => { reRenderTools = true; drawing.setStyle({ colour: "#000000" }) }),
		colour1: new Button("colour-1", "", () => { reRenderTools = true; drawing.setStyle({ colour: "#5e5c64" }) }),
		colour2: new Button("colour-2", "", () => { reRenderTools = true; drawing.setStyle({ colour: "#9a9996" }) }),
		colour3: new Button("colour-3", "", () => { reRenderTools = true; drawing.setStyle({ colour: "#f66151" }) }),
		colour4: new Button("colour-4", "", () => { reRenderTools = true; drawing.setStyle({ colour: "#57e389" }) }),
		colour5: new Button("colour-5", "", () => { reRenderTools = true; drawing.setStyle({ colour: "#62a0ea" }) }),
		colour6: new Button("colour-6", "", () => { reRenderTools = true; drawing.setStyle({ colour: "#ffa348" }) }),
		colour7: new Button("colour-7", "", () => { reRenderTools = true; drawing.setStyle({ colour: "#c061cb" }) })
	};

	// Disable the shape parameter knobs when a circle is selected
	controls.wheelType.onUpdate(type => {
		recreateWheels = true;
		controls.wheelParam.setDisabled(type.shape === "circle");
	});
	controls.guideType.onUpdate(type => {
		recreateWheels = true;
		controls.guideParam.setDisabled(type.shape === "circle");
	});

	// Disable controls when pattern is being drawn
	controls.startstop.onUpdate(() => {
		if (sim.timer.isPaused) {
			drawing.newLine();
			sim.timer.start();
		} else {
			sim.timer.pause();
		}
		[controls.ratioGuide, controls.ratioWheel, controls.guideType, controls.guideSize, controls.wheelType, controls.inside, controls.holeNumber]
			.forEach(control => control.setDisabled(!sim.timer.isPaused));
		controls.startstop.setDisabled(false);
		controls.speed.setDisabled(false);
		controls.guideParam.setDisabled(!sim.timer.isPaused || controls.guideType.getValue().shape === "circle");
		controls.wheelParam.setDisabled(!sim.timer.isPaused || controls.wheelType.getValue().shape === "circle");
	});


	// Function to re-create the guide and wheel when relevant parameters are changed
	const createWheels = function() {

		// Create the guide
		let args = [controls.guideSize.getValue()];
		if (controls.guideType.getValue() !== Circle) args.push(controls.guideParam.getValue() / 100);
		guide = new (controls.guideType.getValue())(...args);

		// Create the drawing wheel
		args = [guide.perimeter * controls.ratioWheel.getValue() / controls.ratioGuide.getValue()];
		if (controls.wheelType.getValue().shape === "rod")
			args.push({aspectratio: controls.wheelParam.getValue() / 100});
		else if (controls.wheelType.getValue().shape === "reuleaux")
			args.push({roundness: controls.wheelParam.getValue() / 100});
		wheel = controls.wheelType.getValue().withPerimeter(...args);

		// Work out incompatabilities
		controls.inside.setDisabled(wheel.maxRadius === Infinity);
		if (wheel.maxRadius === Infinity && controls.inside.getValue()) {
			// The wheel's straight edge will never fit inside of the guide, move to the outside
			return controls.inside.setValue(false);
		}
		wheelIncompat = controls.inside.getValue() && wheel.maxRadius > guide.minRadius;
		controls.startstop.setDisabled(wheelIncompat);

		// Calculate the number of rotations required to complete this pattern
		let rots = 1;
		while ((controls.ratioGuide.getValue() * rots) % (controls.ratioWheel.getValue()) !== 0) {
			rots++;
			if (rots > 200) {
				console.error("max iterations");
				rots = 0;
				break;
			}
		}
		document.getElementById("pattern-rotations").textContent = rots;

		// Calculate the position of the pen
		const points = wheel.penPoints();
		const hole = Math.min(controls.holeNumber.getValue(), points.length);
		controls.holeNumber.max = points.length;
		controls.holeNumber.setValue(Math.max(hole, 1));
		controls.holeNumber.updateKnob();
		penPosition = points[hole - 1] || new Vector([0, 0]);

		recreateWheels = false;
		reRenderTools = true;
	};


	// The main rendering loop
	sim.render = function(ctx) {

		if (recreateWheels) {
			console.log("Recalculating wheels...");
			createWheels();
		}

		// Find the current parameter time
		let s = sim.timer.getTime();
		// If this is a new line, position ourselves exactly where the last line finished
		if (!drawing.currentLine.started) s = drawing.lastTime;

		// Returns the position of the pen at time s
		const calcPenPoint = s => wheel
			.getCentreAsWheel(guide, controls.inside.getValue(), s)
			.add(penPosition
// 				.add(wheel.getCoordinates(2 * controls.penPosition.getValue()/100 * wheel.perimeter)
// 				.mult(0.85 * controls.penPosition.getValue() / 100)
				.rotate(wheel.getRotationAsWheel(guide, controls.inside.getValue(), s)));
		let penPoint = calcPenPoint(s);

		// The path is being drawn, calculate next points and draw new section of path
		if (!sim.timer.isPaused) {

			/*
			 * If we simply draw one line segment per frame, we can end up with 'jagged' curves
			 * due to points being spaced too far apart.
			 * We can't simply use small fixed increments in s, as it does not correspond with
			 * the length of the line drawn.
			 * The approach taken here is to calculate the tangent to the line at the start
			 * and end of the line segment, and reduce the step size in s until the angle
			 * between these two tangents is small enough
			 */
			const maxAngle = Math.PI * 0.03; // Maximum arc to be covered by a single step
			let sLast = drawing.lastTime; // The time corresponding to the endpoint of the previous line segment
			let pointLast = drawing.lastPoint; // The endpoint of the previous line segment
			let ds = s - drawing.lastTime; // The increment in s corresponding to each line segment we will draw

			// If the line hasn't been started yet, we don't need to do any of this, just draw the start of it
			if (!drawing.currentLine.started) {
				drawing.addPoint(penPoint, s);

			} else {
				// Returns the angle of the tangent to the drawing at time `s` and position `point`
				const headingAt = (s, point) => calcPenPoint(s + 0.0001).sub(point).getHeading();

				let headingLast = headingAt(sLast, pointLast);
				// Until we reach the end of the new line that needs to be drawn
				while (sLast < s) {
					// Reduce the timestep until the next point of the line forms a shallow enough angle
					let point, heading;
					// Limit the number of iterations we can do, in case there's a bug
					for (let i = 0; i <= 10; i++) {
						// Calculate the tangent angle at the endpoint of the new segment
						point = calcPenPoint(sLast + ds);
						heading = headingAt(sLast + ds, point);
						// Ensure that, when the angle does a full cycle, it doesn't jump from PI to -PI
						while (headingLast - heading > Math.PI) headingLast -= 2 * Math.PI;
						while (heading - headingLast > Math.PI) headingLast += 2 * Math.PI;
						// If the angle covered by the segment is sufficiently small, we're done
						if (Math.abs(headingLast - heading) <= maxAngle) break;
						// Otherwise, reduce the step size
						ds *= 0.5;
						if (i === 10) {
							console.warn("Maximum # of iterations reached for reducing angle between consecutive line segments");
							break;
						}
					}
					drawing.addPoint(point, sLast + ds);
					// Set up for the next line segment
					pointLast = point;
					headingLast = heading;
					sLast += ds;
				}
			}

			// Draw the new section of the path
			drawCtx.translate(sim.canvas.width / 2, sim.canvas.height / 2);
			drawCtx.scale(sim.mToPx(1), sim.mToPx(1));
			drawing.drawNewOnly(drawCtx);
			drawCtx.setTransform(1, 0, 0, 1, 0, 0);
		}

		// Only render the entire drawing if explicitly asked to
		if (reRenderDrawing) {
			// We need to re-render the drawing (e.g. the window has been resized)
			drawCtx.fillStyle = sim.colours.background;
			drawCtx.fillRect(0, 0, sim.canvas.width, sim.canvas.height);
			drawCtx.translate(sim.canvas.width / 2, sim.canvas.height / 2);
			drawCtx.scale(sim.mToPx(1), sim.mToPx(1));
			drawing.draw(drawCtx);
			drawCtx.setTransform(1, 0, 0, 1, 0, 0);
		}

		// Render the tools every frame (during drawing), or if explicitly asked to
		if (!sim.timer.isPaused || reRenderTools) {
			// Draw the tools
			toolCtx.clearRect(0, 0, sim.canvas.width, sim.canvas.height);
			if (controls.showTools.getValue()) {
				toolCtx.translate(sim.canvas.width / 2, sim.canvas.height / 2);
				toolCtx.scale(sim.mToPx(1), sim.mToPx(1));
				toolCtx.lineWidth = 0.015;
				toolCtx.strokeStyle = "#00000077";
				toolCtx.fillStyle = "#88888877";

				// The wheels
				guide.draw(toolCtx, {asring: controls.inside.getValue(), fill: !controls.inside.getValue()});
				if (wheelIncompat) {
					toolCtx.strokeStyle = "#dd333377";
					toolCtx.fillStyle = "#dd333360";
				}
				wheel.drawAsWheel(toolCtx, guide, controls.inside.getValue(), s);

				// The pen
				toolCtx.beginPath();
				toolCtx.arc(penPosition.x, penPosition.y, 0.25 * Math.sqrt(drawing.currentLine.width), 0, 2 * Math.PI);
				toolCtx.fillStyle = drawing.currentLine.colour;
				toolCtx.strokStyle = sim.colours.foreground;
				toolCtx.fill();
				toolCtx.stroke();

				toolCtx.setTransform(1, 0, 0, 1, 0, 0);
			}
		}

		// If we did any drawing, rerender the main canvas
		if (!sim.timer.isPaused || reRenderDrawing || reRenderTools) {
			reRenderDrawing = false;
			reRenderTools = false;
			// Display the path and the tools on the canvas
			ctx.clearRect(0, 0, sim.canvas.width, sim.canvas.height);
			sim.renderOffscreenCanvases();
		}

	};

	// aaand begin
	controls.thickness0.DOM.click();
	controls.colour1.DOM.click();
	window.addEventListener("resize", () => reRenderDrawing = reRenderTools = true);
	sim.start();
	sim.timer.pause();

	if (!window.localStorage.getItem("doneTutorial")) {
		const tutorial = new Tutorial()
			.createStep(controls.startstop.DOM, "Click the button to start drawing.", ["change"])
			.createStep(controls.speed.DOM, "Adjust the speed so that the pattern is drawn more quickly. Use your mouse to drag the knob upwards to do this.", ["change"])
			.createStep(controls.startstop.DOM, "Once the pattern completes, click stop.", ["change"])
			.createStep(controls.inside.DOM, "Move the drawing wheel outside of the ring by unchecking this box.", ["change"])
			.createStep(controls.ratioWheel.DOM, "Make the drawing wheel smaller by adjusting the ratio of the sizes of the wheels. Only the drawing wheel is affected, the size of the ring is unchanged.", ["change"])
			.createStep(controls.holeNumber.DOM, "Move the pen to a different hole to create a different variation of the pattern.", ["change"])
			.createStep(controls.guideSize.DOM, "Change the overall size of the drawing tools.", ["change"])
			.createStep(controls.thickness1.DOM, "Use a thicker pen.", ["change"])
			.createStep(controls.colour3.DOM, "Change the colour of the pen.", ["change"])
			.createStep(controls.startstop.DOM, "Begin drawing again.", ["change"])
			.createStep(controls.save.DOM, "When you're happy with the drawing you can click this button to view the image.", ["change"])
			.nextStep();
		const interval = setInterval(function() {
			if (!tutorial.finished) return;
			window.localStorage.setItem("doneTutorial", "true");
			window.clearInterval(interval);
		}, 1000)
	}

});
