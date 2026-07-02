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
	if (message.type === "close") figma.closePlugin();
};

postExport();
