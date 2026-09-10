import { Schema } from "effect";
import type { AuditSample } from "./readiness-analysis";
import { makeFinding } from "./readiness-analysis";
import type { ReadinessFrame } from "./readiness-browser";
import type { ReadinessFinding } from "./readiness-contract";

const Cue = Schema.Struct({
  end: Schema.Finite,
  exitStart: Schema.Finite,
  id: Schema.NonEmptyString,
  parent: Schema.optionalKey(Schema.NonEmptyString),
  readFor: Schema.optionalKey(Schema.Finite),
  settled: Schema.Finite,
  slot: Schema.optionalKey(Schema.NonEmptyString),
  start: Schema.Finite,
});
const Contract = Schema.Struct({
  cues: Schema.Array(Cue),
  duration: Schema.Finite,
  id: Schema.NonEmptyString,
  version: Schema.Literals([2]),
  window: Schema.Finite,
});
const decode = Schema.decodeUnknownSync(Contract);
type Contract = typeof Contract.Type;
type Cue = typeof Cue.Type;
interface Discovered {
  contract: Contract;
  offset: number;
  signature: string;
}
const EPSILON = 1e-7;

type FindingFactory = (
  cue: Cue,
  code: string,
  message: string,
  from?: number,
  to?: number
) => ReadinessFinding;
function targetMessage(id: string, count: number): string {
  if (count === 0) {
    return `${id} was removed before its promised exit completed.`;
  }
  if (count > 1) {
    return `${id} has ${count} rendered owners.`;
  }
  return `${id} is hidden during its promised reading interval.`;
}

function parseMarker(
  marker: NonNullable<ReadinessFrame["motionPlans"]>[number]
): Contract {
  if (marker.json.length > 262_144 || !Number.isInteger(marker.localFrame)) {
    throw new Error("Invalid or oversized runtime motion manifest");
  }
  const contract = decode(JSON.parse(marker.json));
  if (
    contract.cues.length > 2048 ||
    contract.cues.length === 0 ||
    contract.duration <= 0 ||
    contract.window <= 0
  ) {
    throw new Error(
      "A contract needs a positive duration, render window and 1–2048 cues"
    );
  }
  if (
    new Set(contract.cues.map((cue) => cue.id)).size !== contract.cues.length
  ) {
    throw new Error("Motion cue ids must be unique inside the contract");
  }
  if (
    contract.cues.some(
      (cue) =>
        cue.start < 0 ||
        cue.start > cue.settled ||
        cue.settled > cue.exitStart ||
        cue.exitStart > cue.end ||
        cue.end <= cue.start ||
        (cue.readFor ?? 0) < 0
    )
  ) {
    throw new Error(
      "Cue phases must be finite, ordered and have a non-negative reading budget"
    );
  }

  return contract;
}

function boundaryFrames(
  contract: Contract,
  offset: number,
  fps: number,
  duration: number
): number[] {
  const frames = new Set<number>();
  for (const cue of contract.cues) {
    for (const time of [
      cue.start,
      cue.settled,
      cue.exitStart,
      cue.end,
      (cue.start + cue.settled) / 2,
      (cue.settled + cue.exitStart) / 2,
      (cue.exitStart + cue.end) / 2,
    ]) {
      const center = Math.ceil((offset + time) * fps - EPSILON);
      for (const delta of [-1, 0, 1]) {
        const at = center + delta;
        if (at >= 0 && at < duration) {
          frames.add(at);
        }
      }
    }
  }
  return [...frames];
}

