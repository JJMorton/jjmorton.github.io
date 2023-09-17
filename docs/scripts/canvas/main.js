/**
 * Timer with play and pause functionality
 */
class Timer {
    // Wrapper to disallow setting pause state externally
    get isPaused() { return this.paused; }
    getTimescale() { return this.scale; }
    setTimescale(newScale) {
        const t = this.getTime();
        this.scale = newScale;
        this.setTime(t);
    }
    start() {
        if (!this.isPaused)
            return;
        this.offset += (performance.now() - this.timePaused) * this.scale;
        this.timePaused = -1;
        this.paused = false;
    }
    ;
    pause() {
        if (this.isPaused)
            return;
        this.timePaused = performance.now();
        this.paused = true;
        this.userPaused = true;
    }
    getTime() {
        if (this.isPaused) {
            return (this.scale * this.timePaused - this.offset) / 1000;
        }
        else {
            return (this.scale * performance.now() - this.offset) / 1000;
        }
    }
    setTime(newTime) {
        // Adjust offset such that it is now `newTime`
        const time = this.getTime();
        this.offset += (time - newTime) * 1000;
    }
    reset() {
        this.setTime(0);
    }
    constructor() {
        /** Time at which the timer was paused, -1 -> not paused */
        this.timePaused = 0;
        /** amounts to the amount of time spent paused */
        this.offset = 0;
        /** Speed of the timer, 1 corresponds to actual time */
        this.scale = 1;
        /** Whether the user explicitly paused the timer */
        this.userPaused = true;
        /** Whether the timer is currently paused */
        this.paused = true;
        document.addEventListener("visibilitychange", () => {
            if (document.visibilityState === "visible") {
                if (!this.userPaused)
                    this.start();
            }
            else if (!this.isPaused) {
                this.pause();
                this.userPaused = false;
            }
        });
    }
}
export var MouseButton;
(function (MouseButton) {
    MouseButton[MouseButton["NONE"] = -1] = "NONE";
    MouseButton[MouseButton["LEFT"] = 0] = "LEFT";
    MouseButton[MouseButton["MIDDLE"] = 1] = "MIDDLE";
    MouseButton[MouseButton["RIGHT"] = 2] = "RIGHT";
})(MouseButton || (MouseButton = {}));
/**
 * Tracks mouse position relative to a DOM element
 */
export class Mouse {
    /**
     * @param elt The DOM element to track the mouse relative to
     * @params onclick A callback function, provided with the mouse button pressed
     */
    constructor(elt, onclick) {
        this.pressed = MouseButton.NONE;
        this.x = 0;
        this.y = 0;
        // These two functions are called from the event listeners when needed
        const mousemove = ({ pageX, pageY }) => {
            let offsetTop = elt.offsetTop;
            let offsetLeft = elt.offsetLeft;
            let parent = elt.offsetParent;
            while (parent) {
                offsetTop += parent.offsetTop;
                offsetLeft += parent.offsetLeft;
                parent = parent.offsetParent;
            }
            this.x = (pageX - offsetLeft) * window.devicePixelRatio;
            this.y = (pageY - offsetTop) * window.devicePixelRatio;
        };
        const mousepress = (button) => {
            if (Object.values(MouseButton).includes(button)) {
                this.pressed = button;
                onclick(button);
            }
            else {
                // Ignore buttons that we don't care abouut
                this.pressed = MouseButton.NONE;
            }
        };
        // Listeners for touchscreen
        elt.addEventListener("touchstart", e => {
            mousemove(e.changedTouches[0]);
            mousepress(MouseButton.LEFT);
            e.preventDefault();
        });
        window.addEventListener("touchend", () => mousepress(MouseButton.NONE));
        window.addEventListener("touchmove", e => mousemove(e.changedTouches[0]));
        // Listeners for mouse
        elt.addEventListener("mousedown", e => {
            mousepress(e.button);
            e.preventDefault();
        });
        window.addEventListener("mouseup", () => mousepress(MouseButton.NONE));
        window.addEventListener("mousemove", e => mousemove(e));
    }
}
/**
 * A class containing logic for a 'simulation'.
 * Manages a HTML canvas, a mouse handler, a timer, etc.
 */
