const fs = require("fs");
const simulations = JSON.parse(fs.readFileSync("simulations.json", "utf8"));

const express = require("express");
const app = express();

const commithash = require('child_process')
  .execSync('git rev-parse HEAD')
  .toString().trim();

app.set("view engine", "ejs");

app.use(express.static(__dirname + "/public"));

app.get("/", (req, res) => {
	res.render("home", { title: "Home", simulations, commithash });
});

app.get("/about", (req, res) => {
	res.render("about", { title: "About", commithash });
});

app.get("/simulations", (req, res) => {
	res.redirect("/");
});

for (const sim of simulations) {
	app.get(`/simulations/${sim.id}`, (req, res) => {
		res.render("simulation", {
			title: `Simulation - ${sim.title}`,
			description: sim.description,
			id: sim.id,
			commithash
		});
	});
}

app.use((req, res) => {
	res.render("404", { title: "404 - Not Found", path: req.path, commithash });
});

app.listen(process.env.PORT || 8001);

