# Figma → Vide Compiler

Goal: let a UI designer work in Figma while Anime Renaissance consumes deterministic `@rbxts/vide` view components.

## Pipeline

```txt
Figma plugin export
  → JSON artifact committed/generated into repo
  → compiler
  → generated `.tsx` view components + `.animations.ts` manifest
  → hand-written state/network/controller wiring
```

## Design rules for pixel-perfect output

- Use a fixed target frame, usually `1920×1080`.
- Compiler emits `UDim2.fromOffset(x, y)` / `UDim2.fromOffset(width, height)` from `absoluteBoundingBox` for exact placement.
- Auto-layout frames also emit `UIListLayout` and `UIPadding`; exact absolute bounds are still preserved.
- Figma layer names become Roblox `Name` values and can later drive prop/bind conventions.

## Supported now

- Frames/groups/components as `frame`
- Text as `textlabel`
- Image fills as `imagelabel` / `imagebutton`
- Solid fills → `BackgroundColor3`, `TextColor3`
- Image refs → `Image`
- Rounded corners → `UICorner`
- Strokes → `UIStroke`
- Linear/radial/etc gradient stops → `UIGradient` color sequence
- Auto-layout → `UIListLayout` + `UIPadding`
- Prototype reactions → generated animation manifest with trigger/action/destination/easing/duration

## Animation strategy

Figma prototype animations do not map 1:1 to Roblox GUI. The compiler should not guess gameplay behavior. Instead it exports a typed manifest:

```ts
figmaAnimationManifest = [
  {
    nodeId: "1:3",
    trigger: "ON_CLICK",
    action: "NAVIGATE",
    destinationId: "summon-modal",
    duration: 0.35,
    easingStyle: "Enum.EasingStyle.Quad",
    easingDirection: "Enum.EasingDirection.Out",
  },
]
```

A runtime adapter can wire that into Forge/Vide/TweenService.

## What the plugin needs to export

The Figma plugin should serialize selected page/frame nodes with:

- `id`, `name`, `type`, `visible`, `opacity`
- `absoluteBoundingBox`
- `children`
- `fills`, `strokes`, `strokeWeight`, `cornerRadius`, `rectangleCornerRadii`
- `effects`
- text `characters` and `style`
- auto-layout fields: `layoutMode`, padding, spacing, alignments
- `reactions` from prototype interactions
- `exportSettings` and image fill refs

The repo-side compiler can then stay deterministic and testable.

## Compatibility roadmap

The realistic path to near-full compatibility is staged:

1. **Geometry parity** — absolute bounds normalized into parent-relative Roblox `Position`/`Size`. Implemented.
2. **Visual parity** — fills, strokes, corners, gradients, opacity, clipping. Partially implemented.
3. **Prototype animation parity** — Figma reactions become generated manifest entries. Implemented for export; runtime helper started.
4. **Runtime behavior parity** — map common triggers to Roblox events:
   - `ON_CLICK` → `GuiButton.Activated`
   - hover enter/leave → `MouseEnter` / `MouseLeave`
   - after delay → `task.delay`
   - open overlay → controller callback by `destinationId`
5. **Asset parity** — export image fills and produce an asset map to Roblox asset ids.
6. **Component/state parity** — layer annotations like `#bind=coins`, `#on=onStart`, `#repeat=units` generate typed prop holes.
7. **Advanced effects** — shadows/blur need Roblox-specific approximations because Roblox GUI has no perfect native Figma blur/drop-shadow equivalent.

Use `--runtime` when compiling to generate `figma-animation-runtime.ts` next to the screen component.
