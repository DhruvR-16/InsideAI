import React from 'react';
import { X, Copy, Check, Terminal, FileText, AlertTriangle } from 'lucide-react';

export default function InspectorPanel({ node, onClose }) {
  const [copied, setCopied] = React.useState(false);

  if (!node) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(JSON.stringify(node.data.output, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const renderContent = () => {
    const { label, output, input } = node.data;

    if (!output) {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '180px', color: '#86868b' }}>
          <Terminal className="w-8 h-8 mb-2 opacity-50" style={{ width: 28, height: 28, marginBottom: 8, opacity: 0.5 }} />
          <p style={{ fontSize: '0.75rem' }}>Stage is pending or running...</p>
        </div>
      );
    }

    switch (node.id) {
      case 'intent_analyzer':
        return (
          <>
            <div className="inspect-section">
              <span className="inspect-section-title">Restated Question</span>
              <p className="inspect-text-box italic">
                "{output.core_question || input}"
              </p>
            </div>
            
            <div className="inspect-badge-row">
              <span className="inspect-badge-key">Intent Category</span>
              <span className="inspect-badge-val active capitalize">
                {output.intent_category?.replace('_', ' ')}
              </span>
            </div>

            <div className="inspect-badge-row">
              <span className="inspect-badge-key">Complexity</span>
              <span className="inspect-badge-val active capitalize" style={{ backgroundColor: output.complexity === 'complex' ? '#fdf2f2' : output.complexity === 'moderate' ? '#fff8eb' : '#e8f7ee', color: output.complexity === 'complex' ? '#d9383a' : output.complexity === 'moderate' ? '#e28704' : '#1d9d53' }}>
                {output.complexity}
              </span>
            </div>

            <div className="inspect-badge-row">
              <span className="inspect-badge-key">Requires RAG</span>
              <span className={`inspect-badge-val ${output.requires_retrieval ? 'active' : 'inactive'}`}>
                {output.requires_retrieval ? 'YES' : 'NO'}
              </span>
            </div>

            <div className="inspect-badge-row">
              <span className="inspect-badge-key">Requires Memory</span>
              <span className={`inspect-badge-val ${output.requires_memory ? 'active' : 'inactive'}`}>
                {output.requires_memory ? 'YES' : 'NO'}
              </span>
            </div>

            <div className="inspect-section">
              <span className="inspect-section-title">Extracted Entities</span>
              <div className="inspect-entity-list">
                {output.key_entities && output.key_entities.length > 0 ? (
                  output.key_entities.map((ent, i) => (
                    <span key={i} className="inspect-entity-tag">
                      {ent}
                    </span>
                  ))
                ) : (
                  <span style={{ fontSize: '0.7rem', color: '#86868b', fontStyle: 'italic' }}>None detected</span>
                )}
              </div>
            </div>
          </>
        );

      case 'memory':
        return (
          <>
            <div className="inspect-badge-row">
              <span className="inspect-badge-key">Memory Match Found</span>
              <span className={`inspect-badge-val ${output.found_context ? 'active' : 'inactive'}`}>
                {output.found_context ? 'YES' : 'NO'}
              </span>
            </div>
            
            <div className="inspect-section">
              <span className="inspect-section-title">Relevant History Context</span>
              {output.relevant_history && output.relevant_history.length > 0 ? (
                <div className="history-card-container">
                  {output.relevant_history.map((h, i) => (
                    <div key={i} className={`history-card ${h.role}`}>
                      <div className="history-card-role">
                        {h.role === 'user' ? 'User' : 'Assistant'}
                      </div>
                      <p style={{ margin: 0 }}>{h.content}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="inspect-text-box italic" style={{ textAlign: 'center', color: '#86868b' }}>
                  No past conversations referenced for this query.
                </p>
              )}
            </div>
          </>
        );

      case 'knowledge_retrieval':
        return (
          <>
            <div className="inspect-badge-row">
              <span className="inspect-badge-key">RAG Vector DB Query</span>
              <span className={`inspect-badge-val ${output.retrieval_used ? 'active' : 'inactive'}`}>
                {output.retrieval_used ? 'EXECUTED' : 'SKIPPED'}
              </span>
            </div>

            <div className="inspect-section">
              <span className="inspect-section-title">
                Retrieved Context Snippets ({output.retrieved_chunks?.length || 0})
              </span>
              {output.retrieved_chunks && output.retrieved_chunks.length > 0 ? (
                <div className="history-card-container">
                  {output.retrieved_chunks.map((chk, i) => (
                    <div key={i} className="chunk-card">
                      <div className="chunk-header">
                        <span className="chunk-source">{chk.source}</span>
                        <span className="chunk-score">Score: {chk.score}</span>
                      </div>
                      <p className="chunk-text">{chk.text}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="inspect-text-box italic" style={{ textAlign: 'center', color: '#86868b' }}>
                  No knowledge snippets fetched.
                </p>
              )}
            </div>
          </>
        );

      case 'planner':
      case 'planner_revision':
        return (
          <>
            <div className="inspect-section">
              <span className="inspect-section-title">Approach Strategy</span>
              <p className="inspect-text-box" style={{ color: '#0066cc', fontWeight: 500 }}>
                {output.approach}
              </p>
            </div>

            <div className="inspect-section">
              <span className="inspect-section-title">Structured Outlines</span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {output.sections && output.sections.map((sect, idx) => (
                  <div key={idx} className="planner-section-card">
                    <span className="planner-section-title">
                      <FileText className="w-3.5 h-3.5" style={{ width: 14, height: 14 }} />
                      {sect.heading}
                    </span>
                    <ul className="planner-section-bullets">
                      {sect.key_points && sect.key_points.map((pt, pIdx) => (
                        <li key={pIdx}>{pt}</li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          </>
        );

      case 'logic_critic':
      case 'logic_critic_revision':
        const isApproved = output.plan_approved;
        return (
          <>
            <div className="inspect-badge-row">
              <span className="inspect-badge-key">Plan Approval Status</span>
              <span className={`inspect-badge-val`} style={{ 
                backgroundColor: isApproved ? '#e8f7ee' : '#fdf2f2', 
                color: isApproved ? '#1d9d53' : '#d9383a' 
              }}>
                {isApproved ? 'APPROVED' : 'REJECTED BY CRITIC'}
              </span>
            </div>

            <div className="inspect-badge-row">
              <span className="inspect-badge-key">Critic confidence rating</span>
              <span className="inspect-badge-val active">
                {output.confidence_score}/100
              </span>
            </div>

            <div className="inspect-section">
              <span className="inspect-section-title">Confidence Rationale</span>
              <p className="inspect-text-box">
                {output.confidence_rationale}
              </p>
            </div>

            <div className="inspect-section">
              <span className="inspect-section-title">Issues Found</span>
              {output.issues_found && output.issues_found.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {output.issues_found.map((issue, i) => (
                    <div key={i} className="critic-issue-row">
                      <AlertTriangle className="critic-issue-icon" style={{ width: 14, height: 14, shrink: 0 }} />
                      <p style={{ margin: 0 }}>{issue}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="critic-perfect-card">
                  All validation rubrics passed. Plan is factually consistent and complete.
                </div>
              )}
            </div>
          </>
        );

      case 'writer':
        return (
          <div className="inspect-section">
            <span className="inspect-section-title">Raw Response Text</span>
            <div className="inspect-text-box" style={{ fontFamily: 'monospace', whiteSpace: 'pre-wrap', maxHeight: 300, overflowY: 'auto' }}>
              {output.text}
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="inspector-panel">
      <div className="inspector-header">
        <div className="inspector-title-container">
          <span className="inspector-tag">Module Details</span>
          <h3 className="inspector-title">{node.data.label}</h3>
        </div>
        <button onClick={onClose} className="inspector-close-btn">
          <X style={{ width: 16, height: 16 }} />
        </button>
      </div>

      <div className="inspector-body">
        {renderContent()}

        {node.data.output && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 'auto', borderTop: '1px solid var(--border-light)', paddingTop: 12 }}>
            <div className="inspector-raw-header">
              <span className="inspector-raw-title">Raw JSON Payload</span>
              <button onClick={handleCopy} className="inspector-copy-btn">
                {copied ? <Check style={{ width: 12, height: 12, color: 'var(--success-color)' }} /> : <Copy style={{ width: 12, height: 12 }} />}
                {copied ? 'Copied' : 'Copy Payload'}
              </button>
            </div>
            <pre className="inspector-raw-pre">
              {JSON.stringify(node.data.output, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}
