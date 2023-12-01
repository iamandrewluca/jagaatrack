import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
// @ts-expect-error - no types
import { useSound } from "use-sound";
import { Project, Log, ProjectAction, StartedProject, Interval } from "./types";
import { useMemo, useCallback, useEffect, useState } from "react";
import { ItemInterface } from "react-sortablejs";
import { useFavicon, useLocalStorage } from "@uidotdev/usehooks";
import { useAppContext } from "./AppProvider";

export function sum(items: number[]) {
	return items.reduce((acc, e) => acc + e, 0);
}

export function cn(...inputs: ClassValue[]) {
	return twMerge(clsx(inputs));
}

export function msToHumanFormat(
	ms: number,
	separator: "units" | "colon" = "colon",
) {
	const value = ms / 1000;
	const hours = Math.floor(value / 60 / 60);
	const minutes = Math.floor(value / 60) % 60;
	const seconds = Math.ceil(value % 60);

	const pairs = [
		{ value: hours, label: "h" },
		{ value: minutes, label: "m" },
		{ value: seconds, label: "s" },
	];

	if (separator === "units") {
		return pairs
			.filter((pair) => pair.value > 0)
			.map((pair) => `${pair.value}${pair.label}`)
			.join(" ");
	}

	const hoursPadded = String(hours).padStart(2, "0");
	const minutesPadded = String(minutes).padStart(2, "0");
	const secondsPadded = String(seconds).padStart(2, "0");

	return `${hoursPadded}:${minutesPadded}:${secondsPadded}`;
}

export function logToTextParts(log: Log) {
	const [start, end] = log.interval;
	const startTime = new Date(start).toLocaleTimeString();
	const endTime = new Date(end).toLocaleTimeString();
	const diff = end - start;
	const diffHuman = msToHumanFormat(diff, "units");

	return {
		timestamp: `${startTime} - ${endTime}`,
		name: `${log.activityName}, ${log.projectSlug}`,
		diffHuman,
	};
}

export function usePlayClick() {
	const [playClick] = useSound("/click.mp3");
	return playClick as () => void;
}

export function getLegend(intervalMinutes: number) {
	const thirdPartM = intervalMinutes / 3;
	const noActivity = "⬜ 0m";
	const oneThird = `< 🟨 < ${Math.floor(thirdPartM)}m`;
	const twoThirds = `< 🟧 < ${Math.floor(thirdPartM * 2)}m`;
	const full = `< 🟥 < ${intervalMinutes}m`;

	return `Legend: ${noActivity} ${oneThird} ${twoThirds} ${full}`;
}

type LogsTimelineOptions = {
	constraints: Interval;
	logs: Log[];
	intervalMinutes: number;
	timelineLength: number;
};

export function logsTimeline(options: LogsTimelineOptions) {
	const { constraints, logs, intervalMinutes, timelineLength } = options;
	const intervalMs = 1000 * 60 * intervalMinutes;
	const thirdPartMs = intervalMs / 3;

	const intervals = logs.flatMap((log) =>
		[...createInterval(log.interval, intervalMs)].map((start) => ({
			start,
			size: Math.min(intervalMs, log.interval[1] - start),
		})),
	);

	const blocks = [...createInterval([0, timelineLength])].map((i) => {
		const intervalStart = constraints[0] + i * intervalMs;
		const intervalEnd = intervalStart + intervalMs;
		const interval = [intervalStart, intervalEnd] as Interval;
		const blocks = intervals.filter(({ start }) => inInterval(start, interval));
		const sumMs = sum(blocks.map((e) => e.size));

		if (sumMs > thirdPartMs * 2) {
			return "🟥";
		} else if (sumMs > thirdPartMs) {
			return "🟧";
		} else if (sumMs > 0) {
			return "🟨";
		} else {
			return "⬜";
		}
	});

	return blocks.join("");
}

function* createInterval([start, end]: Interval, step = 1) {
	for (let i = start; i < end; i += step) {
		yield i;
	}
}

function inInterval(value: number, [start, end]: Interval): boolean {
	return start <= value && value <= end;
}

