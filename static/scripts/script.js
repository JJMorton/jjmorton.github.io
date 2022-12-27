window.addEventListener("load", function() {

	'use strict';

	document.getElementById("sidebar-toggle")
		.addEventListener("click", function() {
			document.getElementById("structure-sidebar")
				.classList.toggle("open");
		});

});