class Simulation {
    constructor() {
        /** The number of metres that the canvas should cover */
        this.scale = 5;
        /** The colours from the webpage's CSS */
        this.colours = {
            background: "#000", foreground: "#000", accent: "#000"
        };
        /** USER: Set this to the function to be called each frame */
        this.render = null;
        this.offscreenCanvases = [];
        // Get the canvas element and drawing context
        const canvas = document.querySelector("canvas");
        if (!canvas)
            throw Error("Cannot find HTMLCanvasElement");
        this.canvas = canvas;
        const ctx = this.createContext();
        if (!ctx)
            throw Error("Could not create canvas rendering context");
        this.ctx = ctx;
        // Get colours defined on root element in css, and redo this when needed
        const recolour = () => {
            const style = window.getComputedStyle(document.documentElement);
            this.colours = {
                background: style.getPropertyValue("--background-color"),
                foreground: style.getPropertyValue("--text-color"),
                accent: style.getPropertyValue("--accent-color")
            };
        };
        recolour();
        window.addEventListener("recolour", () => recolour());
        this.scale = 5;
        // Track the user's mouse
        this.mouse = new Mouse(this.canvas, button => {
            if (button === MouseButton.NONE) {
                if (this.onmouseup)
                    this.onmouseup();
            }
            else if (button === MouseButton.LEFT) {
                if (this.onmousedown)
                    this.onmousedown();
            }
        });
        // Track time and time between frames
        this.timer = new Timer();
        this.frame = 0;
        this.delta = 0;
        // Automatically resize the canvas with the window
        this.resize();
        window.addEventListener("resize", () => this.resize());
    }
    createOffscreenCanvas() {
        // Creates a separate canvas (with the 2d context) that is automatically drawn to the main canvas each frame
        // The offscreen canvases are drawn over the main canvas, in the order of their creation
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        if (!ctx)
            throw Error("Failed to create offscreen canvas rendering context");
        const obj = { canvas, ctx };
        this.offscreenCanvases.push(obj);
        this.resize();
        return obj;
    }
    resize() {
        // Make the canvas fill its parent element
        const scaling = window.devicePixelRatio || 1;
        const parent = this.canvas.parentElement;
        const width = (parent ? parent.clientWidth : window.innerWidth) * scaling;
        const height = (parent ? parent.clientHeight : window.innerHeight) * scaling;
        // Resize a canvas to the correct size, and set all the styles again (lost when resizing)
        const resizeCanvas = (canvas, ctx) => {
            canvas.width = width;
            canvas.height = height;
            if (ctx instanceof CanvasRenderingContext2D) {
                // When the window is resized, stroke and fill styles are lost so we need to set them again
                ctx.strokeStyle = this.colours.accent;
                ctx.fillStyle = this.colours.foreground;
                ctx.lineJoin = "round";
                ctx.font = "bold 0.8em sans-serif";
            }
        };
        // Set the correct sizes of the main and offscreen canvases
        resizeCanvas(this.canvas, this.ctx);
        for (const { canvas, ctx } of this.offscreenCanvases)
            resizeCanvas(canvas, ctx);
        // Set the correct CSS styling
        this.canvas.style.width = `${width / scaling}px`;
        this.canvas.style.height = `${height / scaling}px`;
    }
    /**
     * Begin the main animation loop
     */
    start() {
        let prevTime = 0;
        this.delta = 0;
        const render = () => {
            // We want all the units in seconds, to make other units more realistic
            const time = performance.now() / 1000;
            this.delta = time - prevTime;
            prevTime = time;
            /*
             * Calculations are not done if the framerate is less than
             * 10 per second. This is to counter the issue of the
             * mass 'jumping' if the script goes idle for any substantial
             * amount of time (e.g. if the user switches to another tab
             * and back).
             * If the rendering is running less than 10 times per
             * second, nothing will animate. But things would get weird
             * at very low framerates anyway.
             */
            if (this.render && 1 / this.delta >= 10) {
                this.render(this.ctx);
                this.frame++;
            }
            window.requestAnimationFrame(render);
        };
        // Start animation loop
        this.timer.start();
        window.requestAnimationFrame(render);
    }
    /**
     * Render a single frame, manually
     */
    oneshot() {
        if (this.render)
            this.render(this.ctx);
    }
    /*
     * Conversions between different length units.
     * m -- world units.
     * perc -- percentage of the canvas width.
     * px -- onscreen pixels.
     */
    mToPx(metres) {
        return this.canvas.height * metres / this.scale;
    }
    pxToM(px) {
        return px / this.canvas.height * this.scale;
    }
    percToPx(perc) {
        return this.canvas.height * perc / 100;
    }
    pxToPerc(px) {
        return px / this.canvas.height * 100;
    }
    percToM(perc) {
        return this.pxToM(this.percToPx(perc));
    }
    mToPerc(m) {
        return this.pxToPerc(this.mToPx(m));
    }
}
export class Simulation2D extends Simulation {
    createContext() {
        return this.canvas.getContext("2d");
    }
    renderOffscreenCanvases() {
        for (const { canvas } of this.offscreenCanvases) {
            this.ctx.drawImage(canvas, 0, 0);
        }
    }
    /**
     * Execute the callback, restoring the canvas state back afterwards.
     */
    withCanvasState(f) {
        this.ctx.save();
        f();
        this.ctx.restore();
    }
}
export class SimulationGL extends Simulation {
    createContext() {
        return this.canvas.getContext("webgl2");
    }
    renderOffscreenCanvases() {
        throw Error("Cannot render offscreen canvases on a WebGL context");
    }
    resize() {
        super.resize();
        // Set the WebGL viewport size when resizing
        this.ctx.viewport(0, 0, this.canvas.width, this.canvas.height);
    }
    createShaderProgram(vertFile, fragFile) {
        const gl = this.ctx;
        // Creates a shader program from vertex and fragment shader files
        return new Promise((resolve, reject) => {
            const fetchFile = (path) => new Promise((resolve, reject) => {
                const request = new XMLHttpRequest();
                request.addEventListener("load", () => {
                    if (request.status != 200)
                        return reject(`Failed to fetch "${path}", response status ${request.status}`);
                    resolve(request.responseText);
                });
                request.addEventListener("error", reject);
                request.addEventListener("abort", reject);
                request.open("GET", path);
                request.send();
            });
            const compileShader = (gl, src, type) => {
                const shader = gl.createShader(type);
                if (!shader)
                    throw Error("Failed to create shader");
                gl.shaderSource(shader, src);
                gl.compileShader(shader);
                if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
                    const shaderType = type === gl.VERTEX_SHADER ? "vertex" : "fragment";
                    console.error(`Could not compile ${shaderType} shader: ${gl.getShaderInfoLog(shader)}`);
                    return null;
                }
                return shader;
            };
            fetchFile(vertFile).then(vertSrc => {
                fetchFile(fragFile).then(fragSrc => {
                    // We have both the shaders as source code, compile them
                    const vertShader = compileShader(gl, vertSrc, gl.VERTEX_SHADER);
                    const fragShader = compileShader(gl, fragSrc, gl.FRAGMENT_SHADER);
                    if (!vertShader || !fragShader)
                        return reject("Failed to compile shaders, aborting");
                    // Shaders compiled correctly, create and link program
                    const program = gl.createProgram();
                    if (!program)
                        throw Error("Failed to create shader program");
                    gl.attachShader(program, vertShader);
                    gl.attachShader(program, fragShader);
                    gl.linkProgram(program);
                    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
                        return reject(`Failed to link shader program: ${gl.getProgramInfoLog(program)}`);
                    }
                    // done :)
                    resolve(program);
                }).catch(reject);
            }).catch(reject);
        });
    }
}
class Control {
    constructor(id, init, onupdate = (val) => { return; }) {
        this.disabled = false;
        const DOM = document.getElementById(id);
        if (!DOM)
            throw Error("Control does not exist");
        // @ts-ignore WARNING: No check to make sure that the DOM element is of the specified type
        this.DOM = DOM;
        this.value = init;
        this.onupdate = onupdate;
    }
    onUpdate(func) {
        this.onupdate = func;
    }
    getValue() {
        return this.value;
    }
    setValue(val) {
        this.value = val;
        this.onupdate(this.value);
        this.DOM.dispatchEvent(new Event("change"));
        return this;
    }
    isDisabled() {
        return this.disabled;
    }
    setDisabled(val) {
        this.disabled = val;
        this.DOM.classList[val ? "add" : "remove"]("disabled");
        return this;
    }
}
export class Button extends Control {
    constructor(id, label, onclick) {
        super(id, null, onclick);
        this.DOM.textContent = label;
        this.DOM.addEventListener("click", () => this.setValue(null));
    }
    setDisabled(val) {
        this.DOM.disabled = val;
        return super.setDisabled(val);
    }
    click() {
        this.DOM.click();
    }
}
export class Knob extends Control {
    constructor(id, label, units, init, min, max, step, onupdate) {
        super(id, 0, onupdate);
        // The unrounded value so that scrolling can change it at a reasonable rate
        // instead of by a step every scroll event
        this.scrollValue = 0;
        // We're just going to assume these elements are present here, not worth type checking
        this.DOM.querySelector(".name").textContent = label;
        this.DOM.querySelector(".units").textContent = units;
        this.wheel = this.DOM.querySelector(".wheel");
        this.marker = this.DOM.querySelector(".marker");
        this.output = this.DOM.querySelector("output");
        this.min = min;
        this.max = max;
        this.step = step;
        // Input event listener
        const listener = (e) => {
            let pageY = 0;
            if (e instanceof MouseEvent)
                pageY = e.pageY;
            else if (e.type === "touchstart")
                pageY = e.touches[0].pageY;
            else
                return;
            e.preventDefault();
            if (this.isDisabled())
                return;
            this.wheel.classList.add("changing");
            const startY = pageY;
            const startValue = this.getValue();
            const moveListener = (e) => {
                const pageY = e instanceof MouseEvent ? e.pageY : e.touches[0].pageY;
                let val = startValue + (this.max - this.min) * (startY - pageY) * 3 / window.screen.height;
                val = Math.min(this.max, Math.max(this.min, val));
                this.setValue(val);
            };
            const upListener = (e) => {
                if (e.type === "touchend" && e.touches.length !== 0)
                    return;
                window.removeEventListener("mousemove", moveListener);
                window.removeEventListener("touchmove", moveListener);
                window.removeEventListener("mouseup", upListener);
                window.removeEventListener("touchend", upListener);
                this.wheel.classList.remove("changing");
            };
            window.addEventListener("mousemove", moveListener);
            window.addEventListener("touchmove", moveListener);
            window.addEventListener("mouseup", upListener);
            window.addEventListener("touchend", upListener);
        };
        this.wheel.addEventListener("mousedown", listener);
        this.DOM.addEventListener("touchstart", listener);
        // Change the value by scrolling
        this.wheel.addEventListener("wheel", e => {
            e.preventDefault();
            if (this.isDisabled())
                return;
            const scale = (this.max - this.min) / 50;
            this.scrollValue = Math.min(this.max, Math.max(this.min, this.scrollValue + e.deltaY / 100 * scale));
            this.setValue(this.scrollValue);
        });
        // Reset on right click
        this.wheel.addEventListener("dblclick", e => {
            e.preventDefault();
            if (!this.isDisabled())
                this.setValue(init);
        });
        this.setValue(init);
    }
    setDisabled(val) {
        return super.setDisabled(val);
    }
    updateKnob() {
        const value = this.getValue();
        this.output.textContent = value.toString();
        this.wheel.style = `transform: rotate(${(value - this.min) / (this.max - this.min) * 2 * Math.PI}rad);`;
    }
    setValue(value) {
        value = parseFloat((this.step * Math.round(value / this.step)).toFixed(10));
        if (value === this.getValue())
            return this;
        super.setValue(value);
        this.scrollValue = this.getValue();
        this.updateKnob();
        return this;
    }
}
export class ComboBox extends Control {
    constructor(id, label, onupdate) {
        super(id, null, onupdate);
        // @ts-ignore Assume element exists
        this.DOM.querySelector("label").textContent = label;
        // @ts-ignore
        this.select = this.DOM.querySelector("select");
        this.options = [];
        this.select.addEventListener("input", () => {
            this.setValue(this.options[this.select.selectedIndex].value);
        });
    }
    setDisabled(val) {
        this.select.disabled = val;
        return super.setDisabled(val);
    }
    setValue(val) {
        this.select.selectedIndex = this.options.map(o => o.value).indexOf(val);
        return super.setValue(val);
    }
    addOption({ name, value }) {
        this.options.push({ name, value });
        const option = document.createElement("option");
        option.text = name;
        this.select.add(option);
        const val = this.getValue() || this.options[0].value;
        this.setValue(val);
        return this;
    }
    clearOptions() {
        this.options = [];
        while (this.select.length)
            this.select.remove(0);
    }
}
export class Checkbox extends Control {
    constructor(id, label, init, onupdate) {
        super(id, init, onupdate);
        // @ts-ignore
        this.DOM.querySelector("label").textContent = label;
        // @ts-ignore
        this.checkbox = this.DOM.querySelector("input");
        this.setValue(init);
        this.checkbox.addEventListener("input", () => {
            this.setValue(this.checkbox.checked);
        });
    }
    setDisabled(val) {
        this.checkbox.disabled = val;
        return super.setDisabled(val);
    }
    setValue(val) {
        this.checkbox.checked = val;
        return super.setValue(val);
    }
}
export class Meter extends Control {
    constructor(id, label, units, init, min, max) {
        super(id, init);
        this.DOM.querySelector(".name").textContent = label;
        this.DOM.querySelector(".units").textContent = units;
        this.meter = this.DOM.querySelector("progress");
        this.output = this.DOM.querySelector("output");
        this.meter.min = min;
        this.meter.max = max;
        this.setValue(init);
    }
    setDisabled(val) {
        console.warn("Disabling a meter has no effect");
        return super.setDisabled(val);
    }
    setValue(val) {
        this.meter.value = val;
        this.output.textContent = val.toString();
        return super.setValue(val);
    }
}
