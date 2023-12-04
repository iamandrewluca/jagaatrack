import { useLocalStorage } from "@uidotdev/usehooks";
import { PropsWithChildren, useMemo } from "react";
import { Log, Project, StartedProject } from "./types";
import {
	askForActivityName,
	groupBy,
	isStartedProject,
	storageKey,
	useEffectEvent,
	useWithClick,
} from "./utils";
import { DataContext } from "./data-context";

export function DataProvider({ children }: PropsWithChildren) {
	const [shouldAskForActivityName, setShouldAskForActivityName] =
		useLocalStorage(storageKey("should-ask-for-activity-name"), false);
	const [logs, setLogs] = useLocalStorage<ReadonlyArray<Log>>(
		storageKey("logs"),
		[],
	);
	const [projects, setProjects] = useLocalStorage<ReadonlyArray<Project>>(
		storageKey("projects"),
		[],
	);

	const activeProjects = useMemo(
		() => projects.filter(isStartedProject),
		[projects],
	);

	const logsByProject = useMemo(() => groupBy(logs, "projectSlug"), [logs]);

	const getProjectLogs = useEffectEvent(
		(project: Project) => logsByProject[project.slug] ?? [],
	);

	function createNewLogs() {
		return activeProjects.map<Log>((project) => ({
			projectSlug: project.slug,
			interval: [project.startedAt, Date.now()],
			activityName: shouldAskForActivityName
				? project.lastActivityName ?? project.name
				: project.name,
		}));
	}

	const startProject = useEffectEvent((project: Project) => {
		setLogs([...createNewLogs(), ...logs]);

		const startedAt = Date.now();
		const activityName = shouldAskForActivityName
			? askForActivityName(project.lastActivityName)
			: undefined;

		const startedProject: StartedProject = {
			...project,
			startedAt,
			lastActivityName: activityName || project.name,
		};

		const newProjects = projects.map<Project>((p) =>
			p.slug === project.slug ? startedProject : { ...p, startedAt: undefined },
		);

		setProjects(newProjects);
	});

	const stopProject = useEffectEvent((project: StartedProject) => {
		setLogs([...createNewLogs(), ...logs]);

		const stoppedProject: Project = {
			...project,
			startedAt: undefined,
			lastActivityName: shouldAskForActivityName
				? project.lastActivityName
				: undefined,
		};

		const newProjects = projects.map((p) =>
			p.slug === project.slug ? stoppedProject : p,
		);

		setProjects(newProjects);
	});

	const toggleActiveProject = useWithClick((project: Project) => {
		isStartedProject(project) ? stopProject(project) : startProject(project);
	});

	const addProject = useEffectEvent((project: Project) => {
		setProjects([project, ...projects]);
	});

	const removeAllProjectsAndLogs = useEffectEvent(() => {
		setProjects([]);
		setLogs([]);
	});

	const removeAllLogs = useEffectEvent(() => {
		const newProjects = projects.map<Project>((e) => ({
			...e,
			startedAt: undefined,
		}));

		setProjects(newProjects);
		setLogs([]);
	});

	const addProjects = useEffectEvent((newProjects: ReadonlyArray<Project>) => {
		const filteredProjects = newProjects.filter(
			(p) => !projects.some((e) => e.slug === p.slug),
		);

		setProjects([...projects, ...filteredProjects]);
	});

	const resetProject = useEffectEvent((project: Project) => {
		const newProjects = projects.map((p) => {
			if (p.slug === project.slug) {
				return { ...p, startedAt: undefined } satisfies Project;
			}

			return p;
		});

		const newLogs = logs.filter((l) => l.projectSlug !== project.slug);

		setProjects(newProjects);
		setLogs(newLogs);
	});

	const removeProject = useEffectEvent((project: Project) => {
		const newProjects = projects.filter((e) => e.slug !== project.slug);
		const newLogs = logs.filter((l) => l.projectSlug !== project.slug);
		setProjects(newProjects);
		setLogs(newLogs);
	});

	const updateProject = useEffectEvent((project: Project) => {
		setProjects(projects.map((p) => (p.slug === project.slug ? project : p)));
	});

	const sortProjects = useEffectEvent((slugs: ReadonlyArray<string>) => {
		const newProjects = slugs
			.map((slug) => projects.find((p) => p.slug === slug))
			.filter(Boolean);

		setProjects(newProjects);
	});

	return (
		<DataContext.Provider
			value={{
				projects,
				logs,
				activeProjects,
				shouldAskForActivityName,
				setProjects,
				setLogs,
				getProjectLogs,
				setShouldAskForActivityName,
				toggleActiveProject,
				addProject,
				removeAllProjectsAndLogs,
				removeAllLogs,
				addProjects,
				resetProject,
				removeProject,
				updateProject,
				sortProjects,
			}}
		>
			{children}
		</DataContext.Provider>
	);
}
