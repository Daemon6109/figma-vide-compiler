import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { compileFigmaToVide, type CompileOptions, type FigmaDocument } from "../index";

const usage = `Usage:
  bun src/bin/compile.ts <figma-export.json> <out-dir> [ComponentName] [--runtime] [--preserve-root]

Examples:
  bun src/bin/compile.ts figma-vide-export.json out InventoryScreen
  bun src/bin/compile.ts figma-vide-export.json out InventoryScreen --runtime
`;

const [, , inputPath, outDir, maybeComponentName, ...flags] = Bun.argv;

if (!inputPath || !outDir) {
	console.error(usage);
	process.exit(1);
}

const componentName = maybeComponentName?.startsWith("--") ? undefined : maybeComponentName;
const allFlags = new Set([...(maybeComponentName?.startsWith("--") ? [maybeComponentName] : []), ...flags]);

const raw = await readFile(inputPath, "utf8");
const document = JSON.parse(raw) as FigmaDocument;
const options: CompileOptions = {
	componentName,
	includeRuntime: allFlags.has("--runtime"),
	preserveRootPosition: allFlags.has("--preserve-root"),
};
const result = compileFigmaToVide(document, options);

await mkdir(outDir, { recursive: true });
for (const file of result.files) {
	const path = join(outDir, file.path);
	await writeFile(path, file.contents, "utf8");
	console.log(`wrote ${path}`);
}

for (const warning of result.warnings) console.warn(`warning: ${warning}`);
