import type { ClientBrief } from "@/types/client";

function filled(value: unknown): boolean {
  if (typeof value === "string") return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  if (value && typeof value === "object") return Object.keys(value).length > 0;
  return Boolean(value);
}

function percent(done: number, total: number): number {
  if (total === 0) return 0;
  return Math.round((done / total) * 100);
}

export type BriefSectionKey =
  | "overview"
  | "goals"
  | "audience"
  | "identity"
  | "content"
  | "operations";

export function getBriefSectionCompletion(brief: ClientBrief | null): Record<BriefSectionKey, number> {
  if (!brief) {
    return { overview: 0, goals: 0, audience: 0, identity: 0, content: 0, operations: 0 };
  }

  const overviewFields = [brief.companyDescription, brief.website, brief.foundationYear];
  const goalsFields = [brief.primaryObjective, brief.secondaryObjectives, brief.kpis];
  const audienceFields = [brief.targetAge, brief.targetGender, brief.lifestyle, brief.interests, brief.geolocation, brief.painPoints];
  const identityFields = [brief.toneOfVoiceType, brief.toneOfVoiceNotes, brief.brandAdjectives, brief.brandDonts, brief.colorPalette, brief.fontTitles, brief.fontBody];
  const contentFields = [
    brief.activePlatforms,
    brief.platformFrequencies,
    brief.formatPreferences,
    brief.topicsToCover,
    brief.topicsToAvoid,
    brief.brandHashtags,
  ];
  const operationsFields = [brief.contactName, brief.contactEmail, brief.contactPhone, brief.approvalWindow, brief.internalNotes, brief.usefulLinks];

  const calc = (fields: unknown[]) => percent(fields.filter(filled).length, fields.length);

  return {
    overview: calc(overviewFields),
    goals: calc(goalsFields),
    audience: calc(audienceFields),
    identity: calc(identityFields),
    content: calc(contentFields),
    operations: calc(operationsFields),
  };
}

export function getBriefCompletion(brief: ClientBrief | null): number {
  const sections = getBriefSectionCompletion(brief);
  const values = Object.values(sections);
  return Math.round(values.reduce((sum, current) => sum + current, 0) / values.length);
}
