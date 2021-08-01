// Server for testing github pages 'docs' directory
const express = require("express");
const app = express();
app.use(express.static(__dirname + "/docs"));
app.listen(process.env.PORT || 8001);
