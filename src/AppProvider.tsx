import { useLocalStorage } from "@uidotdev/usehooks";
import {
	Dispatch,
	PropsWithChildren,
	SetStateAction,
	useCallback,
	useMemo,
} from "react";
import { Interval, Log, Project } from "./types";
import { groupBy, isStartedProject, storageKey } from "./utils";
import { AppContext } from "./app-context";

export function AppProvider({ children }: PropsWithChildren) {
	const [projects, setProjects] = useProjects();
	const [logs, setLogs] = useLocalStorage<Log[]>(
		storageKey("logs"),
		useMigrateOldLogs(projects),
	);

	const activeProjects = useMemo(
		() => projects.filter(isStartedProject),
		[projects],
	);

	const logsByProject = useMemo(() => groupBy(logs, "projectSlug"), [logs]);

	const getProjectLogs = useCallback(
		(project: Project) => logsByProject[project.slug] ?? [],
		[logsByProject],
	);

	return (
		<AppContext.Provider
			value={{
				projects,
				setProjects,
				logs,
				setLogs,
				activeProjects,
				getProjectLogs,
			}}
		>
			{children}
		</AppContext.Provider>
	);
}

function useProjects() {
	const [projects, _setProjects] = useLocalStorage<Project[]>(
		storageKey("projects"),
		[],
	);

	// TODO: Remove migration after a while
	const setProjects: Dispatch<SetStateAction<Project[]>> = useCallback(
		function (value) {
			const voidTimes = (projects: Project[]) =>
				projects.map((p: Project) => ({ ...p, times: undefined }));

			if (typeof value !== "function") {
				_setProjects(voidTimes(value));
			} else {
				_setProjects((projects) => voidTimes(value(projects)));
			}
		},
		[_setProjects],
	);

	return [projects, setProjects] as const;
}

// TODO: Remove migration after a while
type OldProject = Project & {
	times?: Array<{
		projectSlug: string;
		activityName: string;
		startedAt: number;
		endedAt: number;
	}>;
};
function useMigrateOldLogs(projects: OldProject[]) {
	return useMemo(() => {
		const oldLogs = projects
			.flatMap((project) => {
				return (project.times ?? []).map((t) => ({
					...t,
					projectSlug: project.slug,
					activityName: t.activityName || project.name,
				}));
			})
			.sort((t1, t2) => t2.endedAt - t1.endedAt);

		return oldLogs.map((log) => ({
			projectSlug: log.projectSlug,
			activityName: log.activityName,
			interval: [log.startedAt, log.endedAt] as Interval,
		}));
	}, [projects]);
}
