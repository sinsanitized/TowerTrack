export type SampleChoice = {
  id: string;
  date: string;
  context?: string | null;
  label: string;
};

export function buildSampleChoices(
  samples: Array<{
    id: string;
    date: string;
    notes?: string | null;
    externalProviderName?: string | null;
    externalSource?: string | null;
  }>,
): SampleChoice[] {
  const totals = new Map<string, number>();
  const positions = new Map<string, number>();
  for (const sample of samples)
    totals.set(sample.date, (totals.get(sample.date) ?? 0) + 1);

  return samples.map((sample) => {
    const position = (positions.get(sample.date) ?? 0) + 1;
    positions.set(sample.date, position);
    const context =
      sample.notes?.trim() ||
      sample.externalSource?.trim() ||
      sample.externalProviderName?.trim() ||
      null;
    const sameDayCount = totals.get(sample.date) ?? 1;
    const identifier =
      sameDayCount > 1 ? `Sample ${position} of ${sameDayCount}` : null;
    return {
      id: sample.id,
      date: sample.date,
      context,
      label: [identifier, context].filter(Boolean).join(" · "),
    };
  });
}
