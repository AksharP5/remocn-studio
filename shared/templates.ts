import { Schema } from "effect";

export const PROJECT_TEMPLATES = ["welcome-early-member"] as const;

export const ProjectTemplate = Schema.Literals(PROJECT_TEMPLATES);

export const BillingPeriod = Schema.Literals(["month", "year"]);

// Mirrors `welcomeEarlyMemberSchema` in the template's own `schema.ts`, which
// is zod and lives inside the Remotion project; a test decodes the same values
// through both so the two cannot drift.
export const WelcomeEarlyMemberProps = Schema.Struct({
  joinedAt: Schema.String,
  launchedAt: Schema.String,
  memberNumber: Schema.Int.check(Schema.isGreaterThan(0)),
  name: Schema.String,
  period: Schema.NullOr(BillingPeriod),
  purchasedAt: Schema.String,
});

export const TemplateProps = WelcomeEarlyMemberProps;

export const TemplateDraft = Schema.Struct({
  parent: Schema.optionalKey(Schema.NonEmptyString),
  props: TemplateProps,
  template: ProjectTemplate,
});

export type ProjectTemplate = (typeof ProjectTemplate)["Type"];
export type WelcomeEarlyMemberProps = (typeof WelcomeEarlyMemberProps)["Type"];
export type TemplateProps = (typeof TemplateProps)["Type"];
export type TemplateDraft = (typeof TemplateDraft)["Type"];

const NAMELESS = "Early member";

export function isProjectTemplate(value: string): value is ProjectTemplate {
  return (PROJECT_TEMPLATES as readonly string[]).includes(value);
}

export function templateProjectName(
  template: ProjectTemplate,
  props: TemplateProps
): string {
  switch (template) {
    case "welcome-early-member": {
      const name = props.name.trim();
      return `Welcome — ${name.length === 0 ? NAMELESS : name}`;
    }
    default:
      return template;
  }
}
