const fs = require("fs");
const simulations = JSON.parse(fs.readFileSync("simulations.json", "utf8"));

const express = require("express");
const app = express();

app.set("view engine", "ejs");
app.set("view options", { root: __dirname + "/views" });

app.use(express.static(__dirname + "/static"));

app.get("/", (req, res) => {
	res.render("home", { title: "Home", simulations, static: false });
});

app.get("/simulations", (req, res) => {
	res.redirect("/");
});

app.get("/lmc", (req, res) => {
	res.render("lmc", { title: "Little Man Computer", static: false });
});

app.get("/about", (req, res) => {
	res.render("about", { title: "About", static: false });
});

for (const sim of simulations) {
	app.get(`/simulations/${sim.id}`, (req, res) => {
		res.render(`simulations/${sim.id}`, {
			title: `Simulation - ${sim.title}`,
			description: sim.description,
			id: sim.id,
			static: false
		});
	});
}

app.use((req, res) => {
	res.status(404).render("404", { title: "404 - Not Found", path: req.path, static: false });
});

app.listen(process.env.PORT || 8001);

