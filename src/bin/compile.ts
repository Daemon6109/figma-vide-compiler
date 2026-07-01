import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { compileFigmaToVide, type FigmaDocument } from "../index";

const usage = `Usage:
  bun src/bin/compile.ts <figma-export.json> <out-dir> [ComponentName]

Example:
  bun src/bin/compile.ts figma-vide-export.json out InventoryScreen
`;

const [, , inputPath, outDir, componentName] = Bun.argv;

if (!inputPath || !outDir) {
	console.error(usage);
	process.exit(1);
}

const raw = await readFile(inputPath, "utf8");
const document = JSON.parse(raw) as FigmaDocument;
const result = compileFigmaToVide(document, { componentName });

await mkdir(outDir, { recursive: true });
for (const file of result.files) {
	const path = join(outDir, file.path);
	await writeFile(path, file.contents, "utf8");
	console.log(`wrote ${path}`);
}

for (const warning of result.warnings) console.warn(`warning: ${warning}`);
