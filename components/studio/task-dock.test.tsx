import { describe, expect, it, mock } from "bun:test";
import { fireEvent, render, screen } from "@testing-library/react";
import { TaskDock } from "@/components/studio/task-dock";
import type { StudioSettings } from "@/lib/studio/settings";
import type { TaskRow } from "@/lib/studio/tasks";
import type { PipelineStage } from "@/shared/pipeline";

const SETTINGS: StudioSettings = {
  assetOffers: null,
  canvasRulers: null,
  claudeEffort: null,
  claudeModel: null,
  codexModel: null,
  collapsedPropGroups: [],
  copilotModel: null,
  crashReports: null,
  expandedVideos: [],
  grokModel: null,
  legacyProjectFolder: null,
  notifications: null,
  notifyEvents: { export: null, sidecar: null, turnEnded: null, waiting: null },
  onboarding: { chapter: "inspect", dismissed: false },
  paneView: null,
  previewPane: null,
  projectsPane: null,
  taskDock: null,
  titlebarMotion: null,
  titlebarShader: null,
};

const ANALYSIS_ROW = /Analysis/;
const SCRIPT_ROW = /Script/;

const PLAN: readonly TaskRow[] = [
  {
    activeForm: "Building the scene",
    description: "Write the component",
    id: "1",
    status: "completed",
    subject: "Scene component",
  },
  {
    activeForm: "Registering the scene",
    description: null,
    id: "2",
    status: "in_progress",
    subject: "Register in Series",
  },
  {
    activeForm: null,
    description: null,
    id: "3",
    status: "pending",
    subject: "Check the build",
  },
];

const TRIGGER = /^Plan, /;
const VIDEO_TRIGGER = /^Video, /;
const SWEEP = ".dmx-diagonal-alt-sweep";

