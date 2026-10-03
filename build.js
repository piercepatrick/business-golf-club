const fs = require("fs");
const path = require("path");

const files = ["index.html", "styles.css", "logo.png", "favicon.png"];
const out = path.join(__dirname, "dist");

fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out);

for (const file of files) {
  fs.copyFileSync(path.join(__dirname, file), path.join(out, file));
}
