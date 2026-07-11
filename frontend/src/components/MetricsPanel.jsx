import React from 'react';
import { Clock, ShieldAlert, Zap, Cpu } from 'lucide-react';

export default function MetricsPanel({ events, totalTime, confidence }) {
  // Extract completed stages and calculate individual duration
  const getStageDurations = () => {
    const stageCompletes = events.filter(e => e.event === 'stage_complete');
    return stageCompletes.map(e => ({
      name: e.stage.replace('_', ' '),
      duration: e.duration_ms
    }));
  };

  const durations = getStageDurations();
  const maxDuration = durations.length > 0 ? Math.max(...durations.map(d => d.duration)) : 1;

  // Format milliseconds into readable seconds or ms
  const formatTime = (ms) => {
    if (!ms) return '0.0s';
    if (ms < 1000) return `${Math.round(ms)}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
  };

  const getConfidenceLevel = (score) => {
    if (!score) return { text: 'N/A', color: 'var(--text-secondary)', barBg: '#86868b' };
    if (score >= 80) return { text: 'High Alignment', color: 'var(--success-color)', barBg: 'var(--success-color)' };
    if (score >= 60) return { text: 'Moderate', color: 'var(--warning-color)', barBg: 'var(--warning-color)' };
    return { text: 'Low Alignment', color: 'var(--error-color)', barBg: 'var(--error-color)' };
  };

  const confLevel = getConfidenceLevel(confidence);

  return (
    <div className="panel" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div className="section-title" style={{ borderBottom: '1px solid var(--border-light)', paddingBottom: 8, marginBottom: 4 }}>
        <Cpu style={{ width: 14, height: 14, color: 'var(--accent-color)' }} />
        <span>Execution Metrics</span>
      </div>

      {/* Metric Cards Grid */}
      <div className="metrics-grid">
        <div className="metric-card">
          <div className="metric-label">
            <Clock style={{ width: 12, height: 12, color: 'var(--accent-color)' }} />
            Total Latency
          </div>
          <span className="metric-value">
            {formatTime(totalTime)}
          </span>
        </div>

        <div className="metric-card">
          <div className="metric-label">
            <ShieldAlert style={{ width: 12, height: 12, color: 'var(--primary-color)' }} />
            Confidence
          </div>
          <span className="metric-value" style={{ color: confLevel.color }}>
            {confidence ? `${confidence}%` : 'N/A'}
          </span>
        </div>
      </div>

      {/* Confidence Rating Progress Bar */}
      {confidence !== null && (
        <div className="progress-container">
          <div className="progress-header">
            <span>Critic Alignment</span>
            <span>{confLevel.text}</span>
          </div>
          <div className="progress-track">
            <div 
              className="progress-bar" 
              style={{ width: `${confidence}%`, backgroundColor: confLevel.barBg }}
            />
          </div>
        </div>
      )}

      {/* Latency Breakdown Bar Chart */}
      <div className="latency-list">
        <span className="section-title">
          <Zap style={{ width: 14, height: 14, color: 'var(--warning-color)' }} />
          Latency Breakdown
        </span>

        {durations.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {durations.map((d, i) => {
              const widthPct = Math.max(6, (d.duration / maxDuration) * 100);
              return (
                <div key={i} className="latency-row">
                  <div className="latency-header">
                    <span className="latency-name">{d.name}</span>
                    <span className="latency-val">{formatTime(d.duration)}</span>
                  </div>
                  <div className="latency-track">
                    <div 
                      className="latency-bar" 
                      style={{ width: `${widthPct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', fontStyle: 'italic', padding: '12px 0', textAlign: 'center' }}>
            No latencies compiled. Run a query to begin.
          </div>
        )}
      </div>
    </div>
  );
}
