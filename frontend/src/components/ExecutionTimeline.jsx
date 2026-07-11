import React from 'react';
import { 
  Search, 
  Sparkles, 
  BrainCircuit, 
  Database, 
  Layout, 
  Activity, 
  PenTool, 
  Clock, 
  CheckCircle, 
  AlertTriangle, 
  ArrowRight,
  GitCompare,
  FileText
} from 'lucide-react';

export default function ExecutionTimeline({ events, currentStage, running, query }) {
  
  const findStageEvent = (stageName) => 
    events.find(e => e.stage === stageName && e.event === 'stage_complete');

  const isStageActive = (stageName) => currentStage === stageName;

  const getStageState = (stageName) => {
    const active = isStageActive(stageName);
    const completeEvent = findStageEvent(stageName);
    
    let status = 'idle';
    let duration = undefined;
    let output = undefined;
    let rawPayload = undefined;
    
    if (completeEvent) {
      if (completeEvent.output?.skipped) {
        status = 'skipped';
      } else {
        status = 'success';
      }
      duration = completeEvent.duration_ms;
      output = completeEvent.output;
      rawPayload = completeEvent;
    } else if (active) {
      status = 'running';
    }

    // Merge revisions for planner and critic
    if (stageName === 'planner') {
      const revision = findStageEvent('planner_revision');
      if (revision) {
        duration = (duration || 0) + revision.duration_ms;
        output = revision.output;
        rawPayload = revision;
      }
    }
    if (stageName === 'logic_critic') {
      const revision = findStageEvent('logic_critic_revision');
      if (revision) {
        duration = (duration || 0) + revision.duration_ms;
        output = revision.output;
        rawPayload = revision;
      }
      const completeCritic = findStageEvent('logic_critic');
      if (completeCritic && !completeCritic.output.plan_approved && !revision) {
        status = 'warning';
      }
    }

    return { active, status, duration, output, rawPayload };
  };

  const stages = [
    {
      id: 'intent_analyzer',
      label: '1. Intent Analyzer',
      desc: 'Classifies task intent & extracts entities',
      icon: <Sparkles size={16} />,
      color: 'var(--accent-color)'
    },
    {
      id: 'memory',
      label: '2. Session Memory',
      desc: 'Queries past conversation matching',
      icon: <BrainCircuit size={16} />,
      color: '#8b5cf6'
    },
    {
      id: 'knowledge_retrieval',
      label: '3. Vector Search (RAG)',
      desc: 'Retrieves local ChromaDB seed files',
      icon: <Database size={16} />,
      color: 'var(--accent-color)'
    },
    {
      id: 'planner',
      label: '4. Planner',
      desc: 'Generates structured outline strategy',
      icon: <Layout size={16} />,
      color: '#6d28d9'
    },
    {
      id: 'logic_critic',
      label: '5. Logic / Critic',
      desc: 'Audits plan outlines against facts',
      icon: <Activity size={16} />,
      color: 'var(--success-color)'
    },
    {
      id: 'writer',
      label: '6. Output Writer',
      desc: 'Drafts final markdown response stream',
      icon: <PenTool size={16} />,
      color: '#db2777'
    }
  ];

  const renderStageOutput = (stageId, state) => {
    const { output, status, rawPayload } = state;
    if (!output || status === 'idle' || status === 'running') return null;

    if (status === 'skipped') {
      return (
        <div className="timeline-card-output" style={{ fontStyle: 'italic', fontSize: '0.72rem', color: '#86868b' }}>
          {output.reason || 'Stage skipped — simple query fast-track.'}
        </div>
      );
    }

    switch (stageId) {
      case 'intent_analyzer':
        return (
          <div className="timeline-card-output">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, fontSize: '0.74rem' }}>
              <div>
                <strong style={{ color: 'var(--text-secondary)' }}>Category: </strong>
                <span className="capitalize">{output.intent_category?.replace('_', ' ')}</span>
              </div>
              <div>
                <strong style={{ color: 'var(--text-secondary)' }}>Complexity: </strong>
                <span className="capitalize">{output.complexity}</span>
              </div>
              <div>
                <strong style={{ color: 'var(--text-secondary)' }}>RAG Retrieval: </strong>
                <span>{output.requires_retrieval ? 'Required' : 'Skipped'}</span>
              </div>
              <div>
                <strong style={{ color: 'var(--text-secondary)' }}>Memory lookup: </strong>
                <span>{output.requires_memory ? 'Required' : 'Skipped'}</span>
              </div>
            </div>
            {output.key_entities && output.key_entities.length > 0 && (
              <div style={{ marginTop: 8 }}>
                <strong style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>Extracted Entities: </strong>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 4 }}>
                  {output.key_entities.map((ent, i) => (
                    <span key={i} className="inspect-entity-tag" style={{ fontSize: '0.62rem', padding: '2px 6px' }}>{ent}</span>
                  ))}
                </div>
              </div>
            )}
          </div>
        );

      case 'memory':
        return (
          <div className="timeline-card-output">
            <div style={{ fontSize: '0.74rem', marginBottom: 4 }}>
              <strong>History Match Found: </strong>
              <span style={{ color: output.found_context ? 'var(--success-color)' : 'var(--text-secondary)' }}>
                {output.found_context ? 'YES' : 'NO'}
              </span>
            </div>
            {output.relevant_history && output.relevant_history.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 6, maxHeight: 110, overflowY: 'auto' }}>
                {output.relevant_history.map((h, i) => (
                  <div key={i} className={`history-card ${h.role}`} style={{ padding: '6px', fontSize: '0.66rem' }}>
                    <div style={{ fontSize: '0.52rem', fontWeight: 600, color: 'var(--text-secondary)' }}>{h.role.toUpperCase()}</div>
                    <div>{h.content}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        );

      case 'knowledge_retrieval':
        return (
          <div className="timeline-card-output">
            <div style={{ fontSize: '0.74rem', marginBottom: 6 }}>
              <strong>RAG Documents Pulled: </strong>
              <span>{output.retrieved_chunks?.length || 0} matching snippets</span>
            </div>
            {output.retrieved_chunks && output.retrieved_chunks.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 130, overflowY: 'auto' }}>
                {output.retrieved_chunks.map((chunk, i) => {
                  const scorePercentage = Math.round((1 - chunk.score) * 100);
                  return (
                    <div key={i} className="chunk-card" style={{ padding: '8px', fontSize: '0.66rem' }}>
                      <div className="chunk-header" style={{ marginBottom: 2 }}>
                        <span className="chunk-source" style={{ fontSize: '0.65rem' }}>{chunk.source}</span>
                        <span className="chunk-score" style={{ fontSize: '0.55rem', padding: '1px 4px' }}>Match: {scorePercentage}%</span>
                      </div>
                      <p style={{ margin: 0, color: 'var(--text-primary)', fontStyle: 'italic' }}>"{chunk.text.substring(0, 110)}..."</p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );

      case 'planner':
        const initialPlan = rawPayload?.initial_plan;
        const isRevised = initialPlan && Object.keys(initialPlan).length > 0;
        return (
          <div className="timeline-card-output">
            {isRevised ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <span style={{ fontSize: '0.65rem', color: 'var(--warning-color)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
                  <GitCompare size={12} />
                  <span>Critic loop triggered plan updates:</span>
                </span>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 4 }}>
                  <div style={{ border: '1px dashed var(--error-color)', padding: 6, borderRadius: 6, opacity: 0.65, fontSize: '0.65rem', background: 'rgba(217, 56, 58, 0.01)' }}>
                    <div style={{ fontWeight: 600, color: 'var(--error-color)', marginBottom: 2 }}>DRAFT 1 (REJECTED)</div>
                    <div style={{ textDecoration: 'line-through' }}>{initialPlan.approach}</div>
                  </div>
                  <div style={{ border: '1px solid var(--success-color)', padding: 6, borderRadius: 6, fontSize: '0.65rem', background: 'rgba(29, 157, 83, 0.01)' }}>
                    <div style={{ fontWeight: 600, color: 'var(--success-color)', marginBottom: 2 }}>REVISION 2 (APPROVED)</div>
                    <div>{output.approach}</div>
                  </div>
                </div>
              </div>
            ) : (
              <div>
                <strong style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>Execution Strategy: </strong>
                <p style={{ fontSize: '0.72rem', margin: '4px 0 0 0', lineHeight: '1.35' }}>"{output.approach}"</p>
              </div>
            )}
          </div>
        );

      case 'logic_critic':
        const initialCritique = rawPayload?.initial_critique;
        const isCritRevised = initialCritique && Object.keys(initialCritique).length > 0;
        return (
          <div className="timeline-card-output">
            {isCritRevised ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <span style={{ fontSize: '0.65rem', color: 'var(--success-color)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
                  <CheckCircle size={12} />
                  <span>Audit corrected and approved:</span>
                </span>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 4 }}>
                  <div style={{ border: '1px solid var(--border-light)', padding: 6, borderRadius: 6, fontSize: '0.65rem', background: '#fbfbfd' }}>
                    <div style={{ fontWeight: 600, color: 'var(--error-color)', marginBottom: 2 }}>AUDIT 1 (REJECTED)</div>
                    <div>Score: {initialCritique.confidence_score}/100</div>
                    <div style={{ fontSize: '0.58rem', color: 'var(--error-color)', marginTop: 4 }}>Issues: {initialCritique.issues_found?.join(', ')}</div>
                  </div>
                  <div style={{ border: '1px solid var(--border-light)', padding: 6, borderRadius: 6, fontSize: '0.65rem', background: '#ffffff' }}>
                    <div style={{ fontWeight: 600, color: 'var(--success-color)', marginBottom: 2 }}>AUDIT 2 (APPROVED)</div>
                    <div>Score: {output.confidence_score}/100</div>
                    <div style={{ fontSize: '0.58rem', color: 'var(--success-color)', marginTop: 4 }}>Passed validation audit.</div>
                  </div>
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.74rem' }}>
                  <span>Approved:</span>
                  <strong style={{ color: output.plan_approved ? 'var(--success-color)' : 'var(--error-color)' }}>
                    {output.plan_approved ? 'YES' : 'NO'}
                  </strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.74rem' }}>
                  <span>Confidence Score:</span>
                  <strong>{output.confidence_score}/100</strong>
                </div>
                {output.issues_found && output.issues_found.length > 0 && (
                  <div style={{ marginTop: 6 }}>
                    <span style={{ fontSize: '0.65rem', fontWeight: 600, color: 'var(--error-color)' }}>Identified Issues:</span>
                    {output.issues_found.map((issue, idx) => (
                      <div key={idx} style={{ fontSize: '0.66rem', color: 'var(--error-color)', display: 'flex', gap: 4, marginTop: 2 }}>
                        <span>•</span> <span>{issue}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        );

      case 'writer':
        return (
          <div className="timeline-card-output">
            <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 4 }}>
              <CheckCircle size={12} style={{ color: 'var(--success-color)' }} />
              <span>Markdown streaming completed. Final response compiled.</span>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  const getStageHeaderStatus = (stageId, state) => {
    const { status, duration } = state;
    if (status === 'skipped') {
      return (
        <span style={{ fontSize: '0.64rem', color: '#86868b', marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 4 }}>
          <ArrowRight size={12} style={{ color: '#86868b' }} />
          <span>Skipped (fast-track)</span>
        </span>
      );
    }
    if (status === 'success') {
      return (
        <span style={{ fontSize: '0.64rem', color: 'var(--text-secondary)', marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 4 }}>
          <CheckCircle size={12} style={{ color: 'var(--success-color)' }} />
          <span>{duration ? `${(duration / 1000).toFixed(2)}s` : 'Done'}</span>
        </span>
      );
    }
    if (status === 'warning') {
      return (
        <span style={{ fontSize: '0.64rem', color: 'var(--warning-color)', marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 4 }}>
          <AlertTriangle size={12} />
          <span>Revision Loop</span>
        </span>
      );
    }
    if (status === 'running') {
      return (
        <span style={{ fontSize: '0.64rem', color: 'var(--accent-color)', marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600 }}>
          <span className="pulsing-dot-inner" />
          <span>Processing...</span>
        </span>
      );
    }
    return (
      <span style={{ fontSize: '0.64rem', color: 'var(--text-muted)', marginLeft: 'auto' }}>
        Pending
      </span>
    );
  };

  return (
    <div className="execution-timeline-container" style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 14, overflowY: 'auto', height: '100%' }}>
      
      {/* Root User Query Start Card */}
      <div className="timeline-step-row" style={{ display: 'flex', gap: 12 }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 24 }}>
          <div style={{
            width: 22,
            height: 22,
            borderRadius: '50%',
            backgroundColor: 'var(--primary-color)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#ffffff',
            fontSize: '0.68rem',
            fontWeight: 'bold',
            flexShrink: 0
          }}>
            <Search size={11} />
          </div>
          <div style={{ width: 2, flex: 1, backgroundColor: 'var(--border-light)', minHeight: 18 }} />
        </div>
        <div style={{ flex: 1, background: '#ffffff', border: '1px solid var(--border-light)', borderRadius: '8px', padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.72rem', fontWeight: 600, textTransform: 'uppercase', color: 'var(--text-secondary)' }}>User Request</span>
            <span style={{ fontSize: '0.64rem', color: 'var(--text-muted)' }}>Input Trigger</span>
          </div>
          <p style={{ fontSize: '0.76rem', fontWeight: 500, margin: 0 }}>"{query || 'Explain public-key cryptography'}"</p>
        </div>
      </div>

      {/* Render Loop for 6 Stages */}
      {stages.map((stage, index) => {
        const state = getStageState(stage.id);
        const isLast = index === stages.length - 1;
        
        let borderStyle = '1px solid var(--border-light)';
        let cardBg = '#fbfbfd';
        let opacity = 0.55;

        if (state.status === 'running') {
          borderStyle = '1.5px solid var(--accent-color)';
          cardBg = '#ffffff';
          opacity = 1;
        } else if (state.status === 'skipped') {
          borderStyle = '1px dashed #cbcbcd';
          cardBg = '#fafafa';
          opacity = 0.7;
        } else if (state.status === 'success' || state.status === 'warning') {
          borderStyle = '1px solid var(--border-light)';
          cardBg = '#ffffff';
          opacity = 1;
        }

        return (
          <div key={stage.id} className={`timeline-step-row stage-${stage.id}`} style={{ display: 'flex', gap: 12, opacity: opacity, transition: 'opacity 0.25s' }}>
            {/* Left timeline line and icon */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 24 }}>
              <div style={{
                width: 22,
                height: 22,
                borderRadius: '50%',
                backgroundColor: state.status === 'running' ? 'var(--accent-color)' : (state.status === 'success' ? 'var(--success-color)' : (state.status === 'warning' ? 'var(--warning-color)' : (state.status === 'skipped' ? '#a1a1a3' : '#cbcbcd'))),
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#ffffff',
                flexShrink: 0,
                transition: 'background-color 0.25s',
                boxShadow: state.status === 'running' ? '0 0 10px rgba(0, 102, 204, 0.4)' : 'none'
              }}>
                {stage.icon}
              </div>
              {!isLast && (
                <div style={{ 
                  width: 2, 
                  flex: 1, 
                  backgroundColor: (state.status === 'success' || state.status === 'warning' || state.status === 'skipped') ? ((state.status === 'skipped') ? '#cbcbcd' : 'var(--success-color)') : 'var(--border-light)', 
                  minHeight: 20,
                  transition: 'background-color 0.25s'
                }} />
              )}
            </div>

            {/* Right card container */}
            <div style={{ 
              flex: 1, 
              background: cardBg, 
              border: borderStyle, 
              borderRadius: '8px', 
              padding: '10px 12px', 
              display: 'flex', 
              flexDirection: 'column', 
              gap: 8,
              boxShadow: state.status === 'running' ? '0 4px 15px rgba(0, 102, 204, 0.03)' : 'none',
              transition: 'all 0.25s'
            }}>
              {/* Card Header */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, borderBottom: (state.status === 'success' || state.status === 'warning') ? '1px solid var(--border-light)' : '1px solid transparent', paddingBottom: (state.status === 'success' || state.status === 'warning') ? 6 : 0, transition: 'all 0.25s' }}>
                <strong style={{ fontSize: '0.76rem', color: state.status === 'running' ? 'var(--accent-color)' : 'var(--text-primary)' }}>{stage.label}</strong>
                <span style={{ fontSize: '0.62rem', color: 'var(--text-secondary)' }}>({stage.desc})</span>
                {getStageHeaderStatus(stage.id, state)}
              </div>

              {/* Dynamic Content output inside card */}
              {renderStageOutput(stage.id, state)}
            </div>
          </div>
        );
      })}
    </div>
  );
}
