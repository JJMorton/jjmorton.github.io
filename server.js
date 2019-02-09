const express = require("express");
const app = express();

app.set("view engine", "ejs");

app.use(express.static(__dirname + "/public"));

app.get("/", (req, res) => {
	res.render("home", {
		title: "Home",
		simulations: [
			{ title: "Fluids", description: "Drop a ball in different fluids and change values to see the effects", href: "/simulations/fluids" },
			{ title: "Oscillations", description: "Simulate an oscillating spring with optional damping and a driving force", href: "/simulations/oscillations" },
			{ title: "Placeholder", description: "This is a placeholder", href: "" }
		]
	});
});

app.get("/about", (req, res) => res.render("about", { title: "About" }));

app.use((req, res) => {
	res.render("404", { title: "404 - Not Found", path: req.path });
});

app.listen(process.env.PORT || 8001);

