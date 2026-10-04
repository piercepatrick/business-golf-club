const fs = require("fs");
const path = require("path");

const files = ["index.html", "apply.html", "apply.css", "apply.js", "terms.html", "privacy.html", "conduct.html", "styles.css", "logo.png", "favicon.png"];
const images = ["hero-1.jpg", "hero-2.jpg", "hero-3.jpg", "hero-4.jpg"];
const out = path.join(__dirname, "dist");

fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out);
fs.mkdirSync(path.join(out, "images"));

for (const file of files) {
  fs.copyFileSync(path.join(__dirname, file), path.join(out, file));
}

for (const file of images) {
  fs.copyFileSync(path.join(__dirname, "images", file), path.join(out, "images", file));
}