describe("TaskDock", () => {
  it("collapses to the task in hand and how far the plan has got", () => {
    render(<TaskDock settings={SETTINGS} stages={[]} tasks={PLAN} working />);

    expect(screen.getByText("Registering the scene")).toBeVisible();
    expect(screen.getByText("1/3")).toBeVisible();
    expect(screen.queryByText("Check the build")).not.toBeInTheDocument();
  });

  it("shows the running task's status as its own icon", () => {
    render(<TaskDock settings={SETTINGS} stages={[]} tasks={PLAN} working />);

    expect(screen.getAllByLabelText("In progress")).not.toHaveLength(0);
  });

  it("says all done, with its own icon, once every task is completed", () => {
    const done = PLAN.map((task) => ({
      ...task,
      status: "completed" as const,
    }));
    render(<TaskDock settings={SETTINGS} stages={[]} tasks={done} working />);

    expect(screen.getByText("All done")).toBeVisible();
    expect(screen.getByLabelText("All done")).toBeVisible();
    expect(screen.getByText("3/3")).toBeVisible();
  });

  it("says Plan when no task is running", () => {
    const pending = PLAN.map((task) => ({
      ...task,
      status: "pending" as const,
    }));
    render(
      <TaskDock settings={SETTINGS} stages={[]} tasks={pending} working />
    );

    expect(screen.getByText("Plan")).toBeVisible();
    expect(screen.getByLabelText("Pending")).toBeVisible();
    expect(screen.getByText("0/3")).toBeVisible();
  });

  it("opens into the whole list, and closes again", () => {
    render(<TaskDock settings={SETTINGS} stages={[]} tasks={PLAN} working />);
    const trigger = screen.getByRole("button", { name: TRIGGER });

    fireEvent.click(trigger);

    expect(screen.getByText("Check the build")).toBeVisible();
    expect(trigger).toHaveAttribute("aria-expanded", "true");

    fireEvent.click(trigger);

    expect(screen.queryByText("Check the build")).not.toBeInTheDocument();
  });

  it("comes back open when it was left open last time", () => {
    render(
      <TaskDock
        settings={{ ...SETTINGS, taskDock: true }}
        stages={[]}
        tasks={PLAN}
        working
      />
    );

    expect(screen.getByText("Check the build")).toBeVisible();
  });

  it("stops animating a task a stopped turn left in progress", () => {
    const { container } = render(
      <TaskDock
        settings={{ ...SETTINGS, taskDock: true }}
        stages={[]}
        tasks={PLAN}
        working={false}
      />
    );

    expect(screen.getByRole("button", { name: TRIGGER })).toHaveTextContent(
      "Plan"
    );
    expect(container.querySelector(SWEEP)).toBeNull();
  });

  it("draws nothing at all when the turn wrote no plan", () => {
    render(<TaskDock settings={SETTINGS} stages={[]} tasks={[]} working />);

    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});

const STAGES: readonly PipelineStage[] = [
  { stage: "analysis", status: "done" },
  { stage: "brand", status: "done" },
  { stage: "script", status: "active" },
  { stage: "motion", status: "pending" },
  { stage: "build", status: "pending" },
  { stage: "review", status: "pending" },
];

describe("TaskDock with a pipeline", () => {
  it("stays on screen with no plan at all while the pipeline is unfinished", () => {
    render(<TaskDock settings={SETTINGS} stages={STAGES} tasks={[]} working />);

    expect(screen.getByText("Writing the script")).toBeVisible();
    expect(screen.getByText("2/6")).toBeVisible();
  });

  it("collapses to the running sub-task when the turn has one", () => {
    render(
      <TaskDock settings={SETTINGS} stages={STAGES} tasks={PLAN} working />
    );

    expect(screen.getByText("Registering the scene")).toBeVisible();
    expect(screen.getByText("2/6")).toBeVisible();
  });

  it("opens into every stage, with the sub-tasks under the active one", () => {
    render(
      <TaskDock
        settings={{ ...SETTINGS, taskDock: true }}
        stages={STAGES}
        tasks={PLAN}
        working
      />
    );

    expect(screen.getByText("Analysis")).toBeVisible();
    expect(screen.getByText("Review")).toBeVisible();
    expect(screen.getByText("Check the build")).toBeVisible();
  });

  // The dock is the only place most people will meet the Docs pane: a stage
  // whose document is on disk is a way in, and one that has written nothing
  // stays a line rather than becoming a dead button.
  it("turns a stage whose document exists into a way into it", () => {
    const opened: string[] = [];
    // React nulls `currentTarget` once the handler returns, so the value the
    // row carries has to be read while the event is still live.
    const onOpenDocument = mock(
      (event: React.MouseEvent<HTMLButtonElement>) => {
        opened.push(event.currentTarget.value);
      }
    );
    const path = "/project/src/videos/intro/docs/script.md";

    render(
      <TaskDock
        documents={new Map([["script", path]])}
        onOpenDocument={onOpenDocument}
        settings={{ ...SETTINGS, taskDock: true }}
        stages={STAGES}
        tasks={[]}
        working
      />
    );

    expect(
      screen.queryByRole("button", { name: ANALYSIS_ROW })
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: SCRIPT_ROW }));

    expect(opened).toEqual([path]);
  });

  it("rests on the active stage between turns instead of animating it", () => {
    const { container } = render(
      <TaskDock
        settings={{ ...SETTINGS, taskDock: true }}
        stages={STAGES}
        tasks={PLAN}
        working={false}
      />
    );

    expect(
      screen.getByRole("button", { name: VIDEO_TRIGGER })
    ).toHaveTextContent("Script");
    expect(screen.queryByText("Writing the script")).not.toBeInTheDocument();
    expect(screen.queryByText("Registering the scene")).not.toBeInTheDocument();
    expect(screen.getAllByLabelText("In progress")).not.toHaveLength(0);
    expect(container.querySelector(SWEEP)).toBeNull();
  });

  it("animates the active stage while a turn works on it", () => {
    const { container } = render(
      <TaskDock
        settings={{ ...SETTINGS, taskDock: true }}
        stages={STAGES}
        tasks={[]}
        working
      />
    );

    expect(container.querySelector(SWEEP)).not.toBeNull();
  });

  it("hands the dock back to the plan once every stage is done", () => {
    const finished = STAGES.map((row) => ({
      ...row,
      status: "done" as const,
    }));
    render(
      <TaskDock settings={SETTINGS} stages={finished} tasks={[]} working />
    );

    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
