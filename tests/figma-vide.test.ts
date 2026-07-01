import { describe, expect, it } from "bun:test";
import { compileFigmaToVide, type FigmaDocument } from "../src";

const sample: FigmaDocument = {
	document: {
		id: "1:1",
		name: "Inventory Screen",
		type: "FRAME",
		absoluteBoundingBox: { x: 0, y: 0, width: 1920, height: 1080 },
		fills: [{ type: "SOLID", color: { r: 0.05, g: 0.06, b: 0.08, a: 0.92 } }],
		layoutMode: "VERTICAL",
		itemSpacing: 12,
		paddingTop: 24,
		paddingLeft: 24,
		paddingRight: 24,
		paddingBottom: 24,
		children: [
			{
				id: "1:2",
				name: "Title",
				type: "TEXT",
				characters: "Inventory",
				absoluteBoundingBox: { x: 42, y: 32, width: 260, height: 56 },
				fills: [{ type: "SOLID", color: { r: 1, g: 0.94, b: 0.7 } }],
				style: { fontFamily: "Gotham", fontSize: 36, textAlignHorizontal: "LEFT", textAlignVertical: "CENTER" },
			},
			{
				id: "1:3",
				name: "Summon Button",
				type: "FRAME",
				absoluteBoundingBox: { x: 42, y: 920, width: 280, height: 84 },
				fills: [
					{ type: "SOLID", color: { r: 0.95, g: 0.44, b: 0.14 } },
					{
						type: "GRADIENT_LINEAR",
						gradientStops: [
							{ position: 0, color: { r: 1, g: 0.65, b: 0.25 } },
							{ position: 1, color: { r: 0.9, g: 0.22, b: 0.08 } },
						],
					},
				],
				strokes: [{ type: "SOLID", color: { r: 1, g: 0.9, b: 0.55, a: 0.8 } }],
				strokeWeight: 2,
				cornerRadius: 14,
				reactions: [
					{
						trigger: { type: "ON_CLICK" },
						action: {
							type: "NAVIGATE",
							destinationId: "summon-modal",
							transition: { type: "SMART_ANIMATE", duration: 0.35, easing: { type: "EASE_OUT" } },
						},
					},
				],
				children: [
					{
						id: "1:4",
						name: "Button Label",
						type: "TEXT",
						characters: "Summon",
						absoluteBoundingBox: { x: 92, y: 942, width: 180, height: 38 },
						fills: [{ type: "SOLID", color: { r: 1, g: 1, b: 1 } }],
						style: { fontFamily: "Gotham", fontSize: 28, textAlignHorizontal: "CENTER", textAlignVertical: "CENTER" },
					},
				],
			},
		],
	},
};

describe("figma to vide compiler", () => {
	it("emits pixel-positioned Vide TSX and animation metadata", () => {
		const result = compileFigmaToVide(sample, { componentName: "InventoryScreen" });
		const tsx = result.files.find((file) => file.path === "InventoryScreen.tsx")?.contents ?? "";
		const animationManifest = result.files.find((file) => file.path === "InventoryScreen.animations.ts")?.contents ?? "";

		expect(tsx).toContain("export function InventoryScreen");
		expect(tsx).toContain("Position={UDim2.fromOffset(42, 920)}");
		expect(tsx).toContain("<uicorner CornerRadius={new UDim(0, 14)} />");
		expect(tsx).toContain("<uigradient");
		expect(tsx).toContain('Text="Summon"');
		expect(tsx).toContain("BackgroundTransparency={1}");
		expect(animationManifest).toContain("ON_CLICK");
		expect(animationManifest).toContain("Enum.EasingStyle.Quad");
	});
	it("normalizes root to 0,0 and emits child positions relative to parent", () => {
		const result = compileFigmaToVide({
			document: {
				id: "root",
				name: "Offset Root",
				type: "FRAME",
				absoluteBoundingBox: { x: 679, y: 301, width: 562, height: 478 },
				children: [
					{
						id: "child",
						name: "Child",
						type: "FRAME",
						absoluteBoundingBox: { x: 700, y: 330, width: 100, height: 50 },
					},
				],
			},
		}, { componentName: "OffsetRoot" });
		const tsx = result.files.find((file) => file.path === "OffsetRoot.tsx")?.contents ?? "";
		expect(tsx).toContain("Position={UDim2.fromOffset(0, 0)}");
		expect(tsx).toContain("Position={UDim2.fromOffset(21, 29)}");
	});

});
