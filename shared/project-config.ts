import { Schema } from "effect";
import { ProjectBrand } from "./brand";

export const ProjectConfig = Schema.Struct({
  brand: Schema.NullOr(ProjectBrand),
  name: Schema.NonEmptyString.check(Schema.isTrimmed()),
  projectId: Schema.NonEmptyString,
  revision: Schema.Int.check(Schema.isGreaterThanOrEqualTo(0)),
  schemaVersion: Schema.Literal(1),
});
export type ProjectConfig = typeof ProjectConfig.Type;

export const ProjectSettingsDraft = Schema.Struct({
  brand: Schema.NullOr(ProjectBrand),
  expectedRevision: Schema.Int.check(Schema.isGreaterThanOrEqualTo(0)),
  name: Schema.String,
  projectId: Schema.NonEmptyString,
});
export type ProjectSettingsDraft = typeof ProjectSettingsDraft.Type;

export const ProjectSettingsErrorCode = Schema.Literals([
  "cancelled",
  "revision-conflict",
  "identity-conflict",
  "invalid-config",
  "invalid-file",
  "missing-source",
  "busy",
  "invalid-destination",
  "move-recovery",
  "io",
]);
export class ProjectSettingsError extends Schema.TaggedErrorClass<ProjectSettingsError>()(
  "ProjectSettingsError",
  {
    cause: Schema.optionalKey(Schema.Unknown),
    code: ProjectSettingsErrorCode,
    message: Schema.String,
  }
) {}
