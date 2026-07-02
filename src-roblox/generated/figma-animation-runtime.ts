// Auto-generated helper for generated Figma animation manifests.
import { TweenService } from "@rbxts/services";

export type FigmaAnimationEntry = {
	nodeId: string;
	nodeName: string;
	trigger: string;
	action: string;
	destinationId?: string;
	duration: number;
	easingStyle: Enum.EasingStyle;
	easingDirection: Enum.EasingDirection;
};

export type FigmaAnimationRuntimeOptions = {
	root: Instance;
	manifest: readonly FigmaAnimationEntry[];
	openByDestinationId?: Record<string, () => void>;
	onTrigger?: (entry: FigmaAnimationEntry, gui: GuiObject) => void;
	debug?: boolean;
};

const findGuiObject = (root: Instance, name: string): GuiObject | undefined => {
	for (const descendant of root.GetDescendants()) {
		if (descendant.Name === name && descendant.IsA("GuiObject")) return descendant;
	}
	return undefined;
};

export const tweenFigmaGui = (gui: GuiObject, entry: FigmaAnimationEntry, goal: Partial<ExtractMembers<GuiObject, Tweenable>> = {}) => {
	const info = new TweenInfo(entry.duration, entry.easingStyle, entry.easingDirection);
	return TweenService.Create(gui, info, goal);
};

export const createFigmaAnimationRuntime = (options: FigmaAnimationRuntimeOptions) => {
	const cleanup: Array<() => void> = [];

	for (const entry of options.manifest) {
		const gui = findGuiObject(options.root, entry.nodeName);
		if (!gui) {
			if (options.debug) warn("[figma-vide] missing gui object " + entry.nodeName);
			continue;
		}

		if (entry.trigger === "ON_CLICK" && (gui.IsA("GuiButton") || gui.IsA("TextButton") || gui.IsA("ImageButton"))) {
			const connection = gui.Activated.Connect(() => {
				if (entry.destinationId !== undefined) options.openByDestinationId?.[entry.destinationId]?.();
				options.onTrigger?.(entry, gui);
				const tween = tweenFigmaGui(gui, entry, { Rotation: gui.Rotation + 0 });
				tween.Play();
			});
			cleanup.push(() => connection.Disconnect());
		}

		if (entry.trigger === "MOUSE_ENTER" || entry.trigger === "ON_HOVER") {
			const connection = gui.MouseEnter.Connect(() => options.onTrigger?.(entry, gui));
			cleanup.push(() => connection.Disconnect());
		}

		if (entry.trigger === "MOUSE_LEAVE") {
			const connection = gui.MouseLeave.Connect(() => options.onTrigger?.(entry, gui));
			cleanup.push(() => connection.Disconnect());
		}

		if (entry.trigger === "AFTER_TIMEOUT") {
			task.delay(entry.duration, () => {
				if (gui.Parent !== undefined) options.onTrigger?.(entry, gui);
			});
		}
	}

	return {
		destroy: () => {
			for (const dispose of cleanup) dispose();
			table.clear(cleanup);
		},
	};
};
