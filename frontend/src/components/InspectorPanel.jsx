import React from 'react';
import { X, Copy, Check, Terminal, FileText, AlertTriangle } from 'lucide-react';

export default function InspectorPanel({ node, onClose }) {
  const [copied, setCopied] = React.useState(false);
  const [activeTab, setActiveTab] = React.useState('parsed'); // 'parsed' | 'prompts' | 'raw'

  React.useEffect(() => {
    // Reset back to parsed tab when selecting a different node
    setActiveTab('parsed');
  }, [node.id]);

  if (!node) return null;

  const getRawContent = () => {
    if (node.data.rawLlmResponse) return node.data.rawLlmResponse;
    if (node.data.output) return JSON.stringify(node.data.output, null, 2);
    return 'No raw response content available.';
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(getRawContent());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const renderContent = () => {
    const { label, output, input, systemPrompt, userPrompt, providerUsed, activeKeyMasked } = node.data;

    if (activeTab === 'prompts') {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="inspect-section">
            <span className="inspect-section-title">Execution Context</span>
            <div className="inspect-badge-row">
              <span className="inspect-badge-key">LLM Provider</span>
              <span className="inspect-badge-val active" style={{ background: 'var(--accent-light)', color: 'var(--accent-color)' }}>
                {providerUsed || 'Groq'}
              </span>
            </div>
            <div className="inspect-badge-row">
              <span className="inspect-badge-key">Active Key</span>
              <span className="inspect-badge-val active" style={{ background: '#f1f1f3', color: 'var(--text-secondary)' }}>
                {activeKeyMasked || 'System Primary Key'}
              </span>
            </div>
          </div>

          <div className="inspect-section">
            <span className="inspect-section-title">System Prompt</span>
            <pre className="prompt-pre">
              {systemPrompt || 'No system prompt configured for this node.'}
            </pre>
          </div>

          <div className="inspect-section">
            <span className="inspect-section-title">User Prompt Context</span>
            <pre className="prompt-pre">
              {userPrompt || 'No user prompt context recorded.'}
            </pre>
          </div>
        </div>
      );
    }

    if (activeTab === 'raw') {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, height: '100%' }}>
          <div className="inspect-section" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <span className="inspect-section-title">Unparsed LLM String</span>
              <button onClick={handleCopy} className="inspector-copy-btn" style={{ background: 'none', border: 'none', color: 'var(--accent-color)', fontSize: '0.65rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
                {copied ? <Check style={{ width: 12, height: 12, color: 'var(--success-color)' }} /> : <Copy style={{ width: 12, height: 12 }} />}
                {copied ? 'Copied' : 'Copy Response'}
              </button>
            </div>
            <pre className="prompt-pre" style={{ flex: 1, maxHeight: 'none', overflowY: 'auto', margin: 0, fontStyle: 'normal' }}>
              {getRawContent()}
            </pre>
          </div>
        </div>
      );
    }

    // Default: 'parsed' Tab Switch Case
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
                      <div className="history-card-text">{h.content}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ fontSize: '0.7rem', color: '#86868b', fontStyle: 'italic' }}>No historical references selected</div>
              )}
            </div>
          </>
        );

      case 'knowledge_retrieval':
        return (
          <>
            <div className="inspect-badge-row">
              <span className="inspect-badge-key">Retrieval Active</span>
              <span className={`inspect-badge-val ${output.retrieval_used ? 'active' : 'inactive'}`}>
                {output.retrieval_used ? 'YES' : 'NO'}
              </span>
            </div>

            <div className="inspect-section">
              <span className="inspect-section-title">Retrieved Reference Semantics</span>
              {output.retrieved_chunks && output.retrieved_chunks.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {output.retrieved_chunks.map((chunk, i) => (
                    <div key={i} className="chunk-card">
                      <div className="chunk-header">
                        <span className="chunk-source">{chunk.source}</span>
                        <span className="chunk-score">Cosine: {chunk.score.toFixed(4)}</span>
                      </div>
                      <p className="chunk-text">{chunk.text}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ fontSize: '0.7rem', color: '#86868b', fontStyle: 'italic' }}>No reference texts pulled</div>
              )}
            </div>
          </>
        );

      case 'planner':
        return (
          <>
            <div className="inspect-section">
              <span className="inspect-section-title">Execution Approach</span>
              <p className="inspect-text-box">
                {output.approach}
              </p>
            </div>

            <div className="inspect-badge-row">
              <span className="inspect-badge-key">Estimated Length</span>
              <span className="inspect-badge-val active capitalize">
                {output.estimated_length}
              </span>
            </div>

            <div className="inspect-section">
              <span className="inspect-section-title">Proposed Layout Skeleton</span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {output.sections && output.sections.map((sec, i) => (
                  <div key={i} className="planner-section-card">
                    <span className="planner-section-title">
                      <FileText size={12} style={{ color: 'var(--accent-color)' }} />
                      {sec.heading}
                    </span>
                    <ul className="planner-section-bullets">
                      {sec.key_points && sec.key_points.map((pt, j) => (
                        <li key={j}>{pt}</li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          </>
        );

      case 'logic_critic':
        return (
          <>
            <div className="inspect-badge-row">
              <span className="inspect-badge-key">Plan Audit Status</span>
              <span className={`inspect-badge-val ${output.plan_approved ? 'active' : 'inactive'}`} style={{ backgroundColor: output.plan_approved ? '#e8f7ee' : '#fff8eb', color: output.plan_approved ? '#1d9d53' : '#e28704' }}>
                {output.plan_approved ? 'APPROVED' : 'REVISION REQUIRED'}
              </span>
            </div>

            <div className="inspect-badge-row">
              <span className="inspect-badge-key">Confidence Grade</span>
              <span className="inspect-badge-val active font-mono" style={{ backgroundColor: output.confidence_score >= 85 ? '#e8f7ee' : '#fdf2f2', color: output.confidence_score >= 85 ? '#1d9d53' : '#d9383a' }}>
                {output.confidence_score}/100
              </span>
            </div>

            <div className="inspect-section">
              <span className="inspect-section-title">Critic Audit Rationale</span>
              <p className="inspect-text-box">
                {output.confidence_rationale}
              </p>
            </div>

            <div className="inspect-section">
              <span className="inspect-section-title">Criticism Issues Log</span>
              {output.issues_found && output.issues_found.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {output.issues_found.map((issue, i) => (
                    <div key={i} className="critic-issue-row">
                      <AlertTriangle size={13} className="critic-issue-icon" />
                      <span>{issue}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="critic-perfect-card">
                  Plan matches reasoning requirements. Perfect audit alignment.
                </div>
              )}
            </div>
          </>
        );

      case 'writer':
        return (
          <div className="inspect-section">
            <span className="inspect-section-title">Drafting Stage</span>
            <p className="inspect-text-box font-mono" style={{ fontSize: '0.72rem', whiteSpace: 'pre-wrap' }}>
              Final streamed text outputs compiled under the selected model. Check the left chatbot pane to read full output markdown blocks.
            </p>
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

      {/* Tabs list */}
      <div className="inspector-tabs" style={{ display: 'flex', gap: 4, padding: '0 1.25rem', borderBottom: '1px solid var(--border-light)', marginBottom: 12 }}>
        {[
          { id: 'parsed', name: 'Parsed Output' },
          { id: 'prompts', name: 'Prompts Trace' },
          { id: 'raw', name: 'Raw JSON API' }
        ].map(tab => (
          <button
            key={tab.id}
            className={`inspector-tab-btn ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
            style={{
              background: 'none',
              border: 'none',
              borderBottom: activeTab === tab.id ? '2px solid var(--accent-color)' : '2px solid transparent',
              color: activeTab === tab.id ? 'var(--accent-color)' : 'var(--text-secondary)',
              fontSize: '0.7rem',
              fontWeight: 500,
              padding: '6px 10px',
              cursor: 'pointer',
              transition: 'all 0.15s'
            }}
          >
            {tab.name}
          </button>
        ))}
      </div>

      <div className="inspector-body" style={{ flex: 1, overflowY: 'auto', padding: '0 1.25rem 1.25rem 1.25rem', display: 'flex', flexDirection: 'column' }}>
        {renderContent()}
      </div>
    </div>
  );
}
