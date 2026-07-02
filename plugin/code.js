const MIXED = Symbol.for("figma.mixed");

figma.showUI(__html__, { width: 520, height: 620, themeColors: true });

function isMixed(value) {
	return value === figma.mixed || value === MIXED;
}

function cloneColor(color, opacity) {
	if (!color || isMixed(color)) return undefined;
	return {
		r: color.r,
		g: color.g,
		b: color.b,
		a: opacity,
	};
}

async function serializePaint(paint, assets) {
	if (!paint || isMixed(paint)) return undefined;
	const base = {
		type: paint.type,
		visible: paint.visible,
		opacity: paint.opacity,
	};
	if (paint.type === "SOLID") {
		return { ...base, color: cloneColor(paint.color, paint.opacity ?? 1) };
	}
	if (paint.type === "IMAGE") {
		if (paint.imageHash && assets && !assets[paint.imageHash]) {
			try {
				const image = figma.getImageByHash(paint.imageHash);
				const bytes = await image.getBytesAsync();
				let binary = "";
				for (const byte of bytes) binary += String.fromCharCode(byte);
				assets[paint.imageHash] = {
					fileName: `${paint.imageHash}.png`,
					mimeType: "image/png",
					base64: btoa(binary),
				};
			} catch (error) {
				console.warn("Failed to export image", paint.imageHash, error);
			}
		}
		return {
			...base,
			imageRef: paint.imageHash,
			scaleMode: paint.scaleMode,
		};
	}
	if (paint.type.startsWith("GRADIENT_")) {
		return {
			...base,
			gradientStops: paint.gradientStops?.map((stop) => ({
				position: stop.position,
				color: cloneColor(stop.color, stop.color?.a ?? 1),
			})),
			gradientTransform: paint.gradientTransform,
		};
	}
	return base;
}

function serializeEffect(effect) {
	if (!effect || isMixed(effect)) return undefined;
	return {
		type: effect.type,
		visible: effect.visible,
		color: cloneColor(effect.color, effect.color?.a ?? 1),
		offset: effect.offset,
		radius: effect.radius,
		spread: effect.spread,
	};
}

function serializeTextStyle(node) {
	if (node.type !== "TEXT") return undefined;
	return {
		fontFamily: isMixed(node.fontName) ? undefined : node.fontName?.family,
		fontPostScriptName: isMixed(node.fontName) ? undefined : node.fontName?.style,
		fontSize: isMixed(node.fontSize) ? undefined : node.fontSize,
		fontWeight: isMixed(node.fontWeight) ? undefined : node.fontWeight,
		lineHeightPx: !node.lineHeight || isMixed(node.lineHeight) || node.lineHeight.unit !== "PIXELS" ? undefined : node.lineHeight.value,
		letterSpacing: !node.letterSpacing || isMixed(node.letterSpacing) ? undefined : node.letterSpacing.value,
		textAlignHorizontal: isMixed(node.textAlignHorizontal) ? undefined : node.textAlignHorizontal,
		textAlignVertical: isMixed(node.textAlignVertical) ? undefined : node.textAlignVertical,
	};
}

function maybeRead(node, key) {
	try {
		return node[key];
	} catch (_err) {
		return undefined;
	}
}

function serializeReactions(node) {
	const reactions = maybeRead(node, "reactions");
	if (!Array.isArray(reactions)) return undefined;
	return reactions.map((reaction) => ({
		trigger: reaction.trigger,
		action: reaction.action,
	}));
}

