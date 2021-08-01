const ejs = require("ejs");
const fs = require("fs");

const simulations = JSON.parse(fs.readFileSync("simulations.json", "utf8"));
const commithash = process.env.GIT_SHA || "unknown";
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

renderAndSave("home.ejs", { title: "Home", simulations, commithash }, "index.html");
renderAndSave("about.ejs", { title: "About", commithash }, "about/index.html");
renderAndSave("lmc.ejs", { title: "Little Man Computer", commithash }, "lmc/index.html");

for (const sim of simulations) {
	fs.mkdirSync(`${output_dir}/simulations/${sim.id}`, { recursive: true });
	renderAndSave(`simulations/${sim.id}.ejs`, {
		title: `Simulation - ${sim.title}`,
		description: sim.description,
		id: sim.id,
		commithash
	}, `simulations/${sim.id}/index.html`);
}
