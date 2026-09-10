// biome-ignore-all lint/performance/noAwaitInLoops: stable file-order hashing keeps evaluation input identity reproducible.
import { createHash } from "node:crypto";
import { cp, mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { Effect } from "effect";
import { z } from "zod";
import { TEMPLATE_DIR_ENV } from "../shared/ipc";
import { ensureRegistry } from "../sidecar/scaffold/registry";
import { expandTemplate, expandVideo } from "../sidecar/scaffold/template";

const EXPERIMENT_LABEL = /^[a-z0-9-]+$/;
const studio = path.resolve(import.meta.dir, "..");
const Case = z.object({
  height: z.number().int().positive(),
  id: z.string(),
  prompt: z.string(),
  requiresAssets: z.boolean(),
  width: z.number().int().positive(),
});
const Corpus = z.object({ cases: z.array(Case), version: z.number() });
const Record = z.object({
  exportPath: z.string().nullable(),
  firstPassUsable: z.boolean().nullable(),
  generationSeconds: z.number().nonnegative().nullable(),
  model: z.string().min(1),
  notes: z.string(),
  remainingMeasuredErrors: z.number().int().nonnegative().nullable(),
  reportId: z.string().nullable(),
  tokens: z.number().int().nonnegative().nullable(),
  userCorrections: z.number().int().nonnegative().nullable(),
});
const Run = z.object({
  assetsHash: z.string(),
  briefHash: z.string(),
  caseId: z.string(),
  createdAt: z.string(),
  label: z.string(),
  sourceHash: z.string(),
});
const corpus = Corpus.parse(
  JSON.parse(
    await readFile(path.join(studio, "evals/generation/cases.json"), "utf8")
  )
);
const hash = (value: string | Buffer) =>
  createHash("sha256").update(value).digest("hex");

async function hashTree(folder: string): Promise<string> {
  const digest = createHash("sha256");
  const walk = async (directory: string): Promise<void> => {
    const entries = (await readdir(directory, { withFileTypes: true })).sort(
      (a, b) => a.name.localeCompare(b.name)
    );
    for (const entry of entries) {
      const location = path.join(directory, entry.name);
      digest.update(path.relative(folder, location));
      if (entry.isDirectory()) {
        await walk(location);
      } else if (entry.isFile()) {
        digest.update(await readFile(location));
      } else {
        throw new Error(`Evaluation assets must be regular files: ${location}`);
      }
    }
  };
  await walk(folder);
  return digest.digest("hex");
}

async function prepare(
  id: string | undefined,
  label: string | undefined,
  assetPath: string | undefined
) {
  const item = corpus.cases.find((candidate) => candidate.id === id);
  if (!(item && label && EXPERIMENT_LABEL.test(label))) {
    throw new Error(
      "prepare needs a case id and an experiment label using lowercase letters, numbers and hyphens"
    );
  }
  if (item.requiresAssets && !assetPath) {
    throw new Error(
      "The agency case needs the same local brand asset folder in each experiment: pass it as the fourth argument"
    );
  }
  const output = path.join(
    studio,
    "out/generation-eval",
    `${new Date().toISOString().replaceAll(/[:.]/g, "-")}-${label}-${item.id}`
  );
  const project = path.join(output, "project");
  process.env[TEMPLATE_DIR_ENV] = path.join(studio, "templates/remotion");
  await Effect.runPromise(expandTemplate(project));
  await Effect.runPromise(ensureRegistry(project));
  await Effect.runPromise(
    expandVideo(project, {
      name: item.id,
      size: { height: item.height, width: item.width },
      slug: item.id,
    })
  );
  const assets = path.join(project, "public/evaluation");
  await mkdir(assets, { recursive: true });
  await cp(
    assetPath
      ? path.resolve(assetPath)
      : path.join(studio, "templates/motion-proof/public"),
    assets,
    { dereference: false, recursive: true }
  );
  const sourceHash = hash(
    (
      await Promise.all(
        [
          "sidecar/claude/conventions.ts",
          "shared/pipeline.ts",
          "sidecar/tools/specs.ts",
          "sidecar/tools/review.ts",
          "sidecar/preview/motion-contract.ts",
          "sidecar/preview/readiness.ts",
          "sidecar/preview/readiness-browser.ts",
          "sidecar/preview/readiness-analysis.ts",
          "sidecar/preview/design.ts",
        ].map((location) => readFile(path.join(studio, location), "utf8"))
      )
    ).join("\n") +
      (await hashTree(path.join(studio, "agent/skills/motion-design"))) +
      (await hashTree(path.join(studio, "agent/skills/video-lessons"))) +
      (await hashTree(
        path.join(studio, "templates/remotion/src/lib/studio-motion-v2")
      ))
  );
  const run = {
    assetsHash: await hashTree(assets),
    briefHash: hash(JSON.stringify({ corpusVersion: corpus.version, ...item })),
    caseId: item.id,
    createdAt: new Date().toISOString(),
    label,
    sourceHash,
  };
  await writeFile(path.join(output, "run.json"), JSON.stringify(run, null, 2));
  await writeFile(path.join(output, "prompt.txt"), `${item.prompt}\n`);
  await writeFile(
    path.join(output, "result.json"),
    JSON.stringify(
      {
        exportPath: null,
        firstPassUsable: null,
        generationSeconds: null,
        model: "",
        notes: "",
        remainingMeasuredErrors: null,
        reportId: null,
        tokens: null,
        userCorrections: null,
      },
      null,
      2
    )
  );
  console.log(
    `Open ${project} in Studio and submit ${path.join(output, "prompt.txt")}. Record observed results in ${path.join(output, "result.json")}.`
  );
}

async function compare(left: string | undefined, right: string | undefined) {
  if (!(left && right)) {
    throw new Error("compare needs two prepared run folders");
  }
  const rows = await Promise.all(
    [left, right].map(async (folder) => ({
      result: Record.parse(
        JSON.parse(await readFile(path.join(folder, "result.json"), "utf8"))
      ),
      run: Run.parse(
        JSON.parse(await readFile(path.join(folder, "run.json"), "utf8"))
      ),
    }))
  );
  const [a, b] = rows;
  if (
    a.run.caseId !== b.run.caseId ||
    a.run.briefHash !== b.run.briefHash ||
    a.run.assetsHash !== b.run.assetsHash
  ) {
    throw new Error(
      "These runs do not have identical briefs and assets; do not compare them as the same task"
    );
  }
  console.log(
    JSON.stringify(
      {
        caseId: a.run.caseId,
        experiments: rows,
        note: "Null means unmeasured, not zero. Compare video preference blind and record the judgment in notes. Passing mechanical checks does not establish visual quality.",
        sameModel: a.result.model === b.result.model,
      },
      null,
      2
    )
  );
}

const [command, first, second, assets] = process.argv.slice(2);
if (command === "prepare") {
  await prepare(first, second, assets);
} else if (command === "compare") {
  await compare(first, second);
} else if (command === "list") {
  console.log(
    corpus.cases.map((item) => `${item.id}: ${item.prompt}`).join("\n\n")
  );
} else {
  throw new Error(
    "Use generation:eval list | prepare <case> <label> [asset-folder] | compare <run-a> <run-b>"
  );
}
