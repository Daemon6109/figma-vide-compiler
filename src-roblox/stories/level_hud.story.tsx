import { CreateVideStory, Number as UILabsNumber } from "@rbxts/ui-labs";
import Vide, { source } from "@rbxts/vide";
import LevelHudWireframe from "../generated/LevelHudWireframe";

const controls = {
	wave: UILabsNumber(1, 1, 50, 1),
	maxWave: UILabsNumber(30, 1, 100, 1),
	timeLeft: UILabsNumber(85, 0, 600, 1),
	lives: UILabsNumber(100, 0, 500, 1),
	yen: UILabsNumber(500, 0, 999999, 50),
	speed: UILabsNumber(1, 1, 4, 1),
};

const formatTime = (seconds: number) => {
	const minutes = math.floor(seconds / 60);
	const remainder = seconds % 60;
	return `${minutes}:${remainder < 10 ? "0" : ""}${remainder}`;
};

export = CreateVideStory(
	{
		name: "Generated/Level HUD Wireframe",
		summary: "Generated Figma → Vide HUD preview with UI Labs controls.",
		vide: Vide,
		controls,
	},
	(storyProps) => {
		const selectedTower = source("none");

		return (
			<LevelHudWireframe
				waveText={() => `WAVE ${storyProps.controls.wave()} / ${storyProps.controls.maxWave()}`}
				timerText={() => formatTime(storyProps.controls.timeLeft())}
				speedText={() => `${storyProps.controls.speed()}x SPEED`}
				livesText={() => `❤ ${storyProps.controls.lives()}`}
				yenText={() => `¥ ${storyProps.controls.yen()}`}
				towers={[]}
				onToggleSpeed={() => print("toggle speed")}
				onTower1={() => selectedTower("tower-1")}
				onTower2={() => selectedTower("tower-2")}
				onTower3={() => selectedTower("tower-3")}
				onTower4={() => selectedTower("tower-4")}
				onTower5={() => selectedTower("tower-5")}
				onTower6={() => selectedTower("tower-6")}
			/>
		);
	},
);
