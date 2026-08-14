import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthProvider.jsx';
import { apiGetMyPerformance } from '../../api/workforceService.js';
import { AppShell } from '../../components/common/AppShell.jsx';
import { MetricStrip } from '../../components/enterprise/MetricStrip.jsx';
import { StatusBadge } from '../../components/enterprise/StatusBadge.jsx';
import { LoadingState } from '../../components/enterprise/LoadingState.jsx';
import { ErrorState } from '../../components/enterprise/ErrorState.jsx';
import {
  Award,
  Star,
  CheckCircle2,
  ThumbsUp,
  Percent,
  MessageSquare,
  TrendingUp,
  Calendar,
  User,
  Clock,
  Sparkles,
} from 'lucide-react';

export function EmployeePerformancePage() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  const loadPerformance = async () => {
    try {
      setIsLoading(true);
      setError('');
      const res = await apiGetMyPerformance();
      setData(res);
    } catch (err) {
      setError(err.message || 'Failed to load performance metrics from server.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadPerformance();
  }, []);

  if (isLoading) {
    return (
      <AppShell breadcrumbs={[{ label: 'Home' }, { label: 'Feedback & Performance' }]}>
        <LoadingState message="Calculating authoritative performance & ratings..." />
      </AppShell>
    );
  }

  const metrics = data?.metrics || {
    jobs_completed: 0,
    total_jobs_assigned: 0,
    completion_rate: 0,
    average_rating: 0,
    csat_score: 0,
    feedback_submissions_count: 0,
    issue_resolution_rate: 0,
  };

  const distribution = data?.rating_distribution || { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
  const feedbacks = data?.feedbacks || [];
  const totalFeedbackCount = metrics.feedback_submissions_count || 0;

  const metricCards = [
    {
      title: 'Jobs Completed',
      value: metrics.jobs_completed,
      icon: CheckCircle2,
      color: 'blue',
      change: `${metrics.total_jobs_assigned} assigned total`,
    },
    {
      title: 'Average Rating',
      value: metrics.average_rating > 0 ? `${metrics.average_rating} / 5.0` : '—',
      icon: Star,
      color: 'amber',
      change: `${totalFeedbackCount} ratings recorded`,
    },
    {
      title: 'CSAT Score',
      value: metrics.csat_score > 0 ? `${metrics.csat_score}%` : '—',
      icon: ThumbsUp,
      color: 'emerald',
      change: '4★ & 5★ satisfaction share',
    },
    {
      title: 'Completion Rate',
      value: `${metrics.completion_rate}%`,
      icon: Percent,
      color: 'indigo',
      change: 'Fulfilled vs. assigned',
    },
    {
      title: 'On-Time Resolution',
      value: `${metrics.issue_resolution_rate}%`,
      icon: TrendingUp,
      color: 'emerald',
      change: 'Without revisit or delay',
    },
  ];

  return (
    <AppShell breadcrumbs={[{ label: 'Home' }, { label: 'Feedback & Performance' }]}>
      <div className="space-y-4 max-w-6xl mx-auto">
        {error && <ErrorState message={error} onDismiss={() => setError('')} />}

        {/* Top Metric Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {metricCards.map((m, idx) => {
            const Icon = m.icon;
            return (
              <div key={idx} className="bg-white border border-slate-200 rounded p-3.5 shadow-sm space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">{m.title}</span>
                  <div className="p-1 rounded bg-slate-50 border border-slate-100 text-slate-600">
                    <Icon className="w-3.5 h-3.5" />
                  </div>
                </div>
                <div className="text-xl font-bold text-slate-900 font-mono">{m.value}</div>
                <p className="text-[10px] text-slate-500 truncate">{m.change}</p>
              </div>
            );
          })}
        </div>

        {/* Rating Breakdown & CSAT Overview */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* Left Column: Star Rating Distribution (5 cols) */}
          <div className="lg:col-span-5 bg-white border border-slate-200 rounded overflow-hidden shadow-sm flex flex-col">
            <div className="bg-slate-50 px-4 py-3 border-b border-slate-200 flex items-center justify-between">
              <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
                Rating Distribution ({totalFeedbackCount} Reviews)
              </h2>
            </div>

            <div className="p-5 space-y-4 text-xs flex-1 flex flex-col justify-center">
              {totalFeedbackCount > 0 ? (
                <div className="space-y-2.5">
                  {[5, 4, 3, 2, 1].map((stars) => {
                    const count = distribution[stars] || 0;
                    const pct = totalFeedbackCount > 0 ? Math.round((count / totalFeedbackCount) * 100) : 0;
                    return (
                      <div key={stars} className="flex items-center gap-3">
                        <span className="w-12 font-bold text-slate-700 font-mono text-[11px] flex items-center gap-1">
                          <span>{stars}</span>
                          <Star className="w-3 h-3 text-amber-500 fill-amber-500" />
                        </span>
                        <div className="flex-1 h-3 bg-slate-100 rounded-full overflow-hidden border border-slate-200">
                          <div
                            className="h-full bg-amber-400 rounded-full transition-all"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className="w-12 text-right text-slate-500 font-mono text-[11px]">
                          {count} ({pct}%)
                        </span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-6 space-y-2">
                  <div className="w-10 h-10 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center mx-auto text-slate-400">
                    <Star className="w-5 h-5" />
                  </div>
                  <h3 className="font-bold text-slate-800 text-xs">No customer ratings yet</h3>
                  <p className="text-[11px] text-slate-500 max-w-xs mx-auto">
                    Ratings will be calculated automatically when customers review your completed service requests.
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Right Column: Performance Guidelines & Quality Standards (7 cols) */}
          <div className="lg:col-span-7 bg-white border border-slate-200 rounded overflow-hidden shadow-sm flex flex-col">
            <div className="bg-slate-50 px-4 py-3 border-b border-slate-200 flex items-center justify-between">
              <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                <Award className="w-4 h-4 text-blue-600" />
                Workforce Service Quality Benchmark
              </h2>
            </div>

            <div className="p-5 space-y-3.5 text-xs text-slate-600 flex-1">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-3 bg-slate-50 border border-slate-200 rounded space-y-1">
                  <h4 className="font-bold text-slate-900 text-xs">Target CSAT Standard</h4>
                  <p className="text-[11px] text-slate-500">
                    Maintain an average CSAT &ge; <strong>85%</strong> to remain eligible for priority automated dispatching.
                  </p>
                </div>
                <div className="p-3 bg-slate-50 border border-slate-200 rounded space-y-1">
                  <h4 className="font-bold text-slate-900 text-xs">Proof of Work Compliance</h4>
                  <p className="text-[11px] text-slate-500">
                    100% of jobs require valid arrival GPS geofencing, customer work start OTP, and before/after photos.
                  </p>
                </div>
              </div>

              <div className="p-3 bg-blue-50/60 border border-blue-200 rounded text-[11px] text-blue-900">
                <p className="font-bold">Authoritative Data Integration Notice</p>
                <p className="text-blue-800 mt-0.5">
                  All metrics displayed here are computed directly from completed ServiceRequest records and customer feedback submissions stored in PostgreSQL.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Customer Reviews & Feedback Submissions */}
        <div className="bg-white border border-slate-200 rounded overflow-hidden shadow-sm">
          <div className="bg-slate-50 px-4 py-3 border-b border-slate-200 flex items-center justify-between">
            <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-blue-600" />
              Customer Feedback & Reviews ({feedbacks.length})
            </h2>
            <button
              type="button"
              onClick={loadPerformance}
              className="text-[11px] font-semibold text-blue-600 hover:underline"
            >
              Refresh
            </button>
          </div>

          <div className="p-0">
            {feedbacks.length > 0 ? (
              <div className="divide-y divide-slate-100">
                {feedbacks.map((fb) => (
                  <div key={fb.id} className="p-4 space-y-2 hover:bg-slate-50/50 transition-colors">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                      <div className="flex items-center gap-2">
                        <div className="flex items-center text-amber-500">
                          {[1, 2, 3, 4, 5].map((s) => (
                            <Star
                              key={s}
                              className={`w-3.5 h-3.5 ${
                                s <= fb.rating ? 'fill-amber-400 text-amber-400' : 'text-slate-300'
                              }`}
                            />
                          ))}
                        </div>
                        <span className="font-bold text-slate-900 text-xs">{fb.rating}.0</span>
                        <span className="text-slate-400">•</span>
                        <span className="font-semibold text-slate-700 text-xs">
                          {fb.customer_name || 'Customer'}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-[10px] text-slate-500 font-mono">
                        <span>Job: <strong className="text-blue-600">{fb.request_id || `SR-${fb.job}`}</strong></span>
                        <span>•</span>
                        <span>{new Date(fb.created_at).toLocaleDateString()}</span>
                      </div>
                    </div>

                    <p className="text-xs text-slate-700 italic">
                      "{fb.review || 'Service completed satisfactorily according to scope.'}"
                    </p>

                    {fb.service_title && (
                      <span className="inline-block px-2 py-0.5 bg-slate-100 text-slate-600 rounded text-[10px] font-medium border border-slate-200">
                        {fb.service_title}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-12 px-4 text-center space-y-2">
                <div className="w-12 h-12 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center mx-auto text-slate-400">
                  <MessageSquare className="w-6 h-6" />
                </div>
                <h3 className="font-bold text-slate-800 text-xs">No customer feedback yet</h3>
                <p className="text-[11px] text-slate-500 max-w-sm mx-auto">
                  Customer feedback will appear here as soon as clients review your completed work orders.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </AppShell>
  );
}

export default EmployeePerformancePage;
