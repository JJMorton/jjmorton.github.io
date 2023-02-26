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
	res.redirect("/");
});

app.get("/southwest", (req, res) => {
	res.render("southwest", { title: "South West Photos" });
});

app.get("/lmc", (req, res) => {
	res.render("lmc", { title: "Little Man Computer" });
});

app.get("/spirograph", (req, res) => {
	res.render("spirograph", { title: "Spirograph" });
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


/*
 * Set up AWS S3 bucket access
 */
const { S3Client, ListObjectsV2Command, GetObjectCommand } = require("@aws-sdk/client-s3");
const S3Region = "eu-west-2";
const s3Client = new S3Client({
	region: S3Region,
	accessKeyId: process.env.AWS_ACCESS_KEY_ID || undefined,
	secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || undefined
});

const bucketRoute = express.Router();
app.use("/content", bucketRoute);

bucketRoute.get("*", (req, res) => {
	const path = req.path;

	if (path.endsWith('/')) {
		// If requested a 'folder' (indicated by a trailing slash), send a list of the contained objects
		const prefix = path.startsWith('/') ? path.substring(1) : path;
		const continueToken = req.query["continue"] || null;
		const command = new ListObjectsV2Command({
			Bucket: process.env.AWS_BUCKET_NAME,
			Prefix: prefix,
			// MaxKeys: 10,
			ContinuationToken: continueToken,
			StartAfter: prefix // Exclude the 'folder' itself
		})
		s3Client.send(command)
		.then(data => {
			const files = data.Contents.filter(x => x.Size > 0).map(x => "/content/" + x.Key);
			const nextContinueToken = data.NextContinuationToken || null;
			res.send({ files, continue: nextContinueToken });
		})
		.catch(err => {
			console.error(err);
			res.status(500).send("Failed to get list")
		})

	// Otherwise, return the requested object
	} else {
		console.log("Get bucket object", path);
		const command = new GetObjectCommand({
			Bucket: process.env.AWS_BUCKET_NAME,
			Key: path.substring(1)
		});
		s3Client.send(command)
		.then(data => {
			data.Body.pipe(res);
		})
		.catch(err => {
			console.error(err);
			res.status(err.Code === "NoSuchKey" ? 404 : 500).send(err.Code);
		});
	}
});

app.use((req, res) => {
	res.status(404).render("404", { title: "404: Not Found", path: req.path });
});

console.log(`Using port ${process.env.PORT || 8001}`);
app.listen(process.env.PORT || 8001);


