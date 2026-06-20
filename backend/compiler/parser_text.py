import re

def parse_text_description(text):
    """
    Converts lines of text into a JSON Intermediate Representation (IR).
    This matches the sequential 'next' pointer logic used in your codegen.
    """
    lines = [l.strip() for l in text.split('\n') if l.strip()]
    if not lines:
        return {"nodes": [{"id": "start", "type": "start", "label": "Start", "next": None}]}

    # Initialize with a Start node
    nodes = [{"id": "start", "type": "start", "label": "Start", "next": "node_0"}]
    
    for i, line in enumerate(lines):
        line_lower = line.lower()
        node_id = f"node_{i}"
        next_id = f"node_{i+1}"
        
        # 1. Handle Input
        if line_lower.startswith("input"):
            var = line_lower.replace("input", "").strip()
            nodes.append({
                "id": node_id, 
                "type": "input", 
                "variable": var, 
                "label": f"INPUT {var}", 
                "next": next_id,
                "data": {"label": f"INPUT {var}"} # Added for generator compatibility
            })
            
        # 2. Handle Print
        elif line_lower.startswith("print"):
            val = line_lower.replace("print", "").strip()
            nodes.append({
                "id": node_id, 
                "type": "print", 
                "value": val, 
                "label": f"PRINT {val}", 
                "next": next_id,
                "data": {"label": f"PRINT {val}"} # Added for generator compatibility
            })
            
        # 3. Handle Assignment (e.g., x = 10)
        elif "=" in line:
            nodes.append({
                "id": node_id,
                "type": "process",
                "label": line,
                "next": next_id,
                "data": {"label": line}
            })

    # Add the End node
    end_node_id = f"node_{len(nodes) - 1}"
    nodes.append({"id": end_node_id, "type": "end", "label": "End", "next": None})
    
    # Ensure the second to last node points to the End node correctly
    if len(nodes) > 1:
        nodes[-2]['next'] = end_node_id
    
    return {"nodes": nodes}