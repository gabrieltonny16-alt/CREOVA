import { useEffect, useState } from 'react';
import {
  isCurrentUserModerator,
  reviewModeration,
  type ModerationTargetType,
} from '../lib/moderation';
import { supabase } from '../lib/supabase';

type ReportRow = {
  id: string;
  target_type: ModerationTargetType;
  target_id: string;
  category: string;
  details: string;
  status: string;
  created_at: string;
};

type AppealRow = {
  id: string;
  target_type: ModerationTargetType;
  target_id: string;
  reason: string;
  created_at: string;
};

type Props = {
  onChanged?: () => void | Promise<void>;
};

export function ModerationQueue({ onChanged }: Props) {
  const [isModerator, setIsModerator] = useState(false);
  const [checking, setChecking] = useState(true);
  const [reports, setReports] = useState<ReportRow[]>([]);
  const [appeals, setAppeals] = useState<AppealRow[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notice, setNotice] = useState('');

  async function reloadQueue() {
    if (!supabase) return;
    const [reportResult, appealResult] = await Promise.all([
      supabase
        .from('moderation_reports')
        .select('id,target_type,target_id,category,details,status,created_at')
        .in('status', ['open', 'in_review'])
        .order('created_at', { ascending: true }),
      supabase
        .from('moderation_appeals')
        .select('id,target_type,target_id,reason,created_at')
        .eq('status', 'pending')
        .order('created_at', { ascending: true }),
    ]);

    if (reportResult.error) throw reportResult.error;
    if (appealResult.error) throw appealResult.error;
    setReports((reportResult.data ?? []) as ReportRow[]);
    setAppeals((appealResult.data ?? []) as AppealRow[]);
  }

  useEffect(() => {
    let active = true;
    async function initialize() {
      try {
        const allowed = await isCurrentUserModerator();
        if (!active) return;
        setIsModerator(allowed);
        if (allowed) await reloadQueue();
      } catch (error) {
        if (active) setNotice(error instanceof Error ? error.message : 'Could not load moderation access.');
      } finally {
        if (active) setChecking(false);
      }
    }
    void initialize();
    return () => { active = false; };
  }, []);

  async function actOnReport(report: ReportRow, action: 'dismiss_report' | 'confirm_report') {
    setBusyId(report.id);
    setNotice('');
    try {
      await reviewModeration({
        targetType: report.target_type,
        targetId: report.target_id,
        action,
        reportId: report.id,
        reason: action === 'confirm_report' ? 'Report confirmed by staff' : 'Report dismissed after review',
      });
      await reloadQueue();
      await onChanged?.();
      setNotice(action === 'confirm_report' ? 'Report confirmed and contribution removed.' : 'Report dismissed.');
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'The moderation action failed.');
    } finally {
      setBusyId(null);
    }
  }

  async function actOnAppeal(appeal: AppealRow, action: 'overturn_appeal' | 'uphold_appeal') {
    setBusyId(appeal.id);
    setNotice('');
    try {
      await reviewModeration({
        targetType: appeal.target_type,
        targetId: appeal.target_id,
        action,
        appealId: appeal.id,
        reason: action === 'overturn_appeal' ? 'Appeal accepted after staff review' : 'Appeal upheld after staff review',
      });
      await reloadQueue();
      await onChanged?.();
      setNotice(action === 'overturn_appeal' ? 'Appeal accepted. Contribution restored.' : 'Appeal upheld.');
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'The appeal decision failed.');
    } finally {
      setBusyId(null);
    }
  }

  if (checking || !isModerator) return null;

  return (
    <section className="moderation-queue">
      <div className="section-kicker">STAFF WORKSPACE</div>
      <div className="moderation-queue-heading">
        <h2>Moderation <em>desk.</em></h2>
        <button className="moderation-link" type="button" onClick={() => void reloadQueue()}>
          Refresh queue
        </button>
      </div>

      <div className="moderation-queue-columns">
        <div>
          <h3>Open reports <span>{reports.length}</span></h3>
          {reports.length === 0 ? <p className="muted">No reports waiting for review.</p> : reports.map(report => (
            <article className="moderation-item" key={report.id}>
              <div className="moderation-item-meta">
                <span>{report.target_type} · {report.category.replaceAll('_', ' ')}</span>
                <time>{new Date(report.created_at).toLocaleString()}</time>
              </div>
              <p className="moderation-target">Target {report.target_id.slice(0, 8)}…</p>
              {report.details && <p className="muted">{report.details}</p>}
              <div className="moderation-actions">
                <button type="button" className="moderation-link" disabled={busyId === report.id} onClick={() => void actOnReport(report, 'dismiss_report')}>Dismiss</button>
                <button type="button" className="moderation-danger" disabled={busyId === report.id} onClick={() => void actOnReport(report, 'confirm_report')}>Confirm and remove</button>
              </div>
            </article>
          ))}
        </div>

        <div>
          <h3>Pending appeals <span>{appeals.length}</span></h3>
          {appeals.length === 0 ? <p className="muted">No appeals waiting for review.</p> : appeals.map(appeal => (
            <article className="moderation-item" key={appeal.id}>
              <div className="moderation-item-meta">
                <span>{appeal.target_type} appeal</span>
                <time>{new Date(appeal.created_at).toLocaleString()}</time>
              </div>
              <p className="moderation-target">Target {appeal.target_id.slice(0, 8)}…</p>
              <p className="muted">{appeal.reason}</p>
              <div className="moderation-actions">
                <button type="button" className="moderation-link" disabled={busyId === appeal.id} onClick={() => void actOnAppeal(appeal, 'uphold_appeal')}>Uphold</button>
                <button type="button" className="moderation-primary" disabled={busyId === appeal.id} onClick={() => void actOnAppeal(appeal, 'overturn_appeal')}>Overturn and restore</button>
              </div>
            </article>
          ))}
        </div>
      </div>

      {notice && <p className="moderation-notice" role="status">{notice}</p>}
    </section>
  );
}
