import React, { useMemo } from 'react';
import { 
  ReactFlow, 
  Background, 
  Controls, 
  Position,
  Handle
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { 
  Sparkles, 
  BrainCircuit, 
  Database, 
  Layout, 
  Activity, 
  PenTool, 
  Search, 
  CheckCircle,
  Clock,
  AlertCircle
} from 'lucide-react';

// Custom Node component inside React Flow
const CustomNode = ({ data, id }) => {
  const { label, desc, status, duration } = data;
  
  const getIcon = () => {
    switch (id) {
      case 'user_query': return <Search size={15} style={{ color: 'var(--accent-color)' }} />;
      case 'intent_analyzer': return <Sparkles size={15} style={{ color: 'var(--accent-color)' }} />;
      case 'memory': return <BrainCircuit size={15} style={{ color: '#8b5cf6' }} />;
      case 'knowledge_retrieval': return <Database size={15} style={{ color: 'var(--accent-color)' }} />;
      case 'planner': return <Layout size={15} style={{ color: '#6d28d9' }} />;
      case 'logic_critic': return <Activity size={15} style={{ color: 'var(--success-color)' }} />;
      case 'writer': return <PenTool size={15} style={{ color: '#db2777' }} />;
      default: return <Clock size={15} style={{ color: 'var(--text-secondary)' }} />;
    }
  };

  return (
    <div className="node-inner">
      {/* Handles for connections (Hidden visually via opacity: 0 but functional as anchor points) */}
      {id !== 'user_query' && (
        <Handle type="target" position={Position.Top} style={{ opacity: 0 }} />
      )}
      
      <div className="node-header">
        {getIcon()}
        <span>{label}</span>
        {status === 'success' && <CheckCircle size={14} style={{ color: 'var(--success-color)', marginLeft: 'auto', flexShrink: 0 }} />}
        {status === 'warning' && <AlertCircle size={14} style={{ color: 'var(--warning-color)', marginLeft: 'auto', flexShrink: 0 }} />}
        {status === 'error' && <AlertCircle size={14} style={{ color: 'var(--error-color)', marginLeft: 'auto', flexShrink: 0 }} />}
      </div>
      
      <div className="node-desc">{desc}</div>

      {duration !== undefined && (
        <span className="node-badge duration">
          {duration < 1000 ? `${Math.round(duration)}ms` : `${(duration/1000).toFixed(2)}s`}
        </span>
      )}

      {id === 'user_query' && (
        <Handle type="source" position={Position.Bottom} style={{ opacity: 0 }} />
      )}
      {id === 'intent_analyzer' && (
        <>
          <Handle type="source" id="left" position={Position.Bottom} style={{ left: '25%', opacity: 0 }} />
          <Handle type="source" id="right" position={Position.Bottom} style={{ left: '75%', opacity: 0 }} />
        </>
      )}
      {(id === 'memory' || id === 'knowledge_retrieval') && (
        <Handle type="source" position={Position.Bottom} style={{ opacity: 0 }} />
      )}
      {id === 'planner' && (
        <>
          <Handle type="source" id="planner-out" position={Position.Bottom} style={{ left: '50%', opacity: 0 }} />
          <Handle type="target" id="feedback-in" position={Position.Bottom} style={{ left: '80%', opacity: 0 }} />
        </>
      )}
      {id === 'logic_critic' && (
        <>
          <Handle type="source" id="logic-out" position={Position.Bottom} style={{ left: '50%', opacity: 0 }} />
          <Handle type="source" id="feedback-out" position={Position.Bottom} style={{ left: '80%', opacity: 0 }} />
        </>
      )}
      {id === 'writer' && (
        <Handle type="source" position={Position.Bottom} style={{ opacity: 0 }} />
      )}
    </div>
  );
};

export default function FlowGraph({ 
  events, 
  currentStage, 
  onNodeSelect, 
  selectedNodeId
}) {
  const nodeTypes = useMemo(() => ({ custom: CustomNode }), []);

  const nodes = useMemo(() => {
    const findStageEvent = (stageName) => events.find(e => e.stage === stageName && e.event === 'stage_complete');
    const isStageActive = (stageName) => currentStage === stageName;
    
    const getStageState = (stageName) => {
      const active = isStageActive(stageName);
      const completeEvent = findStageEvent(stageName);
      
      let status = 'idle';
      let duration = undefined;
      let output = undefined;
      
      if (completeEvent) {
        status = 'success';
        duration = completeEvent.duration_ms;
        output = completeEvent.output;
      } else if (active) {
        status = 'running';
      }

      if (stageName === 'logic_critic') {
        const completeCritic = findStageEvent('logic_critic');
        if (completeCritic && !completeCritic.output.plan_approved) {
          status = 'warning';
        }
      }
      
      if (stageName === 'planner') {
        const revision = findStageEvent('planner_revision');
        if (revision) {
          duration = (duration || 0) + revision.duration_ms;
          output = revision.output;
        }
      }
      if (stageName === 'logic_critic') {
        const revision = findStageEvent('logic_critic_revision');
        if (revision) {
          duration = (duration || 0) + revision.duration_ms;
          output = revision.output;
          status = revision.output.plan_approved ? 'success' : 'warning';
        }
      }

      return { active, status, duration, output };
    };

    const intentState = getStageState('intent_analyzer');
    const memoryState = getStageState('memory');
    const kbState = getStageState('knowledge_retrieval');
    const plannerState = getStageState('planner');
    const criticState = getStageState('logic_critic');
    const writerState = getStageState('writer');

    const querySubmitted = events.length > 0;
    const queryNodeState = querySubmitted ? 'success' : 'idle';

    const rawNodes = [
      {
        id: 'user_query',
        type: 'custom',
        position: { x: 250, y: 30 },
        data: { 
          label: 'Client Input', 
          desc: 'Target query triggers orchestrator execution',
          status: queryNodeState,
          active: currentStage === 'client_query'
        }
      },
      {
        id: 'intent_analyzer',
        type: 'custom',
        position: { x: 250, y: 150 },
        data: { 
          label: '1. Intent Analyzer', 
          desc: 'Classifies task intent & plans dependencies',
          ...intentState
        }
      },
      {
        id: 'memory',
        type: 'custom',
        position: { x: 0, y: 270 },
        data: { 
          label: '2. Session Memory', 
          desc: 'Resolves past history context matches',
          ...memoryState
        }
      },
      {
        id: 'knowledge_retrieval',
        type: 'custom',
        position: { x: 500, y: 270 },
        data: { 
          label: '3. Vector Search (RAG)', 
          desc: 'Retrieves local ChromaDB seed files',
          ...kbState
        }
      },
      {
        id: 'planner',
        type: 'custom',
        position: { x: 250, y: 390 },
        data: { 
          label: '4. Response Planner', 
          desc: 'Outlines strategy & structured sections',
          ...plannerState
        }
      },
      {
        id: 'logic_critic',
        type: 'custom',
        position: { x: 250, y: 510 },
        data: { 
          label: '5. Logical Critic', 
          desc: 'Checks alignment & scores response quality',
          ...criticState
        }
      },
      {
        id: 'writer',
        type: 'custom',
        position: { x: 250, y: 630 },
        data: { 
          label: '6. Output Writer', 
          desc: 'Synthesizes plan context & streams output',
          ...writerState
        }
      }
    ];

    // Map rawNodes and apply standard wrapper classNames to style the outer wrapper div
    return rawNodes.map(n => {
      const stageState = n.id === 'user_query' ? { status: queryNodeState, active: currentStage === 'client_query' } : getStageState(n.id);
      
      const statusClass = stageState.status || 'idle';
      const activeClass = stageState.active ? 'active' : '';
      const selectedClass = n.id === selectedNodeId ? 'selected-node-border' : '';
      
      return {
        ...n,
        className: `custom-node-wrapper ${statusClass} ${activeClass} ${selectedClass}`,
        data: {
          ...n.data,
          ...stageState
        }
      };
    });
  }, [events, currentStage, selectedNodeId]);

  const edges = useMemo(() => {
    const isEdgeActive = (source, target) => {
      const sourceComplete = events.some(e => e.stage === source && e.event === 'stage_complete');
      const targetActive = currentStage === target || events.some(e => e.stage === target && e.event === 'stage_start');
      return sourceComplete && targetActive;
    };

    const getEdgeClass = (source, target) => {
      const active = isEdgeActive(source, target);
      const complete = events.some(e => e.stage === target && e.event === 'stage_complete');
      if (active) return 'active';
      if (complete) return 'success';
      return '';
    };

    const baseEdges = [
      { 
        id: 'eq-intent', 
        source: 'user_query', 
        target: 'intent_analyzer',
        className: getEdgeClass('user_query', 'intent_analyzer')
      },
      { 
        id: 'ei-memory', 
        source: 'intent_analyzer', 
        target: 'memory', 
        sourceHandle: 'left',
        className: getEdgeClass('intent_analyzer', 'memory')
      },
      { 
        id: 'ei-kb', 
        source: 'intent_analyzer', 
        target: 'knowledge_retrieval', 
        sourceHandle: 'right',
        className: getEdgeClass('intent_analyzer', 'knowledge_retrieval')
      },
      { 
        id: 'em-planner', 
        source: 'memory', 
        target: 'planner',
        className: getEdgeClass('memory', 'planner')
      },
      { 
        id: 'ek-planner', 
        source: 'knowledge_retrieval', 
        target: 'planner',
        className: getEdgeClass('knowledge_retrieval', 'planner')
      },
      { 
        id: 'ep-critic', 
        source: 'planner', 
        target: 'logic_critic', 
        sourceHandle: 'planner-out',
        className: getEdgeClass('planner', 'logic_critic')
      },
      { 
        id: 'ec-writer', 
        source: 'logic_critic', 
        target: 'writer', 
        sourceHandle: 'logic-out',
        className: getEdgeClass('logic_critic', 'writer')
      }
    ];

    const hasRevision = events.some(e => e.stage === 'planner_revision');
    if (hasRevision) {
      baseEdges.push({
        id: 'ec-feedback',
        source: 'logic_critic',
        target: 'planner',
        sourceHandle: 'feedback-out',
        targetHandle: 'feedback-in',
        type: 'smoothstep',
        className: 'active',
        style: { stroke: 'var(--warning-color)', strokeWidth: 1.5, strokeDasharray: 4 },
        label: 'Critic Feedback Loop',
        labelStyle: { fill: 'var(--warning-color)', fontSize: 9, fontWeight: 500 }
      });
    }

    return baseEdges.map(edge => {
      const isSelected = selectedNodeId && (edge.source === selectedNodeId || edge.target === selectedNodeId);
      return {
        ...edge,
        className: `${edge.className} ${isSelected ? 'selected' : ''}`
      };
    });
  }, [events, currentStage, selectedNodeId]);

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodeClick={(e, node) => onNodeSelect(node)}
        fitView
        fitViewOptions={{ padding: 0.15 }}
        minZoom={0.5}
        maxZoom={1.5}
      >
        <Background color="rgba(0, 0, 0, 0.03)" gap={16} size={1} />
        <Controls showInteractive={false} />
      </ReactFlow>
    </div>
  );
}
