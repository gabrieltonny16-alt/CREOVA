import { supabase } from './supabase';

export type ModerationTargetType = 'anchor' | 'iteration';

export type ModerationCategory =
  | 'spam'
  | 'harassment'
  | 'hate_or_abuse'
  | 'violence_or_threats'
  | 'sexual_content'
  | 'self_harm'
  | 'misinformation'
  | 'impersonation'
  | 'other';

export type ModerationAction =
  | 'hold'
  | 'remove'
  | 'restore'
  | 'dismiss_report'
  | 'confirm_report'
  | 'overturn_appeal'
  | 'uphold_appeal';

function getClient() {
  if (!supabase) {
    throw new Error('CREOVA is not connected to Supabase yet.');
  }
  return supabase;
}

async function requireUserId(): Promise<string> {
  const client = getClient();
  const { data, error } = await client.auth.getUser();
  if (error) throw error;
  if (!data.user) throw new Error('Sign in to continue.');
  return data.user.id;
}

export async function reportContribution(input: {
  targetType: ModerationTargetType;
  targetId: string;
  category: ModerationCategory;
  details?: string;
}) {
  const client = getClient();
  const reporterId = await requireUserId();

  const { data, error } = await client
    .from('moderation_reports')
    .insert({
      reporter_id: reporterId,
      target_type: input.targetType,
      target_id: input.targetId,
      category: input.category,
      details: input.details?.trim() ?? '',
    })
    .select('id,status,created_at')
    .single();

  if (error?.code === '23505') {
    throw new Error('You already have an open report for this contribution.');
  }
  if (error) throw error;
  return data;
}

export async function submitModerationAppeal(input: {
  targetType: ModerationTargetType;
  targetId: string;
  reason: string;
}) {
  const client = getClient();
  const userId = await requireUserId();

  const { data, error } = await client
    .from('moderation_appeals')
    .insert({
      user_id: userId,
      target_type: input.targetType,
      target_id: input.targetId,
      reason: input.reason.trim(),
    })
    .select('id,status,created_at')
    .single();

  if (error?.code === '23505') {
    throw new Error('You already have an appeal awaiting review for this contribution.');
  }
  if (error) throw error;
  return data;
}

export async function reviewModeration(input: {
  targetType: ModerationTargetType;
  targetId: string;
  action: ModerationAction;
  reason?: string;
  appealId?: string;
  reportId?: string;
}) {
  const client = getClient();
  await requireUserId();

  const { data, error } = await client.rpc('review_moderation', {
    p_target_type: input.targetType,
    p_target_id: input.targetId,
    p_action: input.action,
    p_reason: input.reason?.trim() || null,
    p_appeal_id: input.appealId ?? null,
    p_report_id: input.reportId ?? null,
  });

  if (error) throw error;
  return data as {
    ok: true;
    action: ModerationAction;
    target_type: ModerationTargetType;
    target_id: string;
  };
}