function cueFindings(
  contract: Contract,
  windowEnd: number,
  cues: Map<string, Cue>,
  finding: FindingFactory
): ReadinessFinding[] {
  const findings: ReadinessFinding[] = [];
  for (const cue of contract.cues) {
    if (cue.end > Math.min(windowEnd, contract.duration) + EPSILON) {
      findings.push(
        finding(
          cue,
          "motion_contract_truncated",
          `${cue.id} exits at ${cue.end.toFixed(3)}s, beyond its available sequence window.`
        )
      );
    }
    if (cue.parent) {
      const parent = cues.get(cue.parent);
      if (
        !parent ||
        cue.start < parent.start - EPSILON ||
        cue.end > parent.end + EPSILON
      ) {
        findings.push(
          finding(
            cue,
            "motion_contract_parent",
            `${cue.id} outlives or precedes its parent ${cue.parent}.`
          )
        );
      }
    }
    if ((cue.readFor ?? 0) > cue.exitStart - cue.settled + EPSILON) {
      findings.push({
        ...finding(
          cue,
          "motion_contract_reading",
          `${cue.id} has ${(cue.exitStart - cue.settled).toFixed(2)}s after settling for a ${cue.readFor?.toFixed(2)}s reading budget.`,
          cue.settled,
          cue.exitStart
        ),
        conclusion: "heuristic",
        fix: "Shorten or regroup the content, enlarge its presentation, or reallocate the timeline before speeding up reading.",
        severity: "warning",
      });
    }
  }

  return findings;
}

function observeCue(
  cue: Cue,
  samples: readonly AuditSample[],
  offset: number,
  fps: number,
  windowEnd: number,
  finding: FindingFactory
): ReadinessFinding[] {
  const findings: ReadinessFinding[] = [];
  for (const sample of samples) {
    const time = sample.frame / fps - offset;
    if (
      time < cue.settled - EPSILON ||
      time >= Math.min(cue.end, windowEnd) - EPSILON ||
      !sample.audit.details?.motionTargets
    ) {
      continue;
    }
    const matches = sample.audit.details.motionTargets.filter(
      (candidate) => candidate.id === cue.id
    );
    const hold = time < cue.exitStart - EPSILON;
    const [target] = matches;
    if (
      matches.length !== 1 ||
      (hold &&
        target &&
        (target.opacity < ((cue.readFor ?? 0) > 0 ? 0.8 : 0.001) ||
          target.bbox.width <= 0 ||
          target.bbox.height <= 0))
    ) {
      const row = finding(
        cue,
        matches.length > 1
          ? "motion_contract_ambiguous"
          : "motion_contract_target",
        targetMessage(cue.id, matches.length),
        time,
        time + 1 / fps
      );
      findings.push({
        ...row,
        bbox: target?.bbox ?? null,
        evidence: [sample.output],
        frames: [sample.frame],
        observed: `${matches.length} matching targets at frame ${sample.frame}`,
      });
    }
  }
  return findings;
}

function inspectContract(
  { contract, offset }: Discovered,
  samples: readonly AuditSample[],
  fps: number,
  duration: number
): ReadinessFinding[] {
  const findings: ReadinessFinding[] = [];
  const cues = new Map(contract.cues.map((cue) => [cue.id, cue]));
  const windowEnd = Math.min(contract.window, duration / fps - offset);
  const finding = (
    cue: Cue,
    code: string,
    message: string,
    from = cue.start,
    to = cue.end
  ) =>
    makeFinding({
      category: "motion_contract",
      code,
      conclusion: "measurement",
      expected:
        "The actual rendered target follows the declared event intervals.",
      fix: "Use the same beat for animation and review; derive the dependent event or parent lifetime from its completion.",
      from: Math.max(0, Math.floor((offset + from) * fps)),
      message,
      severity: "error",
      targetId: cue.id,
      to: Math.min(duration, Math.ceil((offset + to) * fps)),
    });
  findings.push(...cueFindings(contract, windowEnd, cues, finding));
  for (const cue of contract.cues) {
    findings.push(...observeCue(cue, samples, offset, fps, windowEnd, finding));
  }
  for (let i = 0; i < contract.cues.length; i += 1) {
    const left = contract.cues[i];
    if (!left.slot) {
      continue;
    }
    for (const right of contract.cues.slice(i + 1)) {
      const from = Math.max(left.start, right.start),
        to = Math.min(left.end, right.end);
      if (left.slot === right.slot && to - from > EPSILON) {
        findings.push(
          finding(
            right,
            "motion_contract_collision",
            `${left.id} and ${right.id} overlap in exclusive reading position ${left.slot}.`,
            from,
            to
          )
        );
      }
    }
  }
  return findings;
}

