import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  Send, 
  Terminal, 
  Wifi,
  WifiOff,
  Sparkles,
  ArrowRight,
  ChevronRight,
  Cpu,
  Clock,
  ShieldCheck,
  Loader
} from 'lucide-react';
import FlowGraph from './components/FlowGraph';
import InspectorPanel from './components/InspectorPanel';
import MetricsPanel from './components/MetricsPanel';

// Simple Markdown to HTML parser for streaming output
function renderMarkdown(text) {
  if (!text) return '';
  let html = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  
  // Headers
  html = html.replace(/^# (.*$)/gim, '<h1 class="writer-output-markup h1">$1</h1>');
  html = html.replace(/^## (.*$)/gim, '<h2 class="writer-output-markup h2">$1</h2>');
  html = html.replace(/^### (.*$)/gim, '<h3 class="writer-output-markup h3">$1</h3>');
  
  // Bold
  html = html.replace(/\*\*(.*?)\*\*/g, '<strong style="font-weight: 600; color: var(--text-primary);">$1</strong>');
  
  // Lists
  html = html.replace(/^\* (.*$)/gim, '<li class="writer-output-markup li">$1</li>');
  html = html.replace(/^- (.*$)/gim, '<li class="writer-output-markup li">$1</li>');
  
  // Code sections
  html = html.replace(/`(.*?)`/g, '<code style="background-color: var(--bg-app); border: 1px solid var(--border-light); color: var(--accent-color); padding: 2px 4px; border-radius: 4px; font-family: monospace; font-size: 0.75rem;">$1</code>');
  
  // Linebreaks
  html = html.replaceAll('\n', '<br/>');

  return html;
}

const QUICK_STARTS = [
  "Explain transformers and self-attention in simple terms.",
  "How does superposition work in quantum computing?",
  "What is CRISPR-Cas9 and how is it used in editing DNA?",
  "Explain public-key cryptography and asymmetric keys."
];

export default function App() {
  const [query, setQuery] = useState('');
  const [running, setRunning] = useState(false);
  const [chatMessages, setChatMessages] = useState([]);
  
  // Custom API key override (supports multiple comma-separated keys)
  const [userApiKey, setUserApiKey] = useState(() => localStorage.getItem('user_groq_api_key') || '');

  // Dynamic slots: 0 = Llama 3.1 8B, 1 = Gemma 2 9B, 2 = Llama 3.2 3B
  const [activeModelSlot, setActiveModelSlot] = useState(0);
  const [selectedMessageId, setSelectedMessageId] = useState(null);
  
  // Floating panels state
  const [selectedNode, setSelectedNode] = useState(null);
  
  // Connection and Session
  const [wsConnected, setWsConnected] = useState(false);
  const [activeSessionId, setActiveSessionId] = useState(() => `session_${Math.random().toString(36).substr(2, 9)}`);
  
  const wsRef = useRef(null);
  const messagesEndRef = useRef(null);

  // Find currently inspected assistant message
  const activeMessage = useMemo(() => {
    return chatMessages.find(m => m.id === selectedMessageId) || null;
  }, [chatMessages, selectedMessageId]);

  // Derived graph states based on activeMessage and activeModelSlot
  const activeGraphEvents = useMemo(() => {
    if (!activeMessage) return [];
    if (activeModelSlot === 0) return activeMessage.events0 || [];
    if (activeModelSlot === 1) return activeMessage.events1 || [];
    if (activeModelSlot === 2) return activeMessage.events2 || [];
    return [];
  }, [activeMessage, activeModelSlot]);

  const activeGraphCurrentStage = useMemo(() => {
    if (!activeMessage) return 'idle';
    if (activeModelSlot === 0) return activeMessage.currentStage0 || 'idle';
    if (activeModelSlot === 1) return activeMessage.currentStage1 || 'idle';
    if (activeModelSlot === 2) return activeMessage.currentStage2 || 'idle';
    return 'idle';
  }, [activeMessage, activeModelSlot]);

  // Connect to WebSocket
  useEffect(() => {
    connectWS();
    return () => {
      if (wsRef.current) wsRef.current.close();
    };
  }, [activeSessionId, userApiKey]);

  // Scroll to bottom of chat list
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatMessages, running]);

  // Keep inspector panel content updated in real-time if a live run finishes new stages
  useEffect(() => {
    if (!selectedNode || activeGraphEvents.length === 0) return;

    const nodeStageId = selectedNode.id;
    let matchingEvent = null;

    if (nodeStageId === 'planner') {
      matchingEvent = activeGraphEvents.find(e => e.stage === 'planner_revision') || 
                      activeGraphEvents.find(e => e.stage === 'planner');
    } else if (nodeStageId === 'logic_critic') {
      matchingEvent = activeGraphEvents.find(e => e.stage === 'logic_critic_revision') || 
                      activeGraphEvents.find(e => e.stage === 'logic_critic');
    } else {
      matchingEvent = activeGraphEvents.find(e => e.stage === nodeStageId);
    }

    let queryText = activeMessage ? activeMessage.queryRef || "" : "";

    if (matchingEvent) {
      setSelectedNode({
        id: nodeStageId,
        data: {
          label: selectedNode.data.label,
          output: matchingEvent.output,
          input: queryText,
          systemPrompt: matchingEvent.system_prompt,
          userPrompt: matchingEvent.user_prompt,
          rawLlmResponse: matchingEvent.raw_llm_response,
          activeKeyMasked: matchingEvent.active_key_masked,
          providerUsed: matchingEvent.provider_used
        }
      });
    }
  }, [activeGraphEvents, activeMessage, selectedMessageId]);

  const connectWS = () => {
    if (wsRef.current) {
      wsRef.current.close();
    }

    const keyParam = userApiKey ? `?api_key=${encodeURIComponent(userApiKey)}` : '';
    const wsUrl = `ws://localhost:8000/ws/${activeSessionId}${keyParam}`;
    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      setWsConnected(true);
      console.log('Connected to Inside AI WebSocket');
    };

    ws.onclose = () => {
      setWsConnected(false);
      console.log('Disconnected from Inside AI WebSocket');
      setTimeout(connectWS, 3000);
    };

    ws.onerror = (err) => {
      console.error('WebSocket Error:', err);
    };

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      handleWSMessage(data);
    };

    wsRef.current = ws;
  };

  const handleWSMessage = (data) => {
    const slot = data.model_slot_id ?? 0;

    if (data.event === 'stage_start') {
      setChatMessages(prev => prev.map((msg, idx) => {
        if (idx === prev.length - 1 && msg.role === 'assistant') {
          const updated = { ...msg };
          updated[`currentStage${slot}`] = data.stage;
          return updated;
        }
        return msg;
      }));
    } else if (data.event === 'stage_complete') {
      setChatMessages(prev => prev.map((msg, idx) => {
        if (idx === prev.length - 1 && msg.role === 'assistant') {
          const updated = { ...msg };
          updated[`events${slot}`] = [...(updated[`events${slot}`] || []), data];
          if (data.stage === 'logic_critic' || data.stage === 'logic_critic_revision') {
            updated[`confidence${slot}`] = data.output.confidence_score;
          }
          return updated;
        }
        return msg;
      }));
    } else if (data.event === 'token') {
      setChatMessages(prev => prev.map((msg, idx) => {
        if (idx === prev.length - 1 && msg.role === 'assistant') {
          const updated = { ...msg };
          updated[`text${slot}`] = (updated[`text${slot}`] || '') + data.text_chunk;
          return updated;
        }
        return msg;
      }));
    } else if (data.event === 'pipeline_complete') {
      setChatMessages(prev => prev.map((msg, idx) => {
        if (idx === prev.length - 1 && msg.role === 'assistant') {
          const updated = { ...msg };
          updated[`text${slot}`] = data.final_output;
          updated[`totalTime${slot}`] = data.total_duration_ms;
          updated[`confidence${slot}`] = data.confidence_score;
          updated[`currentStage${slot}`] = 'complete';
          updated[`events${slot}`] = [...(updated[`events${slot}`] || []), data];

          // Check if all 3 comparison slots have finished
          const s0Done = updated.currentStage0 === 'complete' || updated.currentStage0 === 'error';
          const s1Done = updated.currentStage1 === 'complete' || updated.currentStage1 === 'error';
          const s2Done = updated.currentStage2 === 'complete' || updated.currentStage2 === 'error';
          
          if (s0Done && s1Done && s2Done) {
            updated.running = false;
            setTimeout(() => setRunning(false), 0);
          }
          return updated;
        }
        return msg;
      }));
    } else if (data.event === 'error') {
      setChatMessages(prev => prev.map((msg, idx) => {
        if (idx === prev.length - 1 && msg.role === 'assistant') {
          const updated = { ...msg };
          updated[`text${slot}`] = `Error: ${data.message}`;
          updated[`currentStage${slot}`] = 'error';

          // Check if all 3 comparison slots have finished
          const s0Done = updated.currentStage0 === 'complete' || updated.currentStage0 === 'error';
          const s1Done = updated.currentStage1 === 'complete' || updated.currentStage1 === 'error';
          const s2Done = updated.currentStage2 === 'complete' || updated.currentStage2 === 'error';
          
          if (s0Done && s1Done && s2Done) {
            updated.running = false;
            setTimeout(() => setRunning(false), 0);
          }
          return updated;
        }
        return msg;
      }));
    }
  };

  const handleSend = (textToSend) => {
    const prompt = textToSend || query;
    if (!prompt.trim() || running) return;

    if (!wsConnected) {
      alert("Offline. Reconnecting to backend...");
      connectWS();
      return;
    }

    // Reset layout for new run
    setSelectedNode(null);
    setSelectedMessageId(null);
    setRunning(true);
    setQuery('');

    const assistantMsgId = `assistant_${Math.random().toString(36).substr(2, 9)}`;

    setChatMessages(prev => [
      ...prev,
      { id: `user_${Date.now()}`, role: 'user', content: prompt },
      { 
        id: assistantMsgId, 
        role: 'assistant', 
        queryRef: prompt,
        running: true,
        // Slot 0 (Llama 3.1 8B)
        text0: '',
        events0: [],
        currentStage0: 'idle',
        totalTime0: null,
        confidence0: null,
        // Slot 1 (Gemma 2 9B)
        text1: '',
        events1: [],
        currentStage1: 'idle',
        totalTime1: null,
        confidence1: null,
        // Slot 2 (Llama 3.2 3B)
        text2: '',
        events2: [],
        currentStage2: 'idle',
        totalTime2: null,
        confidence2: null
      }
    ]);

    setSelectedMessageId(assistantMsgId);
    wsRef.current.send(JSON.stringify({ query: prompt }));
  };

  // Inspect the steps for a past message
  const handleSelectMessageTrace = (msg) => {
    if (running || msg.role !== 'assistant') return;
    setSelectedMessageId(msg.id);
    setSelectedNode(null);
  };

  const handleNodeSelect = (reactflowNode) => {
    const nodeStageId = reactflowNode.id;
    let matchingEvent = null;

    if (nodeStageId === 'planner') {
      matchingEvent = activeGraphEvents.find(e => e.stage === 'planner_revision') || 
                      activeGraphEvents.find(e => e.stage === 'planner');
    } else if (nodeStageId === 'logic_critic') {
      matchingEvent = activeGraphEvents.find(e => e.stage === 'logic_critic_revision') || 
                      activeGraphEvents.find(e => e.stage === 'logic_critic');
    } else {
      matchingEvent = activeGraphEvents.find(e => e.stage === nodeStageId);
    }

    let queryText = activeMessage ? activeMessage.queryRef || "" : "";

    if (matchingEvent) {
      setSelectedNode({
        id: nodeStageId,
        data: {
          label: reactflowNode.data.label,
          output: matchingEvent.output,
          input: queryText,
          systemPrompt: matchingEvent.system_prompt,
          userPrompt: matchingEvent.user_prompt,
          rawLlmResponse: matchingEvent.raw_llm_response,
          activeKeyMasked: matchingEvent.active_key_masked,
          providerUsed: matchingEvent.provider_used
        }
      });
    } else if (nodeStageId === 'user_query') {
      setSelectedNode({
        id: 'user_query',
        data: {
          label: 'Client Input',
          output: { core_question: queryText },
          input: queryText
        }
      });
    } else {
      setSelectedNode({
        id: nodeStageId,
        data: {
          label: reactflowNode.data.label,
          output: null,
          input: queryText
        }
      });
    }
  };

  // Derived active metrics per active model slot
  const activeMetrics = useMemo(() => {
    if (!activeMessage) return null;
    return {
      events: activeMessage[`events${activeModelSlot}`] || [],
      totalTime: activeMessage[`totalTime${activeModelSlot}`],
      confidence: activeMessage[`confidence${activeModelSlot}`],
      currentStage: activeMessage[`currentStage${activeModelSlot}`]
    };
  }, [activeMessage, activeModelSlot]);

  return (
    <div className="app-container">
      {/* Header */}
      <header className="header">
        <div className="brand-container">
          <h1 className="brand">Inside AI</h1>
          <span className="version-badge">Live Transparent pipeline</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <input
            type="password"
            value={userApiKey}
            onChange={(e) => {
              setUserApiKey(e.target.value);
              localStorage.setItem('user_groq_api_key', e.target.value);
            }}
            placeholder="Override keys: key1,key2,key3 (optional)"
            style={{
              fontSize: '0.72rem',
              padding: '6px 12px',
              width: 210,
              border: '1px solid var(--border-light)',
              borderRadius: '6px',
              outline: 'none',
              background: '#ffffff',
              color: 'var(--text-primary)',
              fontFamily: 'monospace',
              transition: 'border-color 0.2s',
            }}
          />
          {wsConnected ? (
            <div className="connection-status connected">
              <Wifi style={{ width: 12, height: 12 }} />
              <span>Connected</span>
            </div>
          ) : (
            <div className="connection-status disconnected">
              <WifiOff style={{ width: 12, height: 12 }} />
              <span>Offline (Reconnecting)</span>
            </div>
          )}
        </div>
      </header>

      {/* Main Layout */}
      <main className="main-layout">
        
        {/* Left Panel: Continuous Chatbot */}
        <section className="chat-column">
          <div className="chat-header-section">
            <span className="chat-header-title">
              <Terminal style={{ width: 13, height: 13, color: 'var(--text-secondary)' }} />
              <span>Pipeline chat</span>
            </span>
          </div>

          <div className="chat-messages-container">
            {chatMessages.length === 0 ? (
              <div className="chat-welcome-container">
                <div className="chat-welcome-logo">
                  <Sparkles size={20} />
                </div>
                <h2 className="chat-welcome-title">Watch the AI Think</h2>
                <p className="chat-welcome-desc">
                  Ask a question to see the 6-stage orchestration pipeline retrieve documents, draft plans, critique itself, and generate output.
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, width: '100%', marginTop: 24 }}>
                  {QUICK_STARTS.map((qs, i) => (
                    <button
                      key={i}
                      onClick={() => handleSend(qs)}
                      className="history-item"
                      style={{ padding: '10px 12px' }}
                    >
                      <span className="history-query" style={{ fontSize: '0.74rem' }}>{qs}</span>
                      <ChevronRight size={14} style={{ color: 'var(--text-muted)' }} />
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              chatMessages.map((msg) => (
                <div key={msg.id} className={`chat-message-row ${msg.role}`}>
                  <div 
                    className={`chat-bubble ${msg.role} ${selectedMessageId === msg.id ? 'selected-chat-bubble' : ''}`}
                    onClick={() => handleSelectMessageTrace(msg)}
                    style={{ 
                      cursor: msg.role === 'assistant' ? 'pointer' : 'default',
                      border: selectedMessageId === msg.id ? '1px solid var(--accent-color)' : ''
                    }}
                  >
                    {msg.role === 'user' ? (
                      <p style={{ margin: 0 }}>{msg.content}</p>
                    ) : (
                      <>
                        {/* Model Comparison Tabs inside Chat Bubble */}
                        <div className="model-tabs-bar" onClick={(e) => e.stopPropagation()}>
                          {[
                            { name: "Llama 3.1 8B", slotId: 0 },
                            { name: "Gemma 2 9B", slotId: 1 },
                            { name: "Llama 3.2 3B", slotId: 2 }
                          ].map((tab) => {
                            const isCurrent = activeModelSlot === tab.slotId;
                            const slotStage = msg[`currentStage${tab.slotId}`];
                            const slotRunning = msg.running && slotStage !== 'complete' && slotStage !== 'error';
                            
                            let dotBgColor = '#cbcbcd';
                            let isPulsing = false;
                            
                            if (slotRunning) {
                              dotBgColor = 'var(--accent-color)';
                              isPulsing = true;
                            } else if (slotStage === 'complete') {
                              dotBgColor = 'var(--success-color)';
                            } else if (slotStage === 'error') {
                              dotBgColor = 'var(--error-color)';
                            }
                            
                            return (
                              <button
                                key={tab.slotId}
                                className={`model-tab-btn ${isCurrent ? 'active' : ''}`}
                                onClick={() => {
                                  setActiveModelSlot(tab.slotId);
                                  setSelectedMessageId(msg.id);
                                }}
                              >
                                <span className={`status-dot ${isPulsing ? 'pulsing' : ''}`} style={{ backgroundColor: dotBgColor }} />
                                <span>{tab.name}</span>
                              </button>
                            );
                          })}
                        </div>

                        {/* Slot-specific Content */}
                        {(() => {
                          const text = msg[`text${activeModelSlot}`] || '';
                          const stage = msg[`currentStage${activeModelSlot}`] || 'idle';
                          const isRunningSlot = msg.running && stage !== 'complete' && stage !== 'error';
                          
                          if (isRunningSlot && !text) {
                            return (
                              <div className="chat-thinking-indicator" style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.74rem', color: 'var(--text-secondary)', padding: '10px 0' }}>
                                <Loader className="spinner" size={12} style={{ animation: 'spin 2s linear infinite' }} />
                                <span>Orchestrating pipeline... ({stage === 'idle' ? 'Starting' : stage})</span>
                              </div>
                            );
                          }
                          
                          return (
                            <div 
                              className="writer-output-markup"
                              dangerouslySetInnerHTML={{ __html: renderMarkdown(text || 'Initializing model run...') }}
                            />
                          );
                        })()}

                        {/* Slot-specific Footer */}
                        {(() => {
                          const stage = msg[`currentStage${activeModelSlot}`];
                          const totalTime = msg[`totalTime${activeModelSlot}`];
                          const confidence = msg[`confidence${activeModelSlot}`];
                          
                          if (!msg.running && stage === 'complete') {
                            return (
                              <div className="chat-bubble-footer">
                                <span className="chat-trace-btn">
                                  <Cpu size={11} />
                                  <span>{selectedMessageId === msg.id ? 'Viewing Thinking Graph' : 'Click to inspect steps'}</span>
                                </span>
                                <span className="chat-trace-meta">
                                  {totalTime ? `${(totalTime / 1000).toFixed(2)}s` : ''} 
                                  {confidence !== undefined && confidence !== null ? ` • Score: ${confidence}%` : ''}
                                </span>
                              </div>
                            );
                          }
                          return null;
                        })()}
                      </>
                    )}
                  </div>
                </div>
              ))
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Chat input box */}
          <div className="chat-input-area">
            <form 
              onSubmit={(e) => { e.preventDefault(); handleSend(); }} 
              className="chat-input-wrapper"
            >
              <textarea
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                placeholder="Ask a technical or general question..."
                disabled={running}
                rows={2}
                className="chat-textbox"
              />
              <button 
                type="submit" 
                disabled={running || !query.trim()}
                className="chat-send-btn"
              >
                <Send size={16} />
              </button>
            </form>
          </div>
        </section>

        {/* Right Panel: Interactive Graph & Metrics */}
        <section className="canvas-container">
          
          {/* Floating Live thinking indicator */}
          {running && (
            <div className="thinking-status-floating">
              <span className="pulse-dot">
                <span className="pulse-ping active"></span>
                <span className="pulse-core active"></span>
              </span>
              <span className="thinking-status-text">
                Thinking: {activeGraphCurrentStage.replace('_', ' ')}
              </span>
            </div>
          )}

          {/* Floating metrics summary panel */}
          {activeMetrics && !activeMetrics.running && activeMetrics.events?.length > 0 && (
            <div className="metrics-panel-floating">
              <MetricsPanel 
                events={activeMetrics.events} 
                totalTime={activeMetrics.totalTime} 
                confidence={activeMetrics.confidence} 
              />
            </div>
          )}

          {/* React Flow node graph */}
          <FlowGraph 
            events={activeGraphEvents} 
            currentStage={activeGraphCurrentStage} 
            onNodeSelect={handleNodeSelect}
            selectedNodeId={selectedNode?.id}
            activeModelSlot={activeModelSlot}
            setActiveModelSlot={setActiveModelSlot}
          />

          {/* Inspector Panel */}
          {selectedNode && (
            <InspectorPanel 
              node={selectedNode} 
              onClose={() => setSelectedNode(null)} 
            />
          )}
        </section>
      </main>
    </div>
  );
}
