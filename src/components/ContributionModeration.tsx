import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import {
  reportContribution,
  submitModerationAppeal,
  type ModerationCategory,
  type ModerationTargetType,
} from '../lib/moderation';
import { supabase } from '../lib/supabase';

type Props = {
  targetType: ModerationTargetType;
  targetId: string;
  creatorId: string;
  currentUserId: string | null;
  moderationStatus: string;
  onChanged?: () => void | Promise<void>;
};

const categoryLabels: Record<ModerationCategory, string> = {
  spam: 'Spam or misleading content',
  harassment: 'Harassment or bullying',
  hate_or_abuse: 'Hate or abusive content',
  violence_or_threats: 'Violence or threats',
  sexual_content: 'Sexual content',
  self_harm: 'Self-harm content',
  misinformation: 'Misinformation',
  impersonation: 'Impersonation',
  other: 'Something else',
};

export function ContributionModeration({
  targetType,
  targetId,
  creatorId,
  currentUserId,
  moderationStatus,
  onChanged,
}: Props) {
  const [reportOpen, setReportOpen] = useState(false);
  const [category, setCategory] = useState<ModerationCategory>('spam');
  const [details, setDetails] = useState('');
  const [appealReason, setAppealReason] = useState('');
  const [appealStatus, setAppealStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');

  const isOwner = Boolean(currentUserId && currentUserId === creatorId);

  useEffect(() => {
    let active = true;
    async function loadAppeal() {
      if (!supabase || !currentUserId || !isOwner || moderationStatus === 'visible') {
        setAppealStatus(null);
        return;
      }

      const { data, error } = await supabase
        .from('moderation_appeals')
        .select('status')
        .eq('user_id', currentUserId)
        .eq('target_type', targetType)
        .eq('target_id', targetId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!active) return;
      if (error) setNotice(error.message);
      else setAppealStatus(data?.status ?? null);
    }

    void loadAppeal();
    return () => { active = false; };
  }, [currentUserId, isOwner, moderationStatus, targetId, targetType]);

  async function handleReport(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setNotice('');
    try {
      await reportContribution({ targetType, targetId, category, details });
      setNotice('Report submitted. Thank you for helping keep CREOVA safe.');
      setDetails('');
      setReportOpen(false);
      await onChanged?.();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Could not submit this report.');
    } finally {
      setBusy(false);
    }
  }

  async function handleAppeal(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setNotice('');
    try {
      await submitModerationAppeal({ targetType, targetId, reason: appealReason });
      setAppealStatus('pending');
      setAppealReason('');
      setNotice('Your appeal has been submitted for review.');
      await onChanged?.();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Could not submit your appeal.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="moderation-tools">
      {currentUserId && !isOwner && (
        <button className="moderation-link" type="button" onClick={() => setReportOpen(value => !value)}>
          {reportOpen ? 'Close report' : 'Report contribution'}
        </button>
      )}

      {reportOpen && (
        <form className="moderation-form" onSubmit={handleReport}>
          <label>
            What is the concern?
            <select value={category} onChange={event => setCategory(event.target.value as ModerationCategory)}>
              {Object.entries(categoryLabels).map(([value, label]) => (
                <option value={value} key={value}>{label}</option>
              ))}
            </select>
          </label>
          <label>
            More detail (optional)
            <textarea
              value={details}
              onChange={event => setDetails(event.target.value)}
              rows={3}
              maxLength={1000}
              placeholder="Share enough context for a fair review."
            />
          </label>
          <button className="primary-cta" type="submit" disabled={busy}>
            {busy ? 'Submitting…' : 'Submit report'}
          </button>
        </form>
      )}

      {isOwner && moderationStatus !== 'visible' && (
        <div className="appeal-panel">
          <p className="moderation-status">
            This contribution is {moderationStatus === 'held' ? 'under review' : 'not visible to other users'}.
          </p>
          {appealStatus === 'pending' ? (
            <p className="muted">Your appeal is awaiting review.</p>
          ) : (
            <>
              {appealStatus === 'upheld' && <p className="muted">The previous appeal was upheld. You may submit a new appeal with additional context.</p>}
              <form className="moderation-form" onSubmit={handleAppeal}>
                <label>
                  Appeal this decision
                  <textarea
                    value={appealReason}
                    onChange={event => setAppealReason(event.target.value)}
                    rows={3}
                    minLength={10}
                    maxLength={2000}
                    required
                    placeholder="Explain why this contribution should be restored."
                  />
                </label>
                <button className="primary-cta" type="submit" disabled={busy || appealReason.trim().length < 10}>
                  {busy ? 'Submitting…' : 'Submit appeal'}
                </button>
              </form>
            </>
          )}
        </div>
      )}

      {notice && <p className="moderation-notice" role="status">{notice}</p>}
    </div>
  );
}