/** The wire contract is emitted by executable TSX; imported documentation is never evaluated. */
export class MotionContractReview {
  private readonly contracts = new Map<string, Discovered>();
  private readonly errors = new Map<string, string>();
  private readonly requested = new Set<number>();
  private readonly fps: number;
  private readonly duration: number;
  constructor(fps: number, duration: number) {
    this.fps = fps;
    this.duration = duration;
  }

  discover(
    frame: number,
    markers: NonNullable<ReadinessFrame["motionPlans"]>
  ): number[] {
    const added = new Set<number>();
    for (const marker of markers) {
      try {
        const contract = parseMarker(marker);
        const offset = (frame - marker.localFrame) / this.fps;
        const key = `${contract.id}@${offset}`;
        const signature = JSON.stringify(contract);
        const previous = this.contracts.get(key);
        if (previous && previous.signature !== signature) {
          throw new Error(
            `Motion contract ${contract.id} changes while seeking frames; derive one stable plan from the actual props`
          );
        }
        if (previous) {
          continue;
        }
        if (this.contracts.size >= 128) {
          throw new Error(
            "More than 128 motion contracts; split the review range"
          );
        }
        this.contracts.set(key, { contract, offset, signature });
        for (const at of boundaryFrames(
          contract,
          offset,
          this.fps,
          this.duration
        )) {
          if (!this.requested.has(at)) {
            added.add(at);
          }
        }
      } catch (error) {
        this.errors.set(String(error), `frame ${frame}: ${String(error)}`);
      }
    }
    for (const at of added) {
      this.requested.add(at);
    }
    return [...added].sort((a, b) => a - b);
  }

  summary(sampled: readonly number[]) {
    const seen = new Set(sampled);
    const intervals = [...this.contracts.values()]
      .map(({ contract, offset }) => ({
        from: Math.max(0, Math.ceil(offset * this.fps - EPSILON)),
        to: Math.min(
          this.duration,
          Math.ceil(
            (offset + Math.min(contract.duration, contract.window)) * this.fps -
              EPSILON
          )
        ),
      }))
      .sort((a, b) => a.from - b.from);
    const uncovered: { from: number; to: number }[] = [];
    let until = 0;
    for (const interval of intervals) {
      if (interval.from > until) {
        uncovered.push({ from: until, to: interval.from });
      }
      until = Math.max(until, interval.to);
    }
    if (until < this.duration) {
      uncovered.push({ from: until, to: this.duration });
    }
    return {
      boundaries: [...this.requested].sort((a, b) => a - b),
      contracts: this.contracts.size,
      cues: [...this.contracts.values()].reduce(
        (sum, value) => sum + value.contract.cues.length,
        0
      ),
      invalid: [...this.errors.values()],
      uncovered,
      unvisited: [...this.requested]
        .filter((frame) => !seen.has(frame))
        .sort((a, b) => a - b),
    };
  }

  findings(samples: readonly AuditSample[]): ReadinessFinding[] {
    const findings: ReadinessFinding[] = [...this.errors.values()].map(
      (message) =>
        makeFinding({
          category: "motion_contract",
          code: "motion_contract_invalid",
          conclusion: "measurement",
          fix: "Repair the runtime contract and rerun the affected range.",
          from: 0,
          message,
          severity: "error",
          to: 1,
        })
    );
    for (const contract of this.contracts.values()) {
      findings.push(
        ...inspectContract(contract, samples, this.fps, this.duration)
      );
    }

    return findings;
  }
}
