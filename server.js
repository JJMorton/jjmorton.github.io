const fs = require("fs");
const simulations = JSON.parse(fs.readFileSync("simulations.json", "utf8"));

const express = require("express");
const app = express();

app.set("view engine", "ejs");
app.set("view options", { root: __dirname + "/views" });

app.use(express.static(__dirname + "/static"));

app.get("/", (req, res) => {
	res.render("home", { title: "Home", simulations });
});

app.get("/simulations", (req, res) => {
	res.render("simulations", { title: "Simulations", simulations });
});

app.get("/lmc", (req, res) => {
	res.render("lmc", { title: "Little Man Computer" });
});

app.get("/spirograph", (req, res) => {
	res.render("spirograph", { title: "Spirograph" });
});

app.get("/photos", (req, res) => {
	res.render("photos", { title: "Photos" });
});

app.get("/art", (req, res) => {
	res.render("art", { title: "Art With Code" });
});

app.get("/about", (req, res) => {
	res.render("about", { title: "About" });
});

for (const sim of simulations) {
	app.get(`/simulations/${sim.id}`, (req, res) => {
		res.render(`simulations/${sim.id}`, {
			title: `${sim.title}`,
			description: sim.description,
			id: sim.id,
			static: false
		});
	});
}

app.use((req, res) => {
	res.status(404).render("404", { title: "404: Not Found", path: req.path });
});

console.log(`Using port ${process.env.PORT || 8001}`);
app.listen(process.env.PORT || 8001);


