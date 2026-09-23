import { CONFIG_PATH, type Parameters, serialize } from "./theme";

interface WritableFile {
  abort: () => Promise<void>;
  close: () => Promise<void>;
  write: (contents: string) => Promise<void>;
}

interface FileHandle {
  createWritable: () => Promise<WritableFile>;
  getFile: () => Promise<File>;
}

export interface ProjectDirectory {
  getDirectoryHandle: (name: string) => Promise<ProjectDirectory>;
  getFileHandle: (
    name: string,
    options?: { create: boolean }
  ) => Promise<FileHandle>;
  name: string;
}

type PickerWindow = Window & {
  showDirectoryPicker?: (options: {
    id: string;
    mode: "readwrite";
  }) => Promise<ProjectDirectory>;
};

export async function saveToProject(
  parameters: Parameters,
  previous: ProjectDirectory | null
): Promise<ProjectDirectory> {
  const browser = window as PickerWindow;
  if (!browser.showDirectoryPicker) {
    throw new Error(
      "Folder saving needs Chrome or Edge. Download JSON and place it at the path below instead."
    );
  }
  const directory =
    previous ??
    (await browser.showDirectoryPicker({
      id: "remocn-paper-ui",
      mode: "readwrite",
    }));
  const packageFile = await (
    await directory.getFileHandle("package.json")
  ).getFile();
  const manifest: unknown = JSON.parse(await packageFile.text());
  if (
    typeof manifest !== "object" ||
    manifest === null ||
    !("name" in manifest) ||
    manifest.name !== "remocn-studio"
  ) {
    throw new Error(
      "Select the remocn-studio project root, the folder containing package.json."
    );
  }
  let target = directory;
  for (const folder of CONFIG_PATH.split("/").slice(0, -1)) {
    // biome-ignore lint/performance/noAwaitInLoops: each handle is resolved from the previous one, so the walk is inherently sequential.
    target = await target.getDirectoryHandle(folder);
  }
  const file = await target.getFileHandle("paper-ui.config.json", {
    create: true,
  });
  const writer = await file.createWritable();
  try {
    await writer.write(serialize(parameters));
    await writer.close();
  } catch (error) {
    await writer.abort().catch(() => undefined);
    throw error;
  }
  return directory;
}

export function downloadTheme(parameters: Parameters) {
  const url = URL.createObjectURL(
    new Blob([serialize(parameters)], { type: "application/json" })
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = "paper-ui.config.json";
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
