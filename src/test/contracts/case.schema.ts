import { z } from 'zod';

export const ApplicantSchema = z.object({
  name: z.string().min(1),
  reference: z.string().min(1),
  date_of_birth: z.string().nullable(),
});

export const TimelineEventSchema = z.object({
  date: z.string(),
  event: z.string().min(1),
  note: z.string(),
});

export const CaseSchema = z.object({
  case_id: z.string().regex(/^CASE-\d{4}-\d{5}$/),
  case_type: z.enum(['benefit_review', 'licence_application', 'compliance_check']),
  status: z.string().min(1),
  applicant: ApplicantSchema,
  assigned_to: z.string().min(1),
  created_date: z.string(),
  last_updated: z.string(),
  timeline: z.array(TimelineEventSchema),
  case_notes: z.string(),
});

export const PolicyExtractSchema = z.object({
  policy_id: z.string().min(1),
  title: z.string().min(1),
  applicable_case_types: z.array(z.string()).min(1),
  body: z.string().min(1),
});

export const EscalationThresholdsSchema = z.object({
  reminder_days: z.number().positive(),
  escalation_days: z.number().positive(),
});

export const WorkflowStateSchema = z.object({
  state: z.string().min(1),
  label: z.string().min(1),
  description: z.string(),
  allowed_transitions: z.array(z.string()),
  required_actions: z.array(z.string()),
  escalation_thresholds: EscalationThresholdsSchema.optional(),
});

export const WorkflowDataSchema = z.object({
  case_types: z.record(
    z.object({ states: z.array(WorkflowStateSchema).min(1) }),
  ),
});

export const PageRefSchema = z.object({
  page: z.string(),
  url_pattern: z.string(),
  purpose: z.string(),
});

export const ActionEntrySchema = z.object({
  action_id: z.string().min(1),
  label: z.string().min(1),
  triggered_at_state: z.string().min(1),
  policy_refs: z.array(z.string()),
  pages: z.array(PageRefSchema),
  urgency_trigger_days: z.number().optional(),
});

export const PageIndexEntrySchema = z.object({
  case_type: z.string().min(1),
  actions: z.array(ActionEntrySchema),
});
