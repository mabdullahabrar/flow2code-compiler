from flask import Flask, request, jsonify
from flask_cors import CORS
from compiler.codegen_cpp import generate_cpp
from compiler.codegen_py import generate_python
from compiler.codegen_c import generate_c  
from compiler.parser_text import parse_text_description

from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.ensemble import RandomForestClassifier
import json

# --- 1. GROQ SDK INITIALIZATION ---
from dotenv import load_dotenv
from groq import Groq
import os

load_dotenv()  # Injects local environmental variables from your .env file
client = Groq(api_key=os.getenv("GROQ_API_KEY"))

app = Flask(__name__)
CORS(app)

# =====================================================================
# FEATURE 2: ML TEXT-TO-SHAPE DATASET & TRAINING (In-Memory)
# =====================================================================
training_text = [
    "start the program", "end code", "stop", "exit",
    "x = 5", "total = a + b", "y = y * 2", "clear screen",
    "is x greater than 10?", "if status == true", "check if even",
    "input age", "read value", "print total", "display output"
]
labels = [
    "Terminal", "Terminal", "Terminal", "Terminal",
    "Process", "Process", "Process", "Process",
    "Decision", "Decision", "Decision",
    "IO", "IO", "IO", "IO"
]

vectorizer = TfidfVectorizer()
X = vectorizer.fit_transform(training_text)
clf = RandomForestClassifier()
clf.fit(X, labels)


# =====================================================================
# EXISTING CORE COMPILER PIPELINE
# =====================================================================
@app.route('/compile', methods=['POST'])
def compile_logic():
    data = request.json
    mode = data.get('mode', 'visual')
    target_lang = data.get('language', 'cpp')
    
    if mode == 'text':
        ir_data = parse_text_description(data.get('text_input', ''))
    else:
        ir_data = data.get('ir')

    if not ir_data:
        return jsonify({"success": False, "message": "No IR data provided"})

    if target_lang == 'cpp':
        generated_code = generate_cpp(ir_data)
    elif target_lang == 'python':
        generated_code = generate_python(ir_data)
    elif target_lang == 'c':
        generated_code = generate_c(ir_data)  
    else:
        generated_code = "// Language not supported."

    return jsonify({"success": True, "code": generated_code})


# =====================================================================
# FEATURE 1: GENERATIVE AI FLOWCHART GENERATION (GROQ OPTIMIZED)
# =====================================================================
SYSTEM_PROMPT_GENERATE = """
You are an expert compiler assistant. Convert the user's natural language request into a valid Flowchart JSON graph.
You must strictly return a raw JSON object containing two lists: 'nodes' and 'edges'. Do not return markdown code blocks.

Every flowchart graph MUST structure standard programming logic:
1. It MUST start with a 'Terminal' node labeled 'Start'.
2. It MUST end with a 'Terminal' node labeled 'End' or 'Stop'.
3. All code operations/actions/prints between entry and exit must be linked chronologically via edges.

Node formatting constraints:
- type must be 'custom'
- style must be an object specifying standard dimension keys: {"width": 150, "height": 80}
- data.label can be assignments ('x = 0'), conditions ('x % 2 == 0?'), inputs ('input x'), or states ('x is even')
- data.shapeStyle MUST be exactly one of these strings based on context:
    * 'Terminal' -> Use ONLY for explicit Start, Stop, End, or Exit blocks.
    * 'Process'  -> Use for computations, state changes, statements, or variable updates (e.g., 'x is even', 'total = a + b').
    * 'Decision' -> Use for conditional question checks (e.g., 'x % 2 == 0?').
    * 'IO'       -> Use for reading data inputs or displaying prints (e.g., 'input x', 'print total').

Edge formatting constraints:
- type must be 'step'
- label must be 'Yes' or 'No' if originating from a 'Decision' node.
"""

@app.route('/api/generate-flowchart', methods=['POST'])
def generate_flowchart():
    data = request.json
    prompt = data.get('prompt', '')
    
    if not prompt:
        return jsonify({"error": "No prompt provided", "nodes": [], "edges": []}), 400
        
    try:
        # Route through Groq using llama-3.3-70b-versatile
        response = client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT_GENERATE},
                {"role": "user", "content": prompt}
            ],
            response_format={"type": "json_object"}
        )
        result_json = json.loads(response.choices[0].message.content)
        return jsonify(result_json)
    except Exception as e:
        print(f"CRITICAL BACKEND FAULT: {str(e)}")
        return jsonify({"error": str(e), "nodes": [], "edges": []}), 500


# =====================================================================
# FEATURE 2: UPDATED CASE-INSENSITIVE PREFIX + ML HYBRID PREDICTOR
# =====================================================================
@app.route('/api/predict-shape', methods=['POST'])
def predict_shape():
    data = request.json
    text = data.get('text', '').strip()
    
    if not text:
        return jsonify({"error": "No text provided"}), 400
        
    # Force lowercase evaluation for strict case-insensitivity layout processing
    text_lower = text.lower()
    words = text_lower.split()
    first_word = words[0] if words else ""

    # 1. TERMINAL RULE (Insensitive Start/Stop matchers)
    if first_word in ["start", "stop", "end", "begin", "exit", "terminate"]:
        return jsonify({"shape": "Terminal"})

    # 2. DECISION CONDITION RULE (Starts with if/check/is OR explicitly ends with a question mark)
    elif first_word in ["if", "check", "verify", "is"] or text_lower.endswith("?"):
        return jsonify({"shape": "Decision"})

    # 3. INPUT/OUTPUT RULE (Starts with input, print, output, display, etc.)
    elif first_word in ["input", "print", "output", "read", "display", "show", "get"]:
        return jsonify({"shape": "IO"})

    # 4. EXPLICIT PROCESS PATTERN ENFORCEMENT
    elif first_word in ["calculate", "compute", "set", "let"] or "=" in text_lower:
        return jsonify({"shape": "Process"})

    # 5. MACHINE LEARNING INTENT BACKUP
    # If no strict rule triggers, the vectorized Random Forest model classifies semantic intent.
    X_test = vectorizer.transform([text_lower])
    predicted_shape = clf.predict(X_test)[0]
    
    return jsonify({"shape": predicted_shape})


# =====================================================================
# FEATURE 4: PREDICTIVE ERROR LINTING (GROQ OPTIMIZED)
# =====================================================================
SYSTEM_PROMPT_LINT = """
You are a static code analyzer for a flowchart compiler.
Analyze the provided graph JSON for bugs like infinite loops, orphaned layout nodes, or broken paths.
Return a JSON object containing a list named 'issues'. Example:
{"issues": [{"nodeId": "node_123", "severity": "error", "message": "Your warning/error statement here"}]}
If there are no errors, return: {"issues": []}
"""

@app.route('/api/lint-flowchart', methods=['POST'])
def lint_flowchart():
    data = request.json
    nodes = data.get('nodes', [])
    edges = data.get('edges', [])
    
    try:
        graph_representation = f"Nodes: {nodes}\nEdges: {edges}"
        response = client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT_LINT},
                {"role": "user", "content": graph_representation}
            ],
            response_format={"type": "json_object"}
        )
        result_json = json.loads(response.choices[0].message.content)
        return jsonify(result_json)
    except Exception as e:
        print(f"LINTER ERROR: {str(e)}")
        return jsonify({"issues": []})


if __name__ == '__main__':
    app.run(debug=True, port=5000)