async function serializeNode(node, assets) {
	const box = maybeRead(node, "absoluteBoundingBox");
	const fills = maybeRead(node, "fills");
	const strokes = maybeRead(node, "strokes");
	const effects = maybeRead(node, "effects");
	const exportSettings = maybeRead(node, "exportSettings");
	const children = "children" in node ? await Promise.all(node.children.map((child) => serializeNode(child, assets))) : undefined;

	return {
		id: node.id,
		name: node.name,
		type: node.type,
		visible: node.visible,
		opacity: maybeRead(node, "opacity"),
		absoluteBoundingBox: box
			? {
					x: box.x,
					y: box.y,
					width: box.width,
					height: box.height,
				}
			: undefined,
		fills: Array.isArray(fills) ? (await Promise.all(fills.map((paint) => serializePaint(paint, assets)))).filter(Boolean) : undefined,
		strokes: Array.isArray(strokes) ? (await Promise.all(strokes.map((paint) => serializePaint(paint, assets)))).filter(Boolean) : undefined,
		strokeWeight: isMixed(maybeRead(node, "strokeWeight")) ? undefined : maybeRead(node, "strokeWeight"),
		cornerRadius: isMixed(maybeRead(node, "cornerRadius")) ? undefined : maybeRead(node, "cornerRadius"),
		rectangleCornerRadii: isMixed(maybeRead(node, "cornerRadius")) ? maybeRead(node, "rectangleCornerRadii") : undefined,
		effects: Array.isArray(effects) ? effects.map(serializeEffect).filter(Boolean) : undefined,
		characters: node.type === "TEXT" ? node.characters : undefined,
		style: serializeTextStyle(node),
		layoutMode: maybeRead(node, "layoutMode"),
		primaryAxisAlignItems: maybeRead(node, "primaryAxisAlignItems"),
		counterAxisAlignItems: maybeRead(node, "counterAxisAlignItems"),
		itemSpacing: isMixed(maybeRead(node, "itemSpacing")) ? undefined : maybeRead(node, "itemSpacing"),
		paddingLeft: maybeRead(node, "paddingLeft"),
		paddingRight: maybeRead(node, "paddingRight"),
		paddingTop: maybeRead(node, "paddingTop"),
		paddingBottom: maybeRead(node, "paddingBottom"),
		clipsContent: maybeRead(node, "clipsContent"),
		constraints: maybeRead(node, "constraints"),
		reactions: serializeReactions(node),
		exportSettings: Array.isArray(exportSettings)
			? exportSettings.map((setting) => ({ format: setting.format, suffix: setting.suffix }))
			: undefined,
		children,
	};
}

async 
function solid(r, g, b, a = 1) {
	return { type: "SOLID", color: { r, g, b }, opacity: a };
}

async function loadFontForText(fontName = { family: "Inter", style: "Regular" }) {
	try {
		await figma.loadFontAsync(fontName);
		return fontName;
	} catch (_err) {
		const fallback = { family: "Arial", style: "Regular" };
		await figma.loadFontAsync(fallback);
		return fallback;
	}
}

async function createText(parent, name, text, x, y, width, height, size, color, align = "LEFT") {
	const node = figma.createText();
	node.name = name;
	node.x = x;
	node.y = y;
	node.resize(width, height);
	node.fontName = await loadFontForText();
	node.characters = text;
	node.fontSize = size;
	node.textAlignHorizontal = align;
	node.textAlignVertical = "CENTER";
	node.fills = [solid(color.r, color.g, color.b, color.a ?? 1)];
	parent.appendChild(node);
	return node;
}

function createRect(parent, name, x, y, width, height, fill, radius = 0, stroke, strokeWeight = 1) {
	const node = figma.createFrame();
	node.name = name;
	node.x = x;
	node.y = y;
	node.resize(width, height);
	node.fills = [fill];
	node.clipsContent = true;
	if (radius > 0) node.cornerRadius = radius;
	if (stroke) {
		node.strokes = [stroke];
		node.strokeWeight = strokeWeight;
	}
	parent.appendChild(node);
	return node;
}

