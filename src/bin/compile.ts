import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { compileFigmaToVide, type CompileOptions, type FigmaDocument } from "../index";

const usage = `Usage:
  bun src/bin/compile.ts <figma-export.json> <out-dir> [ComponentName] [--runtime] [--preserve-root] [--asphalt] [--use-px]

Examples:
  bun src/bin/compile.ts figma-vide-export.json out InventoryScreen
  bun src/bin/compile.ts figma-vide-export.json out InventoryScreen --runtime --asphalt --use-px
`;

const [, , inputPath, outDir, maybeComponentName, ...flags] = Bun.argv;

if (!inputPath || !outDir) {
	console.error(usage);
	process.exit(1);
}

const componentName = maybeComponentName?.startsWith("--") ? undefined : maybeComponentName;
const allFlags = new Set([...(maybeComponentName?.startsWith("--") ? [maybeComponentName] : []), ...flags]);
const useAsphalt = allFlags.has("--asphalt");

const raw = await readFile(inputPath, "utf8");
const document = JSON.parse(raw) as FigmaDocument;
const options: CompileOptions = {
	componentName,
	includeRuntime: allFlags.has("--runtime"),
	preserveRootPosition: allFlags.has("--preserve-root"),
	usePx: allFlags.has("--use-px"),
	assetImport: useAsphalt ? 'import { figmaAsset } from "./figma-assets";' : undefined,
	assetExpressionResolver: useAsphalt ? (imageRef: string) => `figmaAsset(${JSON.stringify(imageRef)})` : undefined,
};
const result = compileFigmaToVide(document, options);

await mkdir(outDir, { recursive: true });
for (const file of result.files) {
	const path = join(outDir, file.path);
	await writeFile(path, file.contents, "utf8");
	console.log(`wrote ${path}`);
}

if (useAsphalt) {
	const assetsDir = join(outDir, "assets", "figma");
	await mkdir(assetsDir, { recursive: true });
	const assetEntries = document.assets ?? {};
	for (const [hash, asset] of Object.entries(assetEntries)) {
		const fileName = asset.fileName || `${hash}.png`;
		const path = join(assetsDir, fileName);
		await writeFile(path, Buffer.from(asset.base64, "base64"));
		console.log(`wrote ${path}`);
	}

	await writeFile(
		join(outDir, "asphalt.toml"),
		`#:schema https://raw.githubusercontent.com/jackTabsCode/asphalt/refs/heads/main/schema.json\n\n# Set this to your Roblox user/group before running asphalt sync.\n[creator]\ntype = "group"\nid = 0\n\n[codegen]\ntypescript = true\nstyle = "flat"\n\n[inputs.assets]\npath = "assets/**/*"\noutput_path = "."\n`,
		"utf8",
	);
	await writeFile(
		join(outDir, "figma-assets.ts"),
		`// Auto-generated bridge from Figma image hashes to Asphalt generated asset paths.\n// After editing asphalt.toml, run: asphalt sync\nimport Assets from "./assets";\n\nconst figmaAssetPaths: Record<string, string> = ${JSON.stringify(
			Object.fromEntries(Object.entries(assetEntries).map(([hash, asset]) => [hash, `figma/${asset.fileName || `${hash}.png`}`])),
			null,
			"\t",
		)};\n\nexport const figmaAsset = (hash: string): string => {\n\tconst path = figmaAssetPaths[hash];\n\tif (path === undefined) return "rbxassetid://" + hash;\n\treturn (Assets as Record<string, string>)[path] ?? "rbxassetid://" + hash;\n};\n`,
		"utf8",
	);
	console.log(`wrote ${join(outDir, "asphalt.toml")}`);
	console.log(`wrote ${join(outDir, "figma-assets.ts")}`);
}

for (const warning of result.warnings) console.warn(`warning: ${warning}`);