export function getLogsConstraints(logs: Log[], projects: Project[]) {
	const startedAts = projects.map((e) => e.startedAt).filter(Boolean);
	const endedAts = startedAts.length ? [Date.now()] : [];

	const start = Math.min(...logs.map((e) => e.interval[0]), ...startedAts);
	const end = Math.max(...logs.map((e) => e.interval[1]), ...endedAts);

	return [start, end] as Interval;
}

type FocusableElements =
	| HTMLInputElement
	| HTMLTextAreaElement
	| HTMLButtonElement
	| HTMLSelectElement
	| HTMLAnchorElement;

export function isFocusable(
	element: Element | null,
): element is FocusableElements {
	const elements = ["INPUT", "TEXTAREA", "BUTTON", "SELECT", "A"];
	return elements.includes(element?.tagName as string);
}

export function askForActivityName(defaultName?: string) {
	const userAnswer = window.prompt("What are you working on?", defaultName);
	return userAnswer || undefined;
}

export function useSortableList() {
	const { projects, setProjects } = useAppContext();
	const projectsList = useMemo<ItemInterface[]>(
		() => projects.map((p) => ({ id: p.slug })),
		[projects],
	);
	const setProjectsList = useCallback(
		(list: ItemInterface[]) => {
			const newProjects = list.map((item) =>
				projects.find((p) => p.slug === item.id),
			);

			setProjects(newProjects as Project[]);
		},
		[projects, setProjects],
	);

	return [projectsList, setProjectsList] as const;
}

const faviconPlay = "/favicon-play.svg";
const faviconPause = "/favicon-pause.svg";

export function useDynamicFavicon() {
	const { activeProjects } = useAppContext();
	const [favicon, setFavicon] = useState(
		activeProjects.length ? faviconPlay : faviconPause,
	);

	useFavicon(favicon);

	useEffect(() => {
		setFavicon(activeProjects.length ? faviconPlay : faviconPause);
	}, [activeProjects.length]);
}

export function storageKey(key: string) {
	return `jagaatrack:${key}`;
}

export function useProjectButtons() {
	const [projectButtons, _setProjectButtons] = useLocalStorage<ProjectAction[]>(
		storageKey("project-end-buttons"),
		["copy", "rename"],
	);

	function toggleProjectButton(button: ProjectAction) {
		const newButtons = projectButtons.includes(button)
			? projectButtons.filter((e) => e !== button)
			: [...projectButtons, button];

		_setProjectButtons([...new Set(newButtons)]);
	}

	return [projectButtons, toggleProjectButton] as const;
}

const sumStartedAts = (startedAts: number[]) =>
	sum(startedAts.map((startedAt) => Date.now() - startedAt));

export function useLiveTotalTime(projects: Project[]) {
	const { getProjectLogs } = useAppContext();

	const logs = useMemo(
		() => projects.flatMap((p) => getProjectLogs(p)),
		[getProjectLogs, projects],
	);

	const logsTime = useMemo(
		() => sum(logs.map((e) => e.interval[1] - e.interval[0])),
		[logs],
	);

	const startedAts = useMemo(
		() => projects.filter(isStartedProject).map((p) => p.startedAt),
		[projects],
	);

	const [totalTime, setTotalTime] = useState(
		logsTime + sumStartedAts(startedAts),
	);

	useEffect(() => {
		setTotalTime(logsTime + sumStartedAts(startedAts));

		if (!projects.some((e) => e.startedAt)) return;

		const interval = setInterval(() => {
			setTotalTime(logsTime + sumStartedAts(startedAts));
		}, 1000);

		return () => clearInterval(interval);
	}, [logsTime, projects, startedAts]);

	return totalTime;
}

export function isStartedProject(project: Project): project is StartedProject {
	return project.startedAt !== undefined;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const groupBy = <T extends Record<string, any>, K extends keyof T>(
	arr: T[],
	key: K,
): Record<string, T[]> =>
	arr.reduce(
		(acc, item) => ((acc[item[key]] = [...(acc[item[key]] || []), item]), acc),
		{} as Record<string, T[]>,
	);
