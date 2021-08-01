const ejs = require("ejs");
const fs = require("fs");

const simulations = JSON.parse(fs.readFileSync("simulations.json", "utf8"));
const views_dir = "views"
const static_dir = "static"
const output_dir = "docs"


function renderAndSave(template, data, output) {
	console.log(`Rendering '${template}' to '${output}'...`)
	const options = { root: "views" };
	ejs.renderFile(`views/${template}`, data, options).then(str => {
		fs.writeFile(`docs/${output}`, str, err => {
			if (err) throw err;
		});
	}).catch(console.error);
}


fs.mkdirSync(`${output_dir}/about`, { recursive: true });
fs.mkdirSync(`${output_dir}/lmc`, { recursive: true });

renderAndSave("home.ejs", { title: "Home", simulations, static: true }, "index.html");
renderAndSave("about.ejs", { title: "About", static: true }, "about/index.html");
renderAndSave("lmc.ejs", { title: "Little Man Computer", static: true }, "lmc/index.html");
renderAndSave("404.ejs", { title: "404 Not Found", static: true }, "404.html");

for (const sim of simulations) {
	fs.mkdirSync(`${output_dir}/simulations/${sim.id}`, { recursive: true });
	renderAndSave(`simulations/${sim.id}.ejs`, {
		title: `Simulation - ${sim.title}`,
		description: sim.description,
		id: sim.id,
		static: true
	}, `simulations/${sim.id}/index.html`);
}
