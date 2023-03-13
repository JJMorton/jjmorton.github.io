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
		const container = document.getElementById("photos");
		const thumbs = data.files.filter(x => x.includes("/thumb_"));
		const fulls = data.files.filter(x => !x.includes("/thumb_"));
		const correspondThumb = fulls.map(file => {
			const split = file.split('/');
			split[split.length - 1] = "thumb_" + split[split.length - 1];
			const thumbName = split.join('/');
			return thumbs.includes(thumbName) ? thumbName : null;
		});
		const withoutThumbCount = correspondThumb.filter(x => !x).length;
		if (withoutThumbCount > 0) {
			console.warn(`${withoutThumbCount} image(s) not displayed because of missing thumbnails!`);
		}
		const template = document.getElementById("tmpl-big-photo");
		for (let i = 0; i < fulls.length; i++) {
			// Only show images with thumbnails
			if (!correspondThumb[i]) continue;
			const elt = template.content.cloneNode(true);
			elt.querySelector("a").href = fulls[i];
			elt.querySelector("img").src = correspondThumb[i];
			container.appendChild(elt);
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
