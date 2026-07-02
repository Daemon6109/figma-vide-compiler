export type FigmaColor = {
	r: number;
	g: number;
	b: number;
	a?: number;
};

export type FigmaRect = {
	x: number;
	y: number;
	width: number;
	height: number;
};

export type FigmaPaint = {
	type: "SOLID" | "IMAGE" | "GRADIENT_LINEAR" | "GRADIENT_RADIAL" | "GRADIENT_ANGULAR" | "GRADIENT_DIAMOND";
	visible?: boolean;
	opacity?: number;
	color?: FigmaColor;
	imageRef?: string;
	scaleMode?: "FILL" | "FIT" | "CROP" | "TILE";
	gradientStops?: Array<{ position: number; color: FigmaColor }>;
};

export type FigmaEffect = {
	type: "DROP_SHADOW" | "INNER_SHADOW" | "LAYER_BLUR" | "BACKGROUND_BLUR";
	visible?: boolean;
	color?: FigmaColor;
	offset?: { x: number; y: number };
	radius?: number;
	spread?: number;
};

export type FigmaTextStyle = {
	fontFamily?: string;
	fontPostScriptName?: string;
	fontSize?: number;
	fontWeight?: number;
	lineHeightPx?: number;
	letterSpacing?: number;
	textAlignHorizontal?: "LEFT" | "CENTER" | "RIGHT" | "JUSTIFIED";
	textAlignVertical?: "TOP" | "CENTER" | "BOTTOM";
};

export type FigmaReaction = {
	action?: {
		type?: string;
		destinationId?: string;
		navigation?: string;
		transition?: FigmaTransition;
	};
	trigger?: {
		type?: string;
		timeout?: number;
	};
};

export type FigmaTransition = {
	type?: string;
	duration?: number;
	easing?: {
		type?: string;
		curve?: number[];
	};
};

export type FigmaNode = {
	id: string;
	name: string;
	type: string;
	visible?: boolean;
	opacity?: number;
	absoluteBoundingBox?: FigmaRect;
	children?: FigmaNode[];
	fills?: FigmaPaint[];
	strokes?: FigmaPaint[];
	strokeWeight?: number;
	cornerRadius?: number;
	rectangleCornerRadii?: [number, number, number, number];
	effects?: FigmaEffect[];
	characters?: string;
	style?: FigmaTextStyle;
	layoutMode?: "NONE" | "HORIZONTAL" | "VERTICAL";
	primaryAxisAlignItems?: "MIN" | "CENTER" | "MAX" | "SPACE_BETWEEN";
	counterAxisAlignItems?: "MIN" | "CENTER" | "MAX" | "BASELINE";
	itemSpacing?: number;
	paddingLeft?: number;
	paddingRight?: number;
	paddingTop?: number;
	paddingBottom?: number;
	clipsContent?: boolean;
	constraints?: {
		horizontal?: string;
		vertical?: string;
	};
	reactions?: FigmaReaction[];
	exportSettings?: Array<{ format: string; suffix?: string }>;
};

export type FigmaDocument = {
	document: FigmaNode;
	assets?: Record<string, { fileName: string; mimeType: string; base64: string }>;
	components?: Record<string, { name: string; description?: string }>;
	styles?: Record<string, { name: string; styleType: string; description?: string }>;
};

export type CompileOptions = {
	componentName?: string;
	rootName?: string;
	screenSize?: { width: number; height: number };
	/** Keep the selected root frame at its Figma canvas coordinates. Defaults to false so generated screens mount at 0,0. */
	preserveRootPosition?: boolean;
	assetResolver?: (imageRef: string, node: FigmaNode) => string;
	/** Return a TSX expression for an image ref. Overrides assetResolver when supplied. */
	assetExpressionResolver?: (imageRef: string, node: FigmaNode) => string;
	assetImport?: string;
	/** Emit px.useUDim2/useNumber/useUDim wrappers instead of fixed offset numbers. */
	usePx?: boolean;
	/** Import line for the px module when usePx is enabled. */
	pxImport?: string;
	includeManifest?: boolean;
	includeRuntime?: boolean;
};

export type GeneratedFile = {
	path: string;
	contents: string;
};

export type CompileResult = {
	files: GeneratedFile[];
	warnings: string[];
};
