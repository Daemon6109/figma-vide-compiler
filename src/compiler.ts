import type { CompileOptions, CompileResult, FigmaColor, FigmaDocument, FigmaNode, FigmaPaint, FigmaReaction } from "./types";

const DEFAULT_SCREEN = { width: 1920, height: 1080 };

const sanitizeIdentifier = (name: string): string => {
	const words = name
		.replace(/[#@].*$/g, "")
		.replace(/[^A-Za-z0-9]+/g, " ")
		.trim()
		.split(/\s+/g)
		.filter(Boolean);
	const base = words.map((word) => word.slice(0, 1).toUpperCase() + word.slice(1)).join("") || "GeneratedUi";
	return /^[0-9]/.test(base) ? `Ui${base}` : base;
};

const indent = (text: string, depth = 1): string =>
	text
		.split("\n")
		.map((line) => (line.length > 0 ? `${"\t".repeat(depth)}${line}` : line))
		.join("\n");

const numberLiteral = (value: number): string => {
	if (Math.abs(value) < 0.0001) return "0";
	const rounded = Math.round(value * 1000) / 1000;
	return Object.is(rounded, -0) ? "0" : `${rounded}`;
};

const color3 = (color: FigmaColor): string =>
	`Color3.fromRGB(${Math.round(color.r * 255)}, ${Math.round(color.g * 255)}, ${Math.round(color.b * 255)})`;

const transparency = (paint?: FigmaPaint, nodeOpacity = 1): string => {
	if (!paint) return "1";
	const alpha = paint.color?.a ?? paint.opacity ?? 1;
	return numberLiteral(1 - alpha * nodeOpacity);
};

const stringLiteral = (value: string): string => JSON.stringify(value);

const getVisiblePaint = (paints: FigmaPaint[] | undefined, type?: FigmaPaint["type"]): FigmaPaint | undefined =>
	paints?.find((paint) => paint.visible !== false && (type === undefined || paint.type === type));

const getSolidPaint = (paints: FigmaPaint[] | undefined): FigmaPaint | undefined => getVisiblePaint(paints, "SOLID");
const getImagePaint = (paints: FigmaPaint[] | undefined): FigmaPaint | undefined => getVisiblePaint(paints, "IMAGE");
const getGradientPaint = (paints: FigmaPaint[] | undefined): FigmaPaint | undefined =>
	paints?.find((paint) => paint.visible !== false && paint.type.startsWith("GRADIENT_"));

const rectFor = (node: FigmaNode, screen: { width: number; height: number }) =>
	node.absoluteBoundingBox ?? { x: 0, y: 0, width: screen.width, height: screen.height };

const jsxTagFor = (node: FigmaNode): string => {
	if (node.type === "TEXT") return "textlabel";
	if (getImagePaint(node.fills)) return node.name.toLowerCase().includes("button") ? "imagebutton" : "imagelabel";
	if (node.name.toLowerCase().includes("button")) return "textbutton";
	return "frame";
};

const enumAlignX = (value: string | undefined): string | undefined => {
	if (value === "CENTER") return "Enum.TextXAlignment.Center";
	if (value === "RIGHT") return "Enum.TextXAlignment.Right";
	if (value === "JUSTIFIED") return "Enum.TextXAlignment.Left";
	if (value === "LEFT") return "Enum.TextXAlignment.Left";
	return undefined;
};

const enumAlignY = (value: string | undefined): string | undefined => {
	if (value === "CENTER") return "Enum.TextYAlignment.Center";
	if (value === "BOTTOM") return "Enum.TextYAlignment.Bottom";
	if (value === "TOP") return "Enum.TextYAlignment.Top";
	return undefined;
};

const figmaEaseToRoblox = (type: string | undefined): { style: string; direction: string } => {
	if (type === "EASE_IN") return { style: "Enum.EasingStyle.Quad", direction: "Enum.EasingDirection.In" };
	if (type === "EASE_OUT") return { style: "Enum.EasingStyle.Quad", direction: "Enum.EasingDirection.Out" };
	if (type === "EASE_IN_AND_OUT") return { style: "Enum.EasingStyle.Quad", direction: "Enum.EasingDirection.InOut" };
	if (type === "BOUNCY") return { style: "Enum.EasingStyle.Back", direction: "Enum.EasingDirection.Out" };
	return { style: "Enum.EasingStyle.Linear", direction: "Enum.EasingDirection.Out" };
};

const collectReactions = (node: FigmaNode, into: Array<{ nodeId: string; nodeName: string; reaction: FigmaReaction }>): void => {
	for (const reaction of node.reactions ?? []) {
		into.push({ nodeId: node.id, nodeName: node.name, reaction });
	}
	for (const child of node.children ?? []) collectReactions(child, into);
};

const emitAnimationManifest = (root: FigmaNode): string => {
	const reactions: Array<{ nodeId: string; nodeName: string; reaction: FigmaReaction }> = [];
	collectReactions(root, reactions);
	const entries = reactions.map(({ nodeId, nodeName, reaction }) => {
		const transition = reaction.action?.transition;
		const ease = figmaEaseToRoblox(transition?.easing?.type);
		return {
			nodeId,
			nodeName,
			trigger: reaction.trigger?.type ?? "UNKNOWN",
			action: reaction.action?.type ?? "UNKNOWN",
			destinationId: reaction.action?.destinationId,
			duration: transition?.duration ?? 0.2,
			easingStyle: ease.style,
			easingDirection: ease.direction,
		};
	});
	return `// Auto-generated from Figma prototype reactions. Wire these into your controller/TweenService layer.\nexport const figmaAnimationManifest = ${JSON.stringify(entries, null, "\t")} as const;\n`;
};

const propLine = (name: string, expression: string): string => `${name}={${expression}}`;
const rawPropLine = (name: string, expression: string): string => `${name}=${expression}`;

const emitLayoutHelpers = (node: FigmaNode): string[] => {
	if (node.layoutMode !== "HORIZONTAL" && node.layoutMode !== "VERTICAL") return [];
	const fillDirection = node.layoutMode === "HORIZONTAL" ? "Horizontal" : "Vertical";
	const horizontal = node.counterAxisAlignItems === "CENTER" ? "Center" : node.counterAxisAlignItems === "MAX" ? "Right" : "Left";
	const vertical = node.counterAxisAlignItems === "CENTER" ? "Center" : node.counterAxisAlignItems === "MAX" ? "Bottom" : "Top";
	const padding = [node.paddingTop, node.paddingRight, node.paddingBottom, node.paddingLeft].some((value) => value !== undefined)
		? `\n\t\t<uipadding PaddingTop={new UDim(0, ${numberLiteral(node.paddingTop ?? 0)})} PaddingRight={new UDim(0, ${numberLiteral(node.paddingRight ?? 0)})} PaddingBottom={new UDim(0, ${numberLiteral(node.paddingBottom ?? 0)})} PaddingLeft={new UDim(0, ${numberLiteral(node.paddingLeft ?? 0)})} />`
		: "";
	return [
		`<uilistlayout FillDirection={Enum.FillDirection.${fillDirection}} SortOrder={Enum.SortOrder.LayoutOrder} Padding={new UDim(0, ${numberLiteral(node.itemSpacing ?? 0)})} HorizontalAlignment={Enum.HorizontalAlignment.${horizontal}} VerticalAlignment={Enum.VerticalAlignment.${vertical}} />${padding}`,
	];
};

const emitDecorators = (node: FigmaNode): string[] => {
	const decorators: string[] = [];
	const cornerRadius = node.cornerRadius ?? node.rectangleCornerRadii?.[0];
	if (cornerRadius && cornerRadius > 0) decorators.push(`<uicorner CornerRadius={new UDim(0, ${numberLiteral(cornerRadius)})} />`);
	const stroke = getSolidPaint(node.strokes);
	if (stroke?.color) {
		decorators.push(
			`<uistroke Color={${color3(stroke.color)}} Transparency={${transparency(stroke)}} Thickness={${numberLiteral(node.strokeWeight ?? 1)}} />`,
		);
	}
	const gradient = getGradientPaint(node.fills);
	if (gradient?.gradientStops && gradient.gradientStops.length >= 2) {
		const stops = gradient.gradientStops
			.map((stop) => `new ColorSequenceKeypoint(${numberLiteral(stop.position)}, ${color3(stop.color)})`)
			.join(", ");
		decorators.push(`<uigradient Color={new ColorSequence([${stops}])} />`);
	}
	for (const effect of node.effects ?? []) {
		if (effect.visible === false) continue;
		// Roblox GUI has no native blur/drop-shadow parity. Emit metadata tags as attributes for a post-pass/studio renderer.
		decorators.push(`{/* figma effect: ${effect.type} radius=${numberLiteral(effect.radius ?? 0)} */}`);
	}
	return decorators;
};

const emitNode = (
	node: FigmaNode,
	screen: { width: number; height: number },
	assetResolver: NonNullable<CompileOptions["assetResolver"]>,
	depth = 0,
): string => {
	const tag = jsxTagFor(node);
	const rect = rectFor(node, screen);
	const fill = getSolidPaint(node.fills);
	const image = getImagePaint(node.fills);
	const props: string[] = [
		rawPropLine("key", stringLiteral(node.id)),
		rawPropLine("Name", stringLiteral(node.name)),
		propLine("Position", `UDim2.fromOffset(${numberLiteral(rect.x)}, ${numberLiteral(rect.y)})`),
		propLine("Size", `UDim2.fromOffset(${numberLiteral(rect.width)}, ${numberLiteral(rect.height)})`),
	];
	if (node.visible === false) props.push(propLine("Visible", "false"));
	if (node.opacity !== undefined && node.opacity < 1) props.push(propLine("BackgroundTransparency", numberLiteral(1 - node.opacity)));
	if (node.clipsContent) props.push(propLine("ClipsDescendants", "true"));
	if (fill?.color && tag !== "textlabel") {
		props.push(propLine("BackgroundColor3", color3(fill.color)));
		props.push(propLine("BackgroundTransparency", transparency(fill, node.opacity ?? 1)));
	} else if (tag !== "textlabel") {
		props.push(propLine("BackgroundTransparency", "1"));
	}
	if (tag === "textlabel" || tag === "textbutton") {
		props.push(rawPropLine("Text", stringLiteral(node.characters ?? node.name)));
		props.push(propLine("BackgroundTransparency", "1"));
		if (fill?.color) props.push(propLine("TextColor3", color3(fill.color)));
		if (node.style?.fontSize) props.push(propLine("TextSize", numberLiteral(node.style.fontSize)));
		const alignX = enumAlignX(node.style?.textAlignHorizontal);
		const alignY = enumAlignY(node.style?.textAlignVertical);
		if (alignX) props.push(propLine("TextXAlignment", alignX));
		if (alignY) props.push(propLine("TextYAlignment", alignY));
		props.push(propLine("FontFace", `Font.fromName(${stringLiteral(node.style?.fontFamily ?? "Gotham")})`));
	}
	if ((tag === "imagelabel" || tag === "imagebutton") && image?.imageRef) {
		props.push(rawPropLine("Image", stringLiteral(assetResolver(image.imageRef, node))));
		props.push(propLine("ImageTransparency", transparency(image, node.opacity ?? 1)));
		props.push(propLine("BackgroundTransparency", "1"));
	}
	const decorators = emitDecorators(node);
	const layoutHelpers = emitLayoutHelpers(node);
	const childNodes = (node.children ?? []).filter((child) => child.visible !== false).map((child) => emitNode(child, screen, assetResolver, depth + 1));
	const children = [...decorators, ...layoutHelpers, ...childNodes];
	const joinedProps = props.length <= 4 ? props.join(" ") : `\n${indent(props.join("\n"), depth + 1)}\n${"\t".repeat(depth)}`;
	if (children.length === 0) return `${"\t".repeat(depth)}<${tag} ${joinedProps} />`;
	return `${"\t".repeat(depth)}<${tag} ${joinedProps}>\n${children.map((child) => indent(child, depth + 1)).join("\n")}\n${"\t".repeat(depth)}</${tag}>`;
};

const pickRoot = (document: FigmaDocument, rootName?: string): FigmaNode => {
	if (!rootName) return document.document;
	const visit = (node: FigmaNode): FigmaNode | undefined => {
		if (node.name === rootName || node.id === rootName) return node;
		for (const child of node.children ?? []) {
			const match = visit(child);
			if (match) return match;
		}
		return undefined;
	};
	return visit(document.document) ?? document.document;
};

export const compileFigmaToVide = (document: FigmaDocument, options: CompileOptions = {}): CompileResult => {
	const screen = options.screenSize ?? DEFAULT_SCREEN;
	const root = pickRoot(document, options.rootName);
	const componentName = options.componentName ?? sanitizeIdentifier(root.name);
	const warnings: string[] = [];
	const assetResolver = options.assetResolver ?? ((imageRef: string) => `rbxassetid://${imageRef}`);
	const body = emitNode(root, screen, assetResolver, 2);
	const contents = `/* eslint-disable */\n// Auto-generated by Anime Renaissance Figma → Vide compiler. Do not hand-edit generated blocks.\nimport Vide from "@rbxts/vide";\n\nexport interface ${componentName}Props {\n\tvisible?: boolean;\n}\n\nexport function ${componentName}(props: ${componentName}Props = {}) {\n\treturn (\n${body}\n\t);\n}\n\nexport default ${componentName};\n`;
	const files = [{ path: `${componentName}.tsx`, contents }];
	if (options.includeManifest !== false) files.push({ path: `${componentName}.animations.ts`, contents: emitAnimationManifest(root) });
	return { files, warnings };
};
