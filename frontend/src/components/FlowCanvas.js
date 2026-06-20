import React, { useState, useCallback, memo, useEffect } from 'react';
import ReactFlow, { 
  Background, 
  Controls, 
  applyNodeChanges, 
  applyEdgeChanges,
  addEdge,
  Handle,
  Position,
  NodeResizer 
} from 'reactflow';
import 'reactflow/dist/style.css';

// --- Nuclear Error Suppression ---
if (typeof window !== 'undefined') {
  window.addEventListener('error', (e) => {
    if (e.message.includes('ResizeObserver')) {
      e.stopImmediatePropagation();
      e.preventDefault();
    }
  });

  const RO = window.ResizeObserver;
  window.ResizeObserver = class ResizeObserver extends RO {
    constructor(callback) {
      super((entries, observer) => {
        window.requestAnimationFrame(() => {
          if (!Array.isArray(entries) || !entries.length) return;
          callback(entries, observer);
        });
      });
    }
  };
}

// --- Custom Node Component ---
const FlowchartNode = memo(({ id, data, selected }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [tempLabel, setTempLabel] = useState(data.label);

  const onLabelChange = (evt) => {
    setTempLabel(evt.target.value);
    if (data.onChange) {
      data.onChange(id, evt.target.value);
    }
  };

  return (
    <div 
      style={{ width: '100%', height: '100%', position: 'relative' }} 
      onDoubleClick={() => setIsEditing(true)}
    >
      <NodeResizer color="#3b82f6" isVisible={selected} minWidth={60} minHeight={40} />
      
      <Handle type="target" position={Position.Top} id="t" style={{ background: '#555', zIndex: 10 }} />
      <Handle type="source" position={Position.Bottom} id="b" style={{ background: '#555', zIndex: 10 }} />
      <Handle type="source" position={Position.Left} id="l" style={{ background: '#555', zIndex: 10 }} />
      <Handle type="source" position={Position.Right} id="r" style={{ background: '#555', zIndex: 10 }} />
      
      <div style={{ 
        ...data.shapeStyle, 
        width: '100%', 
        height: '100%', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center' 
      }}>
        {isEditing ? (
          <input
            value={tempLabel}
            onChange={onLabelChange}
            onBlur={() => setIsEditing(false)}
            autoFocus
            style={{ 
              background: 'transparent', 
              border: '1px solid white', 
              color: 'white', 
              textAlign: 'center', 
              width: '80%',
              outline: 'none',
              fontSize: '12px'
            }}
          />
        ) : (
          <div style={{ userSelect: 'none', textAlign: 'center', padding: '5px', fontSize: '12px' }}>
            {data.label}
          </div>
        )}
      </div>
    </div>
  );
});

const shapeStyles = {
  Terminal: { borderRadius: '25px', background: '#3b82f6', color: 'white', border: '2px solid #1e40af' },
  Process: { borderRadius: '0px', background: '#3b82f6', color: 'white', border: '2px solid #1e40af' },
  Decision: { clipPath: 'polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)', background: '#3b82f6', color: 'white' },
  IO: { clipPath: 'polygon(15% 0%, 100% 0%, 85% 100%, 0% 100%)', background: '#3b82f6', color: 'white' }
};

const nodeTypes = { custom: FlowchartNode };

