import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { compileFigmaToVide, type FigmaDocument } from "../src";

const document = JSON.parse(readFileSync("examples/level-hud-wireframe.json", "utf8")) as FigmaDocument;
const result = compileFigmaToVide(document, {
	componentName: "LevelHudWireframe",
	includeRuntime: true,
});

mkdirSync("src-roblox/generated", { recursive: true });
for (const file of result.files) {
	writeFileSync(`src-roblox/generated/${file.path}`, file.contents);
	console.log(`wrote src-roblox/generated/${file.path}`);
}
