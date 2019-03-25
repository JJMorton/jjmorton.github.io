const fs = require("fs");
const simulations = JSON.parse(fs.readFileSync("simulations.json", "utf8"));

const express = require("express");
const app = express();

app.set("view engine", "ejs");

app.use(express.static(__dirname + "/public"));

app.get("/", (req, res) => {
	res.render("home", { title: "Home", simulations });
});

app.get("/about", (req, res) => {
	res.render("about", { title: "About" });
});

app.get("/simulations", (req, res) => {
	res.redirect("/");
});

for (const sim of simulations) {
	app.get(`/simulations/${sim.id}`, (req, res) => {
		res.render("simulation", {
			title: `Simulation - ${sim.title}`,
			description: sim.description,
			script: `${sim.id}.js`
		});
	});
}

app.use((req, res) => {
	res.render("404", { title: "404 - Not Found", path: req.path });
});

app.listen(process.env.PORT || 8001);

