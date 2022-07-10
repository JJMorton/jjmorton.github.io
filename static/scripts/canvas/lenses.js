import {Simulation} from './main.js';

window.addEventListener("load", function() {
	
	'use strict';

	const sim = new Simulation();

	sim.scale = 1.5;

	const params = {
		focal_length: 0.25,
		ref_index: 1.5,
		object_pos: 0.4,
		object_height: 0.1
	};
	
	const getObjectGeometry = function(centre) {
		return {
			x1: sim.mToPx(-params.object_pos) + centre,
			y1: centre,
			x2: sim.mToPx(-params.object_pos) + centre,
			y2: sim.mToPx(-params.object_height) + centre
		};
	}

	const getImageGeometry = function(centre) {
		const image_pos = 1 / (1/params.focal_length - 1/params.object_pos);
		const image_size = image_pos / params.object_pos * params.object_height;
		return {
			x1: sim.mToPx(image_pos) + centre,
			y1: centre,
			x2: sim.mToPx(image_pos) + centre,
			y2: sim.mToPx(image_size) + centre
		};
	}

	const getLensGeometry = function(height, focal_length) {
		let radius = sim.mToPx((params.ref_index - 1) * 2 * focal_length);
		let theta = Math.atan(height / radius); // Angle from centre to top
		let width = radius * (1 - Math.cos(theta)); // From centre to edge

		let scale = height / (radius * Math.sin(theta));

		return { radius: radius * scale, width: width * scale, theta };
	}

	const getGradient = function(x1, y1, x2, y2) {
		return (y2 - y1) / (x2 - x1);
	}

	const drawLine = function(c, x1, y1, x2, y2) {
		c.beginPath();
		c.moveTo(x1, y1); c.lineTo(x2, y2);
		c.closePath();
		return c;
	};

	const drawArc = function(c, x, y, r, start, end) {
		c.beginPath();
		c.arc(x, y, r, start, end);
		c.closePath();
		return c;
	}

	const drawRect = function(c, x, y, w, h) {
		c.beginPath();
		c.rect(x, y, w, h);
		c.closePath();
		return c;
	}

	sim.render = function(c) {

		c.clearRect(0, 0, sim.canvas.width, sim.canvas.height);

		const CENTRE = sim.percToPx(50);
	
		// Draw equilibrium line
		drawLine(c, 0, CENTRE, sim.percToPx(100), CENTRE).stroke();

		if (params.focal_length !== 0) {

			// Draw lens
			const height = sim.mToPx(0.2);
			const { radius, width, theta } =
				getLensGeometry(height, Math.abs(params.focal_length));

			const convex = params.focal_length > 0;
			const originR = CENTRE - radius + (convex ? width : -width);
			const originL = CENTRE + radius + (convex ? -width : width);
			
			c.beginPath();
			c.arc(originL, CENTRE, radius, Math.PI - theta, Math.PI + theta);
			c.arc(originR, CENTRE, radius, -theta, theta);
			c.closePath();
			c.stroke();

			drawLine(c, CENTRE, CENTRE - height, CENTRE, CENTRE + height).stroke();

			// Draw object and image
			const objGeo = getObjectGeometry(CENTRE);
			const imgGeo = getImageGeometry(CENTRE);
			drawRect(c, objGeo.x1 - 2, objGeo.y1, 4, objGeo.y2 - objGeo.y1).fill();
			drawRect(c, imgGeo.x1 - 2, imgGeo.y1, 4, imgGeo.y2 - imgGeo.y1).fill();


			// Draw ray lines

			// First find the gradients of the two lines
			const focalGrad = getGradient(CENTRE, objGeo.y2, CENTRE + sim.mToPx(params.focal_length), CENTRE);
			const centreGrad = getGradient(objGeo.x2, objGeo.y2, CENTRE, CENTRE);
			// Find where the lines end on the right edge of the screen
			const focalLineEnd = objGeo.y2 + CENTRE * focalGrad;
			const centreLineEnd = objGeo.y2 + (2 * CENTRE - objGeo.x2) * centreGrad;
			// Now draw the three lines
			drawLine(c, objGeo.x2, objGeo.y2, CENTRE, objGeo.y2).stroke();
			drawLine(c, CENTRE, objGeo.y2, sim.percToPx(100), focalLineEnd).stroke();
			drawLine(c, objGeo.x2, objGeo.y2, 2 * CENTRE, centreLineEnd).stroke();

			if (objGeo.y2 > CENTRE && imgGeo.y2 > CENTRE ||
			    objGeo.y2 < CENTRE && imgGeo.y2 < CENTRE)
			{
				// This is a virtual image, so extra lines need to be drawn
				// Find where the lines start of the left edge of the screen
				const focalLineStart = objGeo.y2 - CENTRE * focalGrad;
				const centreLineStart = objGeo.y2 - objGeo.x2 * centreGrad;

				// Draw the two lines, dotted
				sim.ctx.setLineDash([5, 10]);
				drawLine(c, 0, focalLineStart, CENTRE, objGeo.y2).stroke();
				drawLine(c, 0, centreLineStart, objGeo.x2, objGeo.y2).stroke();
				sim.ctx.setLineDash([]);
			}
		}

		// Draw focal points
		drawArc(c, CENTRE + sim.mToPx(params.focal_length), CENTRE, 3, 0, 2 * Math.PI).fill();
		drawArc(c, CENTRE - sim.mToPx(params.focal_length), CENTRE, 3, 0, 2 * Math.PI).fill();
	};

	sim.addKnob("focallength", "Focal length", "m", params.focal_length, -0.75, 0.75, 0.05, value => params.focal_length = value);
	sim.addKnob("distance", "Object Distance", "m", params.object_pos, 0, 2, 0.005, value => params.object_pos = value);
	sim.addKnob("size", "Object Size", "m", params.object_height, 0.05, 0.3, 0.001, value => params.object_height = value);
	sim.addKnob("scale", "Viewing Scale", "m", sim.scale, 0.05, 5, 0.01, value => sim.scale = value);

	sim.start();

});

