# Figma plugin setup

This repo now includes a local development Figma plugin that exports selected Figma frames/components into the JSON format consumed by the Vide compiler.

## Install the plugin in Figma

1. Open Figma desktop/web.
2. Go to `Plugins` → `Development` → `Import plugin from manifest...`.
3. Select this file from the cloned repo:

```txt
plugin/manifest.json
```

4. Select any frame/component/group in your Figma file.
5. Run `Plugins` → `Development` → `Figma to Vide Exporter`.
6. Click `Download JSON` or `Copy JSON`.

## Compile the exported JSON

From this repo:

```bash
bun install
bun run compile ./figma-vide-export.json ./out InventoryScreen --runtime
```

This writes:

```txt
out/InventoryScreen.tsx
out/InventoryScreen.animations.ts
```

## Notes

- The plugin does not use network access.
- The compiler intentionally uses absolute pixel bounds for first-pass pixel-perfect Roblox output.
- Image fills currently export Figma image hashes as refs. The next step is adding binary asset export/upload mapping so `Image` can become real `rbxassetid://...` values automatically.
- Figma prototype reactions export into an animation manifest. A Roblox runtime adapter should map those to TweenService/Forge/Vide behavior.

## Image fills with Asphalt

If your Figma design has image fills, the plugin now embeds those image bytes into the exported JSON. Compile with `--asphalt`:

```bash
bun run compile ./figma-vide-export.json ./out InventoryScreen --runtime --asphalt
```

This writes:

```txt
out/assets/figma/<figma-image-hash>.png
out/asphalt.toml
out/figma-assets.ts
```

Before uploading, edit `out/asphalt.toml`:

```toml
[creator]
type = "group" # or "user"
id = 0        # your Roblox group/user id
```

Then from `out/` run:

```bash
asphalt sync
```

Asphalt generates the final `assets` module with real Roblox asset ids. The generated Vide component imports `figmaAsset(...)`, which maps Figma image hashes to those Asphalt paths.
