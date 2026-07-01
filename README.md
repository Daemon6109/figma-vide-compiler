# figma-vide-compiler

Prototype compiler for turning Figma node JSON into Roblox `@rbxts/vide` TSX components.

Built for Anime Renaissance UI exploration.

## Current capabilities

- Figma frames/groups/components → Vide GUI tree
- Text → `textlabel`
- Image fills → `imagelabel` / `imagebutton`
- Pixel-perfect `UDim2.fromOffset(...)` bounds from `absoluteBoundingBox`
- Solid fills, transparency, rounded corners, strokes, gradients
- Auto-layout hints → `UIListLayout` / `UIPadding`
- Prototype reactions → generated `.animations.ts` manifest

## Use

```ts
import { compileFigmaToVide } from "./src";

const result = compileFigmaToVide(figmaDocument, {
	componentName: "InventoryScreen",
});

for (const file of result.files) {
	console.log(file.path, file.contents);
}
```

See `docs/FIGMA_VIDE_COMPILER.md` for the intended full pipeline.
