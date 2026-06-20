import React, { useState } from 'react';
import FlowCanvas from './components/FlowCanvas';
import './App.css'; // Importing your modified styling sheet

function App() {
  const [screen, setScreen] = useState("welcome"); // States: 'welcome' or 'canvas'
  const [code, setCode] = useState("");
  const [language, setLanguage] = useState("cpp"); 
  const [isModalOpen, setIsModalOpen] = useState(false); // Controls the compilation popup

  const handleCompile = async (flowData) => {
    try {
      const res = await fetch('http://127.0.0.1:5000/compile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          ir: flowData, 
          mode: 'visual', 
          language: language 
        }),
      });
      
      const data = await res.json();
      if (data.success) {
        setCode(data.code);
      } else {
        setCode("// Compilation failed on the backend.");
      }
    } catch (err) {
      console.error("Backend connection failed", err);
      setCode("// Error: Backend connection failed. Is Flask running?");
    }
    // Automatically open the popup window to reveal the code!
    setIsModalOpen(true);
  };

  return (
    <div className="app-container">
      
      {/* SCREEN 1: WELCOME SCREEN & BEGINNER GUIDE */}
      {screen === "welcome" && (
        <div className="welcome-layout">
          <div className="welcome-card">
            <h1>🚀 Welcome to the Flow2code Compiler</h1>
            <p className="welcome-subtitle">
              Learn programming fundamentals by drawing simple, visual flowcharts!
            </p>
            
            <hr className="divider" />
            
            {/* NEW SECTION: Scope & Limitations Guide */}
            <div className="guide-box scope-box" style={{ borderLeft: '5px solid #eab308', backgroundColor: '#fefce8' }}>
              <h3 style={{ color: '#854d0e', margin: 0 }}>⚠️ Important Notice for Beginners:</h3>
              <p style={{ fontSize: '0.95em', color: '#713f12', lineHeight: '1.5', margin: '8px 0 0 0' }}>
                This is a <strong>basic educational compiler</strong> designed to help you practice foundational logic. 
                It works perfectly for linear flows and branching statements like <strong><code>if</code></strong>, 
                <strong><code>if-else</code></strong>, or <strong><code>if-else-if</code></strong>. It is 
                <strong> not capable</strong> of processing advanced or highly complex layouts like loops, arrays, or nested functions yet. 
                Also it cannot take multiple inputs at time. i.e Input x, y, z. You can only input one variable at a time. 
                So you would have to input x, then input y, then input z separately.
              </p>
            </div>

            <div className="guide-box">
              <h3>📝 Beginner Cheat Sheet Rules:</h3>
              <p>Type your variables into your input shapes using these quick keywords:</p>
              <ul className="guide-list">
                <li>
                  <strong><code>INPUT variableName</code></strong> 
                  <span>Creates standard fractional <code>float</code> numbers (e.g., <code>INPUT age</code>).</span>
                </li>
                <li>
                  <strong><code>INPUTs variableName</code></strong> 
                  <span>Creates a multi-character text <code>string</code> (e.g., <code>INPUTs name</code>).</span>
                </li>
                <li>
                  <strong><code>INPUTc variableName</code></strong> 
                  <span>Creates a single isolated <code>char</code> symbol (e.g., <code>INPUTc grade</code>).</span>
                </li>
              </ul>
            </div>

            <button className="primary-action-btn" onClick={() => setScreen("canvas")}>
              Start Drawing Flowcharts ➡️
            </button>
          </div>
        </div>
      )}

      {/* SCREEN 2: MAIN VISUAL DESIGN CANVAS */}
      {screen === "canvas" && (
        <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', height: '94vh' }}>
          
          {/* Main Workspace Header Toolbar */}
          <div className="workspace-toolbar">
            <button className="nav-back-btn" onClick={() => setScreen("welcome")}>
              ⬅️ Back to Guide
            </button>
            
            <h2 className="workspace-title">CompilerFlow IDE</h2>
            
            <div className="selector-wrapper">
              <label>Target Language:</label>
              <select value={language} onChange={(e) => setLanguage(e.target.value)}>
                <option value="cpp">C++ (Standard Streams)</option>
                <option value="python">Python (Indented Script)</option>
                <option value="c">C (Legacy stdio standard)</option>
              </select>
            </div>
          </div>

          {/* Full Width Grid Visual Workspace */}
          <div style={{ flex: 1, border: '1px solid #ccc', borderRadius: '8px', overflow: 'hidden', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}>
            <FlowCanvas onCompile={handleCompile} />
          </div>
        </div>
      )}

      {/* DYNAMIC COMPILATION RESULT MODAL POP-UP */}
      {isModalOpen && (
        <div className="modal-backdrop-overlay">
          <div className="modal-window-content">
            <div className="modal-header">
              <h3>💻 Compiled {language.toUpperCase()} Output Code</h3>
              <button className="close-x-btn" onClick={() => setIsModalOpen(false)}>×</button>
            </div>
            <hr />
            <pre className="terminal-code-block">
              <code>{code || `// No flowchart graph logic found on canvas to track.`}</code>
            </pre>
            <div style={{ textAlign: 'right', marginTop: '15px' }}>
              <button className="secondary-close-btn" onClick={() => setIsModalOpen(false)}>
                Close & Modify Grid Flowchart
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

export default App;