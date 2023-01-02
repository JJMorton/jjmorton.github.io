const setColor = c => {
	document.documentElement.style = `--accent-color: ${c};`;
	window.localStorage.setItem("accentColor", c);
	window.dispatchEvent(new Event("recolour"));
};

window.addEventListener("load", function() {

	'use strict';

	/* Toggle the sidebar in mobile view with a button */
	document.getElementById("sidebar-toggle")
	.addEventListener("click", function() {
		document.getElementById("structure-sidebar")
		.classList.toggle("open");
	});

	/* Populate the compile date info */
	const elt = document.getElementById("compiledate");
	const req = new XMLHttpRequest();
	req.addEventListener("load", () => elt.textContent = req.responseText);
	req.open("GET", "/compiledate");
	req.send();

	/* Allow changing the accent colour */
	[...document.getElementsByClassName("color-sel")].forEach(elt => {
		const c = elt.getAttribute("color");
		elt.style.backgroundColor = c;
		elt.addEventListener("click", () => {
			setColor(c);
		});
	});
});

// Update the accent colour, even if the page is cached (e.g. user navigated back)
window.addEventListener("pageshow", function() {
	const col = window.localStorage.getItem("accentColor");
	if (col) setColor(col);
});

// Update the accent colour ASAP to prevent flash of different colour
const col = window.localStorage.getItem("accentColor");
if (col) setColor(col);