// Styling Object Maps
const btnStyle = { padding: '8px', cursor: 'pointer', border: '1px solid #3b82f6', borderRadius: '4px', background: 'white', fontSize: '12px', textAlign: 'center' };
const activeTabBtn = { flex: 1, padding: '8px 4px', fontSize: '11px', fontWeight: 'bold', border: 'none', background: '#3b82f6', color: 'white', cursor: 'pointer', borderRadius: '4px' };
const inactiveTabBtn = { flex: 1, padding: '8px 4px', fontSize: '11px', border: '1px solid #ccc', background: '#f1f5f9', color: '#475569', cursor: 'pointer', borderRadius: '4px' };
const compileBtn = { padding: '10px', background: '#22c55e', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', fontSize: '13px' };
const clearBtn = { padding: '8px', background: '#ef4444', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' };

export default function FlowCanvas({ onCompile }) {
  const [nodes, setNodes] = useState(() => JSON.parse(localStorage.getItem('flow-nodes')) || []);
  const [edges, setEdges] = useState(() => JSON.parse(localStorage.getItem('flow-edges')) || []);
  const [history, setHistory] = useState([]);

  const [menuMode, setMenuMode] = useState("shapes"); 
  const [aiPrompt, setAiPrompt] = useState("");
  const [quickText, setQuickText] = useState("");
  const [lintErrors, setLintErrors] = useState([]);

  const saveToHistory = useCallback(() => {
    setHistory((prev) => [...prev, { nodes: JSON.parse(JSON.stringify(nodes)), edges: JSON.parse(JSON.stringify(edges)) }].slice(-20));
  }, [nodes, edges]);

  const updateNodeLabel = useCallback((nodeId, newLabel) => {
    setNodes((nds) =>
      nds.map((node) => node.id === nodeId ? { ...node, data: { ...node.data, label: newLabel } } : node)
    );
  }, []);

  useEffect(() => {
    setNodes((nds) => nds.map(node => ({
      ...node,
      data: { ...node.data, onChange: updateNodeLabel }
    })));
  }, [updateNodeLabel]);

  useEffect(() => {
    const handleKeyDown = (event) => {
      if ((event.ctrlKey || event.metaKey) && event.key === 'z') {
        if (history.length > 0) {
          const lastState = history[history.length - 1];
          setNodes(lastState.nodes);
          setEdges(lastState.edges);
          setHistory((prev) => prev.slice(0, -1));
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [history]);

  useEffect(() => {
    localStorage.setItem('flow-nodes', JSON.stringify(nodes));
    localStorage.setItem('flow-edges', JSON.stringify(edges));
  }, [nodes, edges]);

  const onNodesChange = useCallback((changes) => setNodes((nds) => applyNodeChanges(changes, nds)), []);
  const onEdgesChange = useCallback((changes) => setEdges((eds) => applyEdgeChanges(changes, eds)), []);

  const onEdgesDelete = useCallback((edgesToDelete) => {
    saveToHistory();
    setEdges((eds) => applyEdgeChanges(edgesToDelete.map(e => ({ id: e.id, type: 'remove' })), eds));
  }, [saveToHistory]);

  const onConnect = useCallback((params) => {
    saveToHistory();
    const sourceNode = nodes.find((n) => n.id === params.source);
    const isDecision = sourceNode?.data?.shapeStyle?.clipPath?.includes('50% 0%');

    let label = "";
    if (isDecision) {
      label = prompt("Enter path label (e.g., Yes/No):") || "";
    }

    setEdges((eds) => addEdge({ 
      ...params, 
      label, 
      type: 'step', 
      animated: false,
      labelStyle: { fill: '#333333', fontWeight: 700 },
      style: { 
        strokeWidth: 2, 
        stroke: '#000000', 
        strokeDasharray: '0' 
      }
    }, eds));
  }, [nodes, saveToHistory]);

  const addShape = (type, customText = null) => {
    saveToHistory();
    const id = `node_${Date.now()}`;
    const text = customText !== null ? customText : (prompt(`Enter text for ${type}:`) || type);

    const newNode = {
      id,
      type: 'custom',
      position: { x: 250, y: 150 },
      data: { 
        label: text, 
        shapeStyle: shapeStyles[type],
        onChange: updateNodeLabel
      },
      style: { width: 150, height: 80 } 
    };
    setNodes((nds) => nds.concat(newNode));
  };

  const clearCanvas = () => {
    if (window.confirm("Clear entire canvas?")) {
      saveToHistory();
      setNodes([]);
      setEdges([]);
    }
  };

 const generateWithAI = async () => {
    if (!aiPrompt) return;
    try {
      const res = await fetch('http://localhost:5000/api/generate-flowchart', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: aiPrompt })
      });
      const data = await res.json();
      if (data.nodes) {
        saveToHistory();
        
        let decisionNode = null;
        let yesBranchNode = null;
        let noBranchNode = null;
        let inputNode = null;
        let stopNode = null;
        let startNode = null;
        
        // 1. --- STABILIZE LEXICAL TEXT RECOGNITION RULES ---
        const processedNodes = data.nodes.map((n, idx) => {
          let cleanLabel = (n.label || n.data?.label || "").trim();
          const lowerLabel = cleanLabel.toLowerCase();
          let shape = 'Process';

          // Rule A: Master Scoping Terminals
          if (lowerLabel === 'start' || lowerLabel === 'stop' || lowerLabel === 'end') {
            shape = 'Terminal';
            cleanLabel = lowerLabel === 'start' ? 'START' : 'STOP';
          } 
          // Rule B: Variable Suffix Extraction Parsing Logic (Protects label.split()[-1])
          else if (lowerLabel.startsWith('input') || lowerLabel.startsWith('read')) {
            shape = 'IO';
            let parts = cleanLabel.replace(/[:;]/g, '').split(/\s+/);
            let varName = parts[parts.length - 1] || 'x';

            if (lowerLabel.includes('string') || lowerLabel.includes('text')) {
              cleanLabel = `INPUTS ${varName}`; // Safely trips \binput[sS]\b regex
            } else if (lowerLabel.includes('char') || lowerLabel.includes('letter')) {
              cleanLabel = `INPUTC ${varName}`; // Safely trips \binput[cC]\b regex
            } else {
              cleanLabel = `INPUT ${varName}`;  // Defaults safely to Float evaluations
            }
          } 
          // Rule C: Output Global Normalization
          else if (lowerLabel.startsWith('print') || lowerLabel.startsWith('output')) {
            shape = 'IO';
            let printContent = cleanLabel.replace(/^(print|output)[:\s]*/i, '').trim();
            cleanLabel = `PRINT ${printContent}`;
          } 
          // Rule D: Decision Block Expressions
          else if (lowerLabel.endsWith('?') || lowerLabel.startsWith('if ') || lowerLabel.startsWith('is ')) {
            shape = 'Decision';
            let conditionExpression = cleanLabel.replace(/^(if|is)[:\s]*/i, '').replace(/\?$/, '').trim();
            cleanLabel = `IF ${conditionExpression}`;
          } 
          // Rule E: Pure Mathematical Process Assignments
          else if (cleanLabel.includes('=')) {
            shape = 'Process';
            cleanLabel = cleanLabel.replace(/;$/, '').trim(); // Remove trailing semicolons for clean .isidentifier() evaluation
          }

          return {
            id: n.id || `node_ai_${idx}_${Date.now()}`,
            label: cleanLabel,
            shape: shape
          };
        });

        // Identify key architectural nodes to build structural paths
        startNode = processedNodes.find(n => n.label === 'START');
        stopNode = processedNodes.find(n => n.label === 'STOP');
        inputNode = processedNodes.find(n => n.label.startsWith('INPUT'));
        decisionNode = processedNodes.find(n => n.shape === 'Decision');

        // If a decision block exists, identify its branches from raw data
        if (decisionNode) {
          const nonTerminals = processedNodes.filter(n => n.shape !== 'Terminal' && n.id !== decisionNode.id && n.id !== inputNode?.id);
          if (nonTerminals.length > 0) yesBranchNode = nonTerminals[0];
          if (nonTerminals.length > 1) noBranchNode = nonTerminals[1];
        }

        // 2. --- GENERATE BALANCED GRID PLACEMENT CANVAS COORDINATES ---
        const finalNodes = [];
        const finalEdges = [];
        let currentY = 50;

        // Ensure nodes are pushed into the graph viewport predictably
        const pushNodeToGraph = (node, customX = 300, yOffset = 130) => {
          if (!node) return;
          finalNodes.push({
            id: node.id,
            type: 'custom',
            position: { x: customX, y: currentY },
            style: { width: 150, height: 75 },
            data: {
              label: node.label,
              shapeStyle: shapeStyles[node.shape] || shapeStyles.Process,
              onChange: updateNodeLabel
            }
          });
          if (customX === 300) currentY += yOffset; // Only push vertical height down if on the main trunk line
        };

        // Layout Render Pipeline order matching execution flow sequence
        pushNodeToGraph(startNode);
        pushNodeToGraph(inputNode);
        
        if (decisionNode) {
          pushNodeToGraph(decisionNode, 300, 160);
          
          // Render Left/Right split branches side by side matching grid offset metrics
          if (yesBranchNode) pushNodeToGraph(yesBranchNode, 120, 0);
          if (noBranchNode) pushNodeToGraph(noBranchNode, 480, 0);
          
          currentY += 140; // Advance row layout beyond the conditional split block boundary
        } else {
          // If no structural condition blocks exist, cleanly push downstream operational blocks
          processedNodes.forEach(node => {
            if (node.label !== 'START' && node.label !== 'STOP' && node.label !== inputNode?.id) {
              pushNodeToGraph(node);
            }
          });
        }
        
        pushNodeToGraph(stopNode);

        // 3. --- EDGE GENERATION MAPPED TO DETECT_NEXT GRAPH TRAVERSAL ---
        if (startNode && inputNode) {
          finalEdges.push({ id: `e_start_in`, source: startNode.id, target: inputNode.id, type: 'step' });
        }

        if (decisionNode) {
          if (inputNode) {
            finalEdges.push({ id: `e_in_dec`, source: inputNode.id, target: decisionNode.id, type: 'step' });
          }

          // Left Condition Path Routing (Maps directly to edge filtering lookups: "YES")
          if (yesBranchNode) {
            finalEdges.push({
              id: `e_dec_yes`,
              source: decisionNode.id,
              target: yesBranchNode.id,
              type: 'step',
              label: 'YES', // Must be exact case-insensitive match for edge filter logic
              sourceHandle: 'l',
              targetHandle: 't',
              labelStyle: { fill: '#22c55e', fontWeight: 800 },
              style: { strokeWidth: 2, stroke: '#000' }
            });
            if (stopNode) {
              finalEdges.push({ id: `e_yes_stop`, source: yesBranchNode.id, target: stopNode.id, type: 'step', sourceHandle: 'b', targetHandle: 't' });
            }
          }

          // Right Condition Path Routing (Maps directly to edge filtering lookups: "NO")
          if (noBranchNode) {
            finalEdges.push({
              id: `e_dec_no`,
              source: decisionNode.id,
              target: noBranchNode.id,
              type: 'step',
              label: 'NO', // Must be exact case-insensitive match for edge filter logic
              sourceHandle: 'r',
              targetHandle: 't',
              labelStyle: { fill: '#ef4444', fontWeight: 800 },
              style: { strokeWidth: 2, stroke: '#000' }
            });
            if (stopNode) {
              finalEdges.push({ id: `e_no_stop`, source: noBranchNode.id, target: stopNode.id, type: 'step', sourceHandle: 'b', targetHandle: 't' });
            }
          } else if (stopNode) {
            // Direct Fallback path if an else block path is omitted
            finalEdges.push({ id: `e_dec_no_fallback`, source: decisionNode.id, target: stopNode.id, type: 'step', label: 'NO', sourceHandle: 'r', targetHandle: 't' });
          }
        } else {
          // Continuous standard sequence array linking (No Condition Blocks present)
          for (let i = 0; i < finalNodes.length - 1; i++) {
            finalEdges.push({
              id: `edge_ai_${i}_${Date.now()}`,
              source: finalNodes[i].id,
              target: finalNodes[i+1].id,
              type: 'step',
              style: { strokeWidth: 2, stroke: '#000000' }
            });
          }
        }

        setNodes(finalNodes);
        setEdges(finalEdges);

        // 4. --- TRIPPED AST LINTER RUN PREDICTION MATRIX ---
        setTimeout(() => {
          runPredictiveLint();
        }, 150);
      }
    } catch (err) {
      console.error("AI Generation layout orchestration fault: ", err);
    }
  };

  const handleQuickNode = async () => {
    if (!quickText) return;
    try {
      const res = await fetch('http://localhost:5000/api/predict-shape', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: quickText })
      });
      const data = await res.json();
      addShape(data.shape, quickText);
      setQuickText("");
    } catch (err) {
      console.error("Prediction error: ", err);
    }
  };

  const runPredictiveLint = async () => {
    try {
      const res = await fetch('http://localhost:5000/api/lint-flowchart', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nodes, edges })
      });
      const data = await res.json();
      setLintErrors(data.issues || []);
      return data.issues || [];
    } catch (err) {
      console.error("Lint failure: ", err);
      return [];
    }
  };

  return (
    <div style={{ display: 'flex', height: '82vh', border: '1px solid #ddd', fontFamily: 'sans-serif' }}>
      {/* SIDEBAR CONTAINER */}
      <div style={{ width: '240px', padding: '12px', background: '#f8f9fa', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', borderRight: '1px solid #eee', overflowY: 'auto' }}>
        
        <div>
          {/* INTERACTIVE MODE SELECTOR MENU */}
          <div style={{ display: 'flex', gap: '5px', marginBottom: '15px', background: '#e2e8f0', padding: '3px', borderRadius: '6px' }}>
            <button 
              onClick={() => setMenuMode("shapes")} 
              style={menuMode === "shapes" ? activeTabBtn : inactiveTabBtn}
            >
              Manual Shapes
            </button>
            <button 
              onClick={() => setMenuMode("predictive")} 
              style={menuMode === "predictive" ? activeTabBtn : inactiveTabBtn}
            >
              Predictive Drop
            </button>
          </div>

          {/* MODE 1: MANUAL CANVAS SHAPE TOOLBOX */}
          {menuMode === "shapes" && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <h4 style={{ margin: '0 0 4px 0', fontSize: '12px', color: '#475569', textTransform: 'uppercase' }}>Standard Blocks</h4>
              <button onClick={() => addShape('Terminal')} style={btnStyle}>Start / Stop</button>
              <button onClick={() => addShape('Process')} style={btnStyle}>Process Rectangle</button>
              <button onClick={() => addShape('Decision')} style={btnStyle}>Decision Diamond</button>
              <button onClick={() => addShape('IO')} style={btnStyle}>I/O Parallelogram</button>
            </div>
          )}

          {/* MODE 2: PREDICTIVE DROP + SYSTEM COMPILER RULES */}
          {menuMode === "predictive" && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <h4 style={{ margin: '0 0 2px 0', fontSize: '12px', color: '#1d4ed8', textTransform: 'uppercase' }}>Predictive Node Drop</h4>
              <input 
                type="text"
                value={quickText}
                onChange={(e) => setQuickText(e.target.value)}
                placeholder="Type here (e.g., input age)"
                style={{ width: '100%', fontSize: '12px', padding: '6px', borderRadius: '4px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }}
              />
              <button onClick={handleQuickNode} style={{ ...btnStyle, background: '#3b82f6', color: 'white', fontWeight: 'bold', border: 'none' }}>
                Predict & Add Block
              </button>

              {/* SYSTEM PREDICTIVE RUNTIME RULES BOX */}
              <div style={{ marginTop: '5px', padding: '8px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '6px', fontSize: '11px', color: '#166534', lineHeight: '1.4' }}>
                <strong style={{ fontSize: '11px', display: 'block', marginBottom: '3px' }}>📋 Syntax Prediction Rules:</strong>
                <ul style={{ margin: 0, paddingLeft: '14px' }}>
                  <li>Stage with <code style={{background:'#e2e8f0', padding:'1px 3px'}}>if</code> / <code style={{background:'#e2e8f0', padding:'1px 3px'}}>is</code> or end with <code style={{background:'#e2e8f0', padding:'1px 3px'}}>?</code></li>
                  <li>Input/Output: Start with <code style={{background:'#e2e8f0', padding:'1px 3px'}}>input</code> / <code style={{background:'#e2e8f0', padding:'1px 3px'}}>print</code> / <code style={{background:'#e2e8f0', padding:'1px 3px'}}>read</code></li>
                  <li>Terminal: Start with <code style={{background:'#e2e8f0', padding:'1px 3px'}}>start</code> / <code style={{background:'#e2e8f0', padding:'1px 3px'}}>stop</code> / <code style={{background:'#e2e8f0', padding:'1px 3px'}}>end</code></li>
                  <li>Process: Include <code style={{background:'#e2e8f0', padding:'1px 3px'}}>=</code> or execution keywords.</li>
                </ul>
              </div>
            </div>
          )}
        </div>

        {/* PERMANENT LOWER ANCHOR */}
        <div style={{ marginTop: 'auto', paddingTop: '15px' }}>
          <hr style={{ border: '0', borderTop: '1px solid #e2e8f0', margin: '0 0 12px 0' }} />
          
          <h4 style={{ margin: '0 0 5px 0', fontSize: '12px', color: '#7e22ce', textTransform: 'uppercase' }}>AI Prompt Build</h4>
          <textarea 
            value={aiPrompt}
            onChange={(e) => setAiPrompt(e.target.value)}
            placeholder="e.g., input x, check if x % 2 == 0, if yes print x is even, else print x is odd"
            style={{ width: '100%', fontSize: '11px', padding: '6px', borderRadius: '4px', border: '1px solid #cbd5e1', resize: 'none', boxSizing: 'border-box', marginBottom: '6px' }}
            rows={3}
          />
          <button onClick={generateWithAI} style={{ ...btnStyle, width: '100%', background: '#a855f7', color: 'white', fontWeight: 'bold', border: 'none', boxSizing: 'border-box' }}>
            Generate Entire Flow
          </button>

          {lintErrors.length > 0 && (
            <div style={{ marginTop: '10px', padding: '8px', background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: '4px', fontSize: '11px', color: '#991b1b' }}>
              <strong>AI Lint Issue:</strong> {lintErrors[0].message}
            </div>
          )}

          <hr style={{ border: '0', borderTop: '1px solid #e2e8f0', margin: '12px 0' }} />
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <button onClick={clearCanvas} style={clearBtn}>Clear Canvas</button>
            <button 
              onClick={async () => {
                const issues = await runPredictiveLint();
                const dangerousErrors = issues.filter(i => i.severity === 'error');
                
                if (dangerousErrors.length > 0) {
                  alert(`AI Error Warning: ${dangerousErrors[0].message}\n\nCompilation blocked.`);
                } else {
                  if (issues.length > 0) {
                    alert(`AI Optimisation Notice: ${issues[0].message}`);
                  }
                  onCompile({ nodes, edges });
                }
              }} 
              style={compileBtn}
            >
              Compile Code
            </button>
          </div>
        </div>

      </div>

      {/* REACTFLOW MAIN CANVAS VIEWPORT */}
      <div style={{ flexGrow: 1, position: 'relative' }}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onEdgesDelete={onEdgesDelete}
          nodeTypes={nodeTypes}
          deleteKeyCode={["Backspace", "Delete"]}
          fitView
        >
          <Background variant="dots" gap={12} size={1} />
          <Controls />
        </ReactFlow>
      </div>
    </div>
  );
}