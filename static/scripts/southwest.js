{
	const reqURL = new URL(window.location.origin + "/content/southwest/")
	// const continueQuery = new URL(window.location).searchParams.get("continue");
	// if (continueQuery) {
	// 	reqURL.searchParams.set("continue", continueQuery);
	// }
	const fetchPromise = fetch(reqURL, { method: "GET" })

	window.addEventListener("load", async function() {
		const res = await fetchPromise;
		const data = await res.json();
		console.log(data);
		const container = document.getElementById("photos");
		for (const url of data.files) {
			const anchor = document.createElement("a");
			anchor.href = url;
			const img = document.createElement("img");
			img.src = url;
			img.classList.add("big-photo");
			anchor.appendChild(img);
			container.appendChild(anchor);
		}

		// if (data.continue) {
		// 	// Create a new url with the continue search query set
		// 	const href = new URL(window.location);
		//     href.searchParams.set("continue", data.continue);
		//     // Create a link to this url
		// 	const anchor = document.createElement("a");
		//     anchor.href = href;
		//     anchor.textContent = "Next Page";
		//     container.appendChild(anchor);
		// }
	});
}