async function createLevelHudWireframe() {
	const root = figma.createFrame();
	root.name = "Level HUD Wireframe";
	root.resize(1920, 1080);
	root.x = figma.viewport.center.x - 960;
	root.y = figma.viewport.center.y - 540;
	root.fills = [solid(0.04, 0.045, 0.06, 1)];
	root.clipsContent = true;
	figma.currentPage.appendChild(root);

	const topBar = createRect(root, "Top Bar", 560, 24, 800, 92, solid(0.1, 0.11, 0.14, 0.9), 18, solid(0.35, 0.38, 0.48, 1), 2);
	await createText(topBar, "Wave Text #bind=waveText", "WAVE 1 / 30", 50, 24, 240, 42, 30, { r: 1, g: 0.9, b: 0.45 }, "LEFT");
	await createText(topBar, "Timer Text #bind=timerText", "01:25", 320, 24, 160, 42, 32, { r: 1, g: 1, b: 1 }, "CENTER");
	const speedButton = createRect(topBar, "Speed Button #on=onToggleSpeed", 550, 20, 190, 50, solid(0.18, 0.22, 0.3, 1), 12);
	await createText(speedButton, "Speed Label #bind=speedText", "1x SPEED", 20, 8, 150, 34, 22, { r: 0.75, g: 0.9, b: 1 }, "CENTER");

	const stats = createRect(root, "Left Stats Panel", 32, 32, 300, 150, solid(0.09, 0.1, 0.13, 0.88), 16);
	await createText(stats, "Lives Text #bind=livesText", "❤ 100", 26, 22, 220, 38, 28, { r: 1, g: 0.35, b: 0.35 }, "LEFT");
	await createText(stats, "Yen Text #bind=yenText", "¥ 500", 26, 76, 220, 38, 28, { r: 1, g: 0.82, b: 0.22 }, "LEFT");

	const hotbar = createRect(root, "Bottom Hotbar #repeat=towers", 390, 880, 1140, 160, solid(0.08, 0.085, 0.11, 0.94), 24, solid(0.28, 0.3, 0.38, 1), 2);
	for (let index = 0; index < 6; index++) {
		const slot = createRect(hotbar, `Tower Slot ${index + 1} #on=onTower${index + 1}`, 30 + index * 180, 30, 150, 110, solid(0.14, 0.15, 0.2, 1), 16, solid(0.3, 0.32, 0.42, 1), 1);
		createRect(slot, `Tower Icon Placeholder ${index + 1}`, 16, 12, 62, 62, solid(0.2, 0.22, 0.3, 1), 12);
		await createText(slot, `Tower Cost ${index + 1} #bind=tower${index + 1}Cost`, "¥ 500", 84, 18, 54, 24, 14, { r: 1, g: 0.82, b: 0.22 }, "CENTER");
		await createText(slot, `Tower Key ${index + 1}`, `${index + 1}`, 12, 78, 28, 22, 16, { r: 0.65, g: 0.7, b: 0.85 }, "CENTER");
		await createText(slot, `Tower Name ${index + 1} #bind=tower${index + 1}Name`, "Unit", 46, 78, 88, 22, 14, { r: 1, g: 1, b: 1 }, "CENTER");
	}

	const placement = createRect(root, "Placement Hint Panel", 760, 760, 400, 72, solid(0.06, 0.07, 0.09, 0.78), 18, solid(0.25, 0.32, 0.45, 1), 1);
	await createText(placement, "Placement Hint Text #bind=placementHint", "Select a tower to place", 24, 16, 352, 40, 24, { r: 0.78, g: 0.86, b: 1 }, "CENTER");

	figma.currentPage.selection = [root];
	figma.viewport.scrollAndZoomIntoView([root]);
	figma.notify("Created Level HUD Wireframe. Edit/animate it, then export selection.");
	postExport();
}

async function selectionToDocument() {
	const assets = {};
	const selection = figma.currentPage.selection;
	if (selection.length === 0) {
		throw new Error("Select one frame/component/group/text node first.");
	}
	if (selection.length === 1) {
		return { document: await serializeNode(selection[0], assets), assets };
	}
	const bounds = selection.reduce(
		(acc, node) => {
			const box = node.absoluteBoundingBox;
			if (!box) return acc;
			return {
				x1: Math.min(acc.x1, box.x),
				y1: Math.min(acc.y1, box.y),
				x2: Math.max(acc.x2, box.x + box.width),
				y2: Math.max(acc.y2, box.y + box.height),
			};
		},
		{ x1: Infinity, y1: Infinity, x2: -Infinity, y2: -Infinity },
	);
	return {
		document: {
			id: `selection:${Date.now()}`,
			name: "Figma Selection",
			type: "FRAME",
			absoluteBoundingBox: {
				x: Number.isFinite(bounds.x1) ? bounds.x1 : 0,
				y: Number.isFinite(bounds.y1) ? bounds.y1 : 0,
				width: Number.isFinite(bounds.x2 - bounds.x1) ? bounds.x2 - bounds.x1 : 0,
				height: Number.isFinite(bounds.y2 - bounds.y1) ? bounds.y2 - bounds.y1 : 0,
			},
			children: await Promise.all(selection.map((node) => serializeNode(node, assets))),
		},
	};
}

async function postExport() {
	try {
		const payload = await selectionToDocument();
		figma.ui.postMessage({ type: "export", payload });
		figma.notify("Exported selected Figma UI JSON.");
	} catch (error) {
		figma.ui.postMessage({ type: "error", message: error instanceof Error ? error.message : String(error) });
		figma.notify(error instanceof Error ? error.message : String(error), { error: true });
	}
}

figma.ui.onmessage = (message) => {
	if (message.type === "export") postExport();
	if (message.type === "create-level-hud") createLevelHudWireframe();
	if (message.type === "close") figma.closePlugin();
};

postExport();
