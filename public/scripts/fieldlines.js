window.addEventListener("load", function() {

    'use strict';
    
    const sim = new Simulation();

    const params = {
        maxcharges: 5,
        chargeradius: 0.05,
        particlecount: 50, // Number of particles tracing out from each charge
        stepcount: 1000, // How many times the particles are moved
        stepsize: 0.01, // How far they move each time
        stepbatchsize: 5 // How many steps per frame
    };

    const state = {
        charges: [],
        clearcanvas: false
    };

    // Every particle keeps all its previous positions in its 'path' property
    const createParticle = (x, y) => ({
        pos: { x, y },
        path: []
    });

    const createParticles = function(charge) {
        // Clear previous particles
        charge.particles = [];
        charge.pathlength = 0;

        // Particles are generated in a circle around the charge
        const dtheta = 2 * Math.PI / params.particlecount;
        for (let theta = 0; theta < 2 * Math.PI; theta += dtheta) {
            const particle = createParticle(
                charge.pos.x + Math.sin(theta) * params.chargeradius,
                charge.pos.y + Math.cos(theta) * params.chargeradius
            );
            charge.particles.push(particle);
        }
        
    };

    const addCharge = function(x, y, strength=1) {

        const charge = {
            pos: { x, y },
            strength,
            particles: [],
            pathlength: 0
        };

        state.charges.push(charge);
        
        // Impose limit on number of charges
        if (state.charges.length > params.maxcharges) {
            state.charges.splice(0, 1);
        }
    };

    const addToPaths = function(charge) {
        const particlecharge = -Math.sign(charge.strength);

        for (const particle of charge.particles) {
            const force = { x: 0, y: 0 };

            // Actually calculate the force on the particle due to the charges
            // F = q / r^2
            // Coefficients are irrelevant as only the direction of the force is needed
            for (const q of state.charges) {
                let dx = q.pos.x - particle.pos.x;
                const dy = q.pos.y - particle.pos.y;
                if (dx === 0 || dy === 0) dx = params.chargeradius;
                const r2 = Math.pow(dx, 2) + Math.pow(dy, 2);
                const forcemag = particlecharge * q.strength / r2;
                force.x += forcemag * dx;
                force.y += forcemag * dy;
            }
            const forcemag = Math.sqrt(Math.pow(force.x, 2) + Math.pow(force.y, 2));
            if (forcemag === 0) continue;
            const scalefactor = params.stepsize / forcemag;
            force.x *= scalefactor; force.y *= scalefactor;

            particle.path.push({ x: particle.pos.x, y: particle.pos.y });
            particle.pos.x += force.x; particle.pos.y += force.y;
        }

        charge.pathlength++;

    };

    sim.canvas.addEventListener("mousedown", function(e) {
        const x = sim.pxToM(sim.mouse.x);
        const y = sim.pxToM(sim.mouse.y);

        addCharge(x, y, e.buttons === 1 ? 1 : -1);

        // Recreate all the paths
        for (const charge of state.charges) {
            createParticles(charge);
        }
        state.clearcanvas = true;
    });

    sim.render = function() {
        const c = sim.ctx;
        if (state.clearcanvas) {
            state.clearcanvas = false;
            c.clearRect(0, 0, c.canvas.width, c.canvas.height);
        }

        for (let i = 0; i < params.stepbatchsize; i++) {
            for (const charge of state.charges) {
                if (charge.pathlength < params.stepcount) {
                    addToPaths(charge);
                    c.beginPath();
                    for (const particle of charge.particles) {
                        if (particle.path.length === 0) continue;
                        const p1 = particle.path[particle.path.length - 1];
                        const p2 = particle.pos;
                        c.moveTo(sim.mToPx(p1.x), sim.mToPx(p1.y));
                        c.lineTo(sim.mToPx(p2.x), sim.mToPx(p2.y));
                    }
                    c.stroke();
                    c.closePath();
                }
                c.beginPath();
                c.arc(sim.mToPx(charge.pos.x), sim.mToPx(charge.pos.y), sim.mToPx(params.chargeradius), 0, 2 * Math.PI);
                c.closePath();
                c.fillStyle = charge.strength > 0 ? "#ff0000" : "#0000ff";
                c.fill();
            }
        }

    };

    sim.start();

});
