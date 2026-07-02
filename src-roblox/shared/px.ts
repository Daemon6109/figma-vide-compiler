import Vide, { source, spring, type Source } from "@rbxts/vide";

const BASE_RESOLUTION = new Vector2(1920, 1080);
const MIN_SCALE = 0.25;

type UDimSource = () => UDim;
type UDim2Source = () => UDim2;

export type PxScreenKind = "mobile" | "standard" | "wide";
export type PxResponsiveNumber = number | { base: number; mobile?: number; wide?: number };
export type PxUDimFn = (value: number) => UDimSource;
export type PxUDim2Fn = {
	(x: number, y: number): UDim2Source;
	(xScale: number, xOffset: number, yScale: number, yOffset?: number): UDim2Source;
};
export type PxNumberFn = (value: number) => () => number;
export type PxResponsiveNumberFn = (value: PxResponsiveNumber) => () => number;
export type PxAspectSizeFn = (options: {
	aspectRatio: number;
	width?: PxResponsiveNumber;
	height?: PxResponsiveNumber;
	axis?: "width" | "height";
	maxViewportWidth?: number;
	maxViewportHeight?: number;
}) => UDim2Source;
export type PxSpring = <T extends Vide.Animatable>(
	fn: (scale: {
		useNumber: (n: number) => number;
		useUDim: (n: number) => UDim;
		useUDim2: {
			(a: number, b: number): UDim2;
			(a: number, b: number, c: number, d?: number): UDim2;
		};
	}) => T,
	speed?: number,
	dampening?: number,
) => () => T;

const scale = source(1);
const viewportSize = source(BASE_RESOLUTION);
const screenKind = source<PxScreenKind>("standard");

type Target = GuiObject | Camera;

interface CurrentTarget {
	target: Target;
	cleanup: () => void;
}

let currentTarget: CurrentTarget | undefined;

function getScreenKind(size: Vector2): PxScreenKind {
	const aspect = size.Y <= 0 ? BASE_RESOLUTION.X / BASE_RESOLUTION.Y : size.X / size.Y;

	if (size.X <= 900 || aspect < 1.45) return "mobile";
	if (aspect >= 2.05) return "wide";
	return "standard";
}

function updateScaleFromSize(size: Vector2): void {
	viewportSize(size);
	screenKind(getScreenKind(size));

	const width = size.X / BASE_RESOLUTION.X;
	const height = size.Y / BASE_RESOLUTION.Y;
	const newScale = math.min(width, height);
	const clamped = math.max(newScale, MIN_SCALE);

	scale(clamped);
}

function setTarget(newTarget: Target): void {
	if (currentTarget && currentTarget.target === newTarget) return;

	if (currentTarget) currentTarget.cleanup();

	const event = newTarget.IsA("Camera")
		? newTarget.GetPropertyChangedSignal("ViewportSize")
		: newTarget.GetPropertyChangedSignal("AbsoluteSize");

	const update = (): void => {
		const size = newTarget.IsA("Camera") ? newTarget.ViewportSize : newTarget.AbsoluteSize;
		updateScaleFromSize(size);
	};

	const conn = event.Connect(update);
	update();

	currentTarget = {
		target: newTarget,
		cleanup: () => conn.Disconnect(),
	};
}

function pxUDim(value: number): UDimSource {
	return () => new UDim(0, value * scale());
}

function pxUDim2(xArg: number, yArg: number, arg3?: number, arg4?: number): UDim2Source {
	return () => {
		const s = scale();

		if (arg3 === undefined) return UDim2.fromOffset(xArg * s, yArg * s);

		const xScale = xArg;
		const xOffset = yArg;
		const yScale = arg3;
		const yOffset = arg4 ?? 0;

		return new UDim2(xScale, xOffset * s, yScale, yOffset * s);
	};
}

function pxNumber(value: number): () => number {
	return () => value * scale();
}

function resolveResponsiveNumber(value: PxResponsiveNumber, kind: PxScreenKind): number {
	if (typeIs(value, "number")) return value;
	if (kind === "mobile" && value.mobile !== undefined) return value.mobile;
	if (kind === "wide" && value.wide !== undefined) return value.wide;
	return value.base;
}

function pxResponsiveNumber(value: PxResponsiveNumber): () => number {
	return () => resolveResponsiveNumber(value, screenKind()) * scale();
}

function pxAspectSize(options: {
	aspectRatio: number;
	width?: PxResponsiveNumber;
	height?: PxResponsiveNumber;
	axis?: "width" | "height";
	maxViewportWidth?: number;
	maxViewportHeight?: number;
}): UDim2Source {
	return () => {
		const kind = screenKind();
		const s = scale();
		const aspectRatio = math.max(options.aspectRatio, 0.001);
		const axis = options.axis ?? (options.width !== undefined ? "width" : "height");

		let width =
			options.width !== undefined
				? resolveResponsiveNumber(options.width, kind) * s
				: options.height !== undefined
					? resolveResponsiveNumber(options.height, kind) * aspectRatio * s
					: 0;

		let height =
			options.height !== undefined
				? resolveResponsiveNumber(options.height, kind) * s
				: options.width !== undefined
					? (resolveResponsiveNumber(options.width, kind) / aspectRatio) * s
					: 0;

		if (axis === "width" && width > 0) height = width / aspectRatio;
		else if (height > 0) width = height * aspectRatio;

		const viewport = viewportSize();
		const maxWidth = options.maxViewportWidth !== undefined ? viewport.X * options.maxViewportWidth : math.huge;
		const maxHeight = options.maxViewportHeight !== undefined ? viewport.Y * options.maxViewportHeight : math.huge;

		if (width > maxWidth) {
			width = maxWidth;
			height = width / aspectRatio;
		}

		if (height > maxHeight) {
			height = maxHeight;
			width = height * aspectRatio;
		}

		return UDim2.fromOffset(width, height);
	};
}

function pxSpring<T extends Vide.Animatable>(
	fn: (scale: {
		useNumber: (n: number) => number;
		useUDim: (n: number) => UDim;
		useUDim2: {
			(a: number, b: number): UDim2;
			(a: number, b: number, c: number, d?: number): UDim2;
		};
	}) => T,
	speed?: number,
	dampening?: number,
): () => T {
	const [springValue] = spring(
		() => {
			const s = scale();

			return fn({
				useNumber: (n) => n * s,
				useUDim: (n) => new UDim(0, n * s),
				useUDim2: (a, b, c?: number, d?: number) => {
					if (c === undefined) return UDim2.fromOffset(a * s, b * s);
					return new UDim2(a, b * s, c, (d ?? 0) * s);
				},
			});
		},
		speed ?? 1,
		dampening ?? 1,
	);

	return springValue;
}

export interface PxModule {
	setTarget: (target: Target) => void;
	useScale: Source<number>;
	useViewportSize: Source<Vector2>;
	useScreenKind: Source<PxScreenKind>;
	useNumber: PxNumberFn;
	useResponsiveNumber: PxResponsiveNumberFn;
	useUDim2: PxUDim2Fn;
	useAspectSize: PxAspectSizeFn;
	useSpring: PxSpring;
	useUDim: PxUDimFn;
}

const px: PxModule = {
	setTarget,
	useSpring: pxSpring,
	useNumber: pxNumber,
	useResponsiveNumber: pxResponsiveNumber,
	useUDim2: pxUDim2,
	useAspectSize: pxAspectSize,
	useUDim: pxUDim,
	useScale: scale,
	useViewportSize: viewportSize,
	useScreenKind: screenKind,
};

export default px;
