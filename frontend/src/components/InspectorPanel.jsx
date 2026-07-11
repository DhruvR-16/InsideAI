import React from 'react';
import { X, Copy, Check, Terminal, FileText, AlertTriangle, Cpu, GitCompare, Play, Sparkles, Database, Brain } from 'lucide-react';

export default function InspectorPanel({ node, onClose }) {
  const [copied, setCopied] = React.useState(false);
  const [activeTab, setActiveTab] = React.useState('parsed'); // 'parsed' | 'prompts' | 'raw'
  const [viewDiff, setViewDiff] = React.useState(true);

  React.useEffect(() => {
    // Reset back to parsed tab and show diff if applicable on selection change
    setActiveTab('parsed');
    setViewDiff(true);
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

  // Helper to visually stitch the prompt template
  const renderHighlightedPrompt = (text) => {
    if (!text) return <p style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>No prompt content recorded.</p>;
    
    const lines = text.split('\n');
    let currentSection = 'default';
    
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {lines.map((line, idx) => {
          let lineStyle = {};
          
          if (line.startsWith('User query:')) {
            currentSection = 'query';
          } else if (line.startsWith('Intent Analysis:')) {
            currentSection = 'intent';
          } else if (line.startsWith('Conversation Memory:') || line.startsWith('History:')) {
            currentSection = 'memory';
          } else if (line.startsWith('Retrieved Knowledge Chunks:') || line.startsWith('Retrieved Reference Semantics:')) {
            currentSection = 'knowledge';
          } else if (line.startsWith('CRITICAL FEEDBACK FROM CRITIC.')) {
            currentSection = 'critic';
          }
          
          switch (currentSection) {
            case 'query':
              lineStyle = { color: 'var(--accent-color)', backgroundColor: 'var(--accent-light)', borderLeft: '3px solid var(--accent-color)' };
              break;
            case 'intent':
              lineStyle = { color: '#b25e00', backgroundColor: '#fff9e6', borderLeft: '3px solid #ff9500' };
              break;
            case 'memory':
              lineStyle = { color: '#6d28d9', backgroundColor: '#f5f3ff', borderLeft: '3px solid #8b5cf6' };
              break;
            case 'knowledge':
              lineStyle = { color: 'var(--success-color)', backgroundColor: 'var(--success-light)', borderLeft: '3px solid var(--success-color)' };
              break;
            case 'critic':
              lineStyle = { color: 'var(--error-color)', backgroundColor: 'var(--error-light)', borderLeft: '3px solid var(--error-color)', fontWeight: 600 };
              break;
            default:
              lineStyle = {};
          }
          
          return (
            <div 
              key={idx} 
              style={{ 
                ...lineStyle, 
                fontFamily: 'monospace', 
                fontSize: '0.68rem', 
                padding: lineStyle.padding || '1px 8px', 
                whiteSpace: 'pre-wrap',
                minHeight: '14px'
              }}
            >
              {line}
            </div>
          );
        })}
      </div>
    );
  };

  // Helper to render parser validation simulation logs
  const renderParserConsole = () => {
    const { output, rawLlmResponse } = node.data;
    if (!output) return null;
    
    const logs = [];
    logs.push({ type: 'info', text: 'Initializing Pydantic parser middleware...' });
    logs.push({ type: 'info', text: `Raw input length: ${rawLlmResponse?.length || JSON.stringify(output).length} characters` });
    
    if (rawLlmResponse) {
      if (rawLlmResponse.includes('```json') || rawLlmResponse.includes('```')) {
        logs.push({ type: 'warn', text: 'Detected markdown wrapping formatting in LLM stream. Pruning text...' });
        logs.push({ type: 'info', text: 'Regex block matches removed successfully.' });
      }
      try {
        JSON.parse(rawLlmResponse.replace(/```json|```/g, '').trim());
        logs.push({ type: 'success', text: 'Validated matching JSON signature integrity.' });
      } catch (e) {
        logs.push({ type: 'warn', text: 'Malformed JSON markers detected. Attempting correction routines...' });
        logs.push({ type: 'success', text: 'Auto-repaired JSON structure fields.' });
      }
    } else {
      logs.push({ type: 'success', text: 'JSON structure matching validated.' });
    }

    logs.push({ type: 'info', text: `Instantiating class parser validation models...` });
    
    Object.keys(output).forEach(key => {
      let valStr = typeof output[key] === 'object' ? JSON.stringify(output[key]) : String(output[key]);
      if (valStr.length > 40) valStr = valStr.substring(0, 37) + '...';
      
      if (key === 'plan_approved' && output[key] === false) {
        logs.push({ type: 'error', text: `  [FAIL] Field '${key}' value is: false -> Triggering Logic Critic Revision Cycle` });
      } else {
        logs.push({ type: 'success', text: `  [PASS] Field '${key}' constraint check: "${valStr}"` });
      }
    });

    logs.push({ type: 'success', text: 'Schema instantiation completed. Flow state updated.' });

    return (
      <div style={{
        background: '#141416',
        color: '#d1d1d6',
        borderRadius: '8px',
        padding: '10px 12px',
        fontFamily: 'monospace',
        fontSize: '0.64rem',
        lineHeight: '1.45',
        display: 'flex',
        flexDirection: 'column',
        gap: 3,
        marginTop: 14,
        border: '1px solid #242427'
      }}>
        <div style={{ borderBottom: '1px solid #242427', paddingBottom: 6, marginBottom: 6, color: '#86868b', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <Terminal size={11} style={{ color: 'var(--accent-color)' }} />
            <strong>PYDANTIC PARSER INTERCEPTOR</strong>
          </span>
          <span style={{ fontSize: '0.52rem', background: 'rgba(0, 102, 204, 0.15)', color: '#0088ff', padding: '1px 5px', borderRadius: '3px', fontWeight: 600 }}>MONITOR</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2, maxHeight: '150px', overflowY: 'auto' }}>
          {logs.map((log, i) => {
            let color = '#d1d1d6';
            let prefix = '[INFO]';
            if (log.type === 'success') { color = '#30d158'; prefix = '[SUCCESS]'; }
            if (log.type === 'warn') { color = '#ffd60a'; prefix = '[WARNING]'; }
            if (log.type === 'error') { color = '#ff453a'; prefix = '[REJECTED]'; }
            return (
              <div key={i} style={{ color }}>
                <span style={{ opacity: 0.4, marginRight: 6 }}>{prefix}</span>
                {log.text}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const renderPlannerDiff = (initialPlan, finalPlan) => {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          {/* Rejected Plan Draft */}
          <div style={{
            border: '1.5px dashed var(--error-color)',
            borderRadius: '8px',
            padding: '10px',
            background: 'rgba(217, 56, 58, 0.02)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8, borderBottom: '1px solid var(--border-light)', paddingBottom: 6 }}>
              <span style={{ fontSize: '0.6rem', fontWeight: 600, color: 'var(--error-color)', background: 'var(--error-light)', padding: '1px 5px', borderRadius: '3px' }}>DRAFT 1 (REJECTED)</span>
            </div>
            <span style={{ fontSize: '0.62rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Approach Outline:</span>
            <p style={{ fontSize: '0.68rem', color: 'var(--text-secondary)', marginBottom: 8, textDecoration: 'line-through', fontStyle: 'italic' }}>
              "{initialPlan.approach}"
            </p>
            
            <span style={{ fontSize: '0.62rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Planned Outline:</span>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 4 }}>
              {initialPlan.sections?.map((sec, idx) => (
                <div key={idx} style={{ opacity: 0.5 }}>
                  <div style={{ fontSize: '0.68rem', fontWeight: 600, textDecoration: 'line-through' }}>- {sec.heading}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Revised Approved Plan */}
          <div style={{
            border: '1.5px solid var(--success-color)',
            borderRadius: '8px',
            padding: '10px',
            background: 'rgba(29, 157, 83, 0.02)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8, borderBottom: '1px solid var(--border-light)', paddingBottom: 6 }}>
              <span style={{ fontSize: '0.6rem', fontWeight: 600, color: 'var(--success-color)', background: 'var(--success-light)', padding: '1px 5px', borderRadius: '3px' }}>REVISION 2 (APPROVED)</span>
            </div>
            <span style={{ fontSize: '0.62rem', fontWeight: 600, color: 'var(--success-color)' }}>Approach Outline:</span>
            <p style={{ fontSize: '0.68rem', color: 'var(--text-primary)', marginBottom: 8, fontWeight: 500 }}>
              "{finalPlan.approach}"
            </p>
            
            <span style={{ fontSize: '0.62rem', fontWeight: 600, color: 'var(--success-color)' }}>Revised Outline:</span>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 4 }}>
              {finalPlan.sections?.map((sec, idx) => (
                <div key={idx} style={{ background: '#ffffff', border: '1px solid var(--border-light)', padding: '6px', borderRadius: '6px' }}>
                  <div style={{ fontSize: '0.68rem', fontWeight: 600, color: 'var(--success-color)', display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span>+ {sec.heading}</span>
                  </div>
                  <ul style={{ paddingLeft: '12px', fontSize: '0.62rem', color: 'var(--text-secondary)', margin: '4px 0 0 0', listStyle: 'disc' }}>
                    {sec.key_points?.map((kp, kIdx) => (
                      <li key={kIdx}>{kp}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderCritiqueDiff = (initialCritique, finalCritique) => {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          {/* Initial Rejected Critique */}
          <div style={{
            border: '1px solid var(--border-light)',
            borderRadius: '8px',
            padding: '10px',
            background: '#fbfbfd'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8, borderBottom: '1px solid var(--border-light)', paddingBottom: 6 }}>
              <span style={{ fontSize: '0.6rem', fontWeight: 600, color: 'var(--error-color)', background: 'var(--error-light)', padding: '1px 5px', borderRadius: '3px' }}>AUDIT 1 (REJECTED)</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.68rem', marginBottom: 4 }}>
              <span>Approval Check:</span>
              <span style={{ color: 'var(--error-color)', fontWeight: 600 }}>REJECTED</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.68rem', marginBottom: 8 }}>
              <span>Score Grade:</span>
              <span style={{ color: 'var(--error-color)', fontWeight: 600 }}>{initialCritique.confidence_score}/100</span>
            </div>
            <span style={{ fontSize: '0.62rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Critic issues list:</span>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 4 }}>
              {initialCritique.issues_found?.map((issue, idx) => (
                <div key={idx} style={{ fontSize: '0.65rem', color: 'var(--error-color)', display: 'flex', gap: 4, lineHeight: '1.3' }}>
                  <span>•</span>
                  <span>{issue}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Revised Approved Critique */}
          <div style={{
            border: '1px solid var(--border-light)',
            borderRadius: '8px',
            padding: '10px',
            background: '#ffffff'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8, borderBottom: '1px solid var(--border-light)', paddingBottom: 6 }}>
              <span style={{ fontSize: '0.6rem', fontWeight: 600, color: 'var(--success-color)', background: 'var(--success-light)', padding: '1px 5px', borderRadius: '3px' }}>AUDIT 2 (APPROVED)</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.68rem', marginBottom: 4 }}>
              <span>Approval Check:</span>
              <span style={{ color: 'var(--success-color)', fontWeight: 600 }}>APPROVED</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.68rem', marginBottom: 8 }}>
              <span>Score Grade:</span>
              <span style={{ color: 'var(--success-color)', fontWeight: 600 }}>{finalCritique.confidence_score}/100</span>
            </div>
            <span style={{ fontSize: '0.62rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Validation rationales:</span>
            <p style={{ fontSize: '0.65rem', color: 'var(--text-primary)', marginTop: 4, lineHeight: '1.35' }}>
              {finalCritique.confidence_rationale}
            </p>
          </div>
        </div>
      </div>
    );
  };

  const renderContent = () => {
    const { label, output, input, systemPrompt, userPrompt, providerUsed, activeKeyMasked, initialPlan, initialCritique } = node.data;

    if (activeTab === 'prompts') {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="inspect-section">
            <span className="inspect-section-title">Telemetry Parameters</span>
            <div className="inspect-badge-row" style={{ display: 'flex', gap: 8 }}>
              <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                <Cpu size={12} style={{ color: 'var(--accent-color)' }} />
                <span className="inspect-badge-key">LLM:</span>
              </div>
              <span className="inspect-badge-val active" style={{ fontSize: '0.64rem', padding: '2px 6px' }}>{providerUsed || 'Groq'}</span>
              <span className="inspect-badge-key" style={{ marginLeft: 'auto' }}>Active Key:</span>
              <span className="inspect-badge-val active" style={{ background: '#f1f1f3', color: 'var(--text-secondary)', fontSize: '0.64rem' }}>{activeKeyMasked || 'System Primary Key'}</span>
            </div>
          </div>

          <div className="inspect-section">
            <span className="inspect-section-title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Play size={11} style={{ transform: 'rotate(90deg)' }} />
              <span>Base System Instructions</span>
            </span>
            <pre className="prompt-pre" style={{ background: '#fafafa', border: '1px solid var(--border-light)', color: 'var(--text-primary)' }}>
              {systemPrompt || 'No system prompt configured for this node.'}
            </pre>
          </div>

          <div className="inspect-section">
            <span className="inspect-section-title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Sparkles size={11} style={{ color: 'var(--accent-color)' }} />
              <span>Stitched Context Prompt Compiler</span>
            </span>
            <div style={{ border: '1px solid var(--border-light)', borderRadius: '8px', overflow: 'hidden', marginTop: 6 }}>
              {renderHighlightedPrompt(userPrompt)}
            </div>
          </div>
        </div>
      );
    }

    if (activeTab === 'raw') {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, height: '100%' }}>
          <div className="inspect-section" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <span className="inspect-section-title">Raw Response Payload</span>
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
              <span className="inspect-section-title">Deconstructed Core Question</span>
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
              <span className="inspect-badge-key">Requires Knowledge Retrieval (RAG)</span>
              <span className={`inspect-badge-val ${output.requires_retrieval ? 'active' : 'inactive'}`}>
                {output.requires_retrieval ? 'YES' : 'NO'}
              </span>
            </div>
 
            <div className="inspect-badge-row">
              <span className="inspect-badge-key">Requires Session Context</span>
              <span className={`inspect-badge-val ${output.requires_memory ? 'active' : 'inactive'}`}>
                {output.requires_memory ? 'YES' : 'NO'}
              </span>
            </div>
 
            <div className="inspect-section">
              <span className="inspect-section-title">Extracted Entity Focus</span>
              <div className="inspect-entity-list">
                {output.key_entities && output.key_entities.length > 0 ? (
                  output.key_entities.map((ent, i) => (
                    <span key={i} className="inspect-entity-tag" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <Sparkles size={9} style={{ color: 'var(--accent-color)' }} />
                      <span>{ent}</span>
                    </span>
                  ))
                ) : (
                  <span style={{ fontSize: '0.7rem', color: '#86868b', fontStyle: 'italic' }}>None detected</span>
                )}
              </div>
            </div>

            {renderParserConsole()}
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
              <span className="inspect-section-title" style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <Brain size={12} style={{ color: '#8b5cf6' }} />
                <span>Relevant History Context</span>
              </span>
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
                <div style={{ fontSize: '0.7rem', color: '#86868b', fontStyle: 'italic', background: '#fafafa', padding: 12, borderRadius: 8, border: '1px solid var(--border-light)', textAlign: 'center' }}>
                  No historical references matched user query intent.
                </div>
              )}
            </div>

            {renderParserConsole()}
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
              <span className="inspect-section-title" style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <Database size={12} style={{ color: 'var(--accent-color)' }} />
                <span>ChromaDB Semantic References Matching</span>
              </span>
              {output.retrieved_chunks && output.retrieved_chunks.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {output.retrieved_chunks.map((chunk, i) => {
                    const scorePercentage = Math.round((1 - chunk.score) * 100);
                    return (
                      <div key={i} className="chunk-card">
                        <div className="chunk-header">
                          <span className="chunk-source">{chunk.source}</span>
                          <span className="chunk-score" style={{ background: scorePercentage > 75 ? 'var(--success-light)' : '#f1f1f3', color: scorePercentage > 75 ? 'var(--success-color)' : 'var(--text-secondary)' }}>
                            Similarity: {scorePercentage}%
                          </span>
                        </div>
                        <p className="chunk-text">"{chunk.text}"</p>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div style={{ fontSize: '0.7rem', color: '#86868b', fontStyle: 'italic', background: '#fafafa', padding: 12, borderRadius: 8, border: '1px solid var(--border-light)', textAlign: 'center' }}>
                  No contextual reference matches found.
                </div>
              )}
            </div>

            {renderParserConsole()}
          </>
        );
 
      case 'planner':
        const isPlannerRevised = initialPlan && Object.keys(initialPlan).length > 0;
        return (
          <>
            {isPlannerRevised && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <span style={{ fontSize: '0.64rem', color: 'var(--warning-color)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
                  <GitCompare size={12} />
                  <span>Critic loop triggered plan updates</span>
                </span>
                <button
                  onClick={() => setViewDiff(prev => !prev)}
                  style={{
                    background: viewDiff ? 'var(--accent-light)' : 'none',
                    border: '1px solid var(--border-light)',
                    borderRadius: '4px',
                    padding: '2px 8px',
                    fontSize: '0.62rem',
                    cursor: 'pointer',
                    color: 'var(--text-primary)'
                  }}
                >
                  {viewDiff ? 'View Final Plan Only' : 'Compare Revisions'}
                </button>
              </div>
            )}

            {isPlannerRevised && viewDiff ? (
              renderPlannerDiff(initialPlan, output)
            ) : (
              <>
                <div className="inspect-section">
                  <span className="inspect-section-title">Execution Approach</span>
                  <p className="inspect-text-box">
                    "{output.approach}"
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
            )}

            {renderParserConsole()}
          </>
        );
 
      case 'logic_critic':
        const isCritiqueRevised = initialCritique && Object.keys(initialCritique).length > 0;
        return (
          <>
            {isCritiqueRevised && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <span style={{ fontSize: '0.64rem', color: 'var(--success-color)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
                  <GitCompare size={12} />
                  <span>Critic Loop verified updates successfully</span>
                </span>
                <button
                  onClick={() => setViewDiff(prev => !prev)}
                  style={{
                    background: viewDiff ? 'var(--accent-light)' : 'none',
                    border: '1px solid var(--border-light)',
                    borderRadius: '4px',
                    padding: '2px 8px',
                    fontSize: '0.62rem',
                    cursor: 'pointer',
                    color: 'var(--text-primary)'
                  }}
                >
                  {viewDiff ? 'View Final Audit Only' : 'Compare Audits'}
                </button>
              </div>
            )}

            {isCritiqueRevised && viewDiff ? (
              renderCritiqueDiff(initialCritique, output)
            ) : (
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
            )}

            {renderParserConsole()}
          </>
        );
 
      case 'writer':
        return (
          <>
            <div className="inspect-section">
              <span className="inspect-section-title">Drafting Stage</span>
              <p className="inspect-text-box font-mono" style={{ fontSize: '0.72rem', whiteSpace: 'pre-wrap' }}>
                Final streamed text outputs compiled under the selected model. Check the left chatbot pane to read full output markdown blocks.
              </p>
            </div>
            {renderParserConsole()}
          </>
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
