window.addEventListener("load", function() {

    'use strict';
    
    const sim = new Simulation();

    const params = {
        maxcharges: 10,
        chargeradius: 0.05,
        stepcount: 1000,
        stepsize: 0.01
    };

    window.state = {
        charges: [],
        paths: [],
        drawpaths: false
    };

    const addCharge = function(x, y, strength=1) {
        const charge = {
            pos: { x, y },
            strength
        };
        state.charges.push(charge);
        if (state.charges.length > params.maxcharges) {
            state.charges.splice(0, 1);
        }
    };

    const addPaths = function(charge, count) {
        const particlecharge = -Math.sign(charge.strength);
        const dtheta = 2 * Math.PI / count;
        for (let theta = 0; theta < 2 * Math.PI; theta += dtheta) {
            let x = charge.pos.x + Math.sin(theta) * params.chargeradius;
            let y = charge.pos.y + Math.cos(theta) * params.chargeradius;
            const path = [{ x, y }];
            for (let i = 0; i < params.stepcount; i++) {
                const force = { x: 0, y: 0 };
                for (const q of state.charges) {
                    const dx = q.pos.x - x;
                    const dy = q.pos.y - y;
                    if (dx === 0 || dy === 0) continue;
                    const r2 = Math.pow(dx, 2) + Math.pow(dy, 2);
                    const forcemag = particlecharge * q.strength / r2;
                    force.x += forcemag * dx;
                    force.y += forcemag * dy;
                }
                const forcemag = Math.sqrt(Math.pow(force.x, 2) + Math.pow(force.y, 2));
                if (forcemag === 0) continue;
                const scalefactor = params.stepsize / forcemag;
                force.x *= scalefactor; force.y *= scalefactor;
                x += force.x; y += force.y;
                path.push({ x, y });
            }
            state.paths.push(path);
        }
        state.drawpaths = true;
    };

    sim.canvas.addEventListener("mousedown", function(e) {
        e.preventDefault();
        const x = sim.pxToM(sim.mouse.x);
        const y = sim.pxToM(sim.mouse.y);
        addCharge(x, y, e.buttons === 1 ? 1 : -1);
        state.paths = [];
        for (const charge of state.charges) {
            addPaths(charge, 50);
        }
    });

    sim.render = function() {
        if (!state.drawpaths) return;
        state.drawpaths = false;
        const c = sim.ctx;
        c.clearRect(0, 0, c.canvas.width, c.canvas.height);

        for (const path of state.paths) {
            c.beginPath();
            for (let i = 0; i < path.length; i++) {
                const x = sim.mToPx(path[i].x);
                const y = sim.mToPx(path[i].y);
                if (i === 0) c.moveTo(x, y);
                else c.lineTo(x, y);
            }
            c.stroke();
            c.closePath();
        }

        for (const charge of state.charges) {
            c.beginPath();
            c.arc(sim.mToPx(charge.pos.x), sim.mToPx(charge.pos.y), sim.mToPx(params.chargeradius), 0, 2 * Math.PI);
            c.closePath();
            c.fillStyle = charge.strength > 0 ? "#ff0000" : "#0000ff";
            c.fill();
        }

    };

    sim.start();

});
