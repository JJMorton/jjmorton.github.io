const setColor = c => {
	document.documentElement.style = `--accent-color: ${c};`;
	window.localStorage.setItem("accentColor", c);
	window.dispatchEvent(new Event("recolour"));
};

window.addEventListener("DOMContentLoaded", function() {

	'use strict';

	/* Toggle the sidebar in mobile view with a button */
	const sidebar = document.getElementById("structure-sidebar");
	const sidebarBtn = document.getElementById("sidebar-toggle");
	sidebarBtn.addEventListener("click", function() {
			sidebar.classList.toggle("open");
			sidebarBtn.classList.toggle("open");
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

	/* Highlight the current page in the sidebar */
	const URLFromPath = p => new URL(p, window.location.origin).href;
	const currentURL = URLFromPath(window.location.pathname);
	const currentPageLink = Array.from(document.getElementById("structure-sidebar").children)
		.filter(elt => elt.classList.contains("pagelink"))
		.find(elt => URLFromPath(elt.querySelector("a").href) === currentURL)
	if (currentPageLink) {
		currentPageLink.classList.add("current");
	}
});

// Update the accent colour, even if the page is cached (e.g. user navigated back)
window.addEventListener("pageshow", function() {
	const col = window.localStorage.getItem("accentColor");
	if (col) setColor(col);
});

// Update the accent colour ASAP to prevent flash of different colour
const col = window.localStorage.getItem("accentColor");
if (col) setColor(col);
