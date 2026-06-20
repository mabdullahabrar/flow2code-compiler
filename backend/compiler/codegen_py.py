import re

def generate_python(ir_data):
    code = [
        "# Generated Python Code",
        "def main():"
    ]
    
    declared_vars = {} 
    nodes = {n['id']: n for n in ir_data.get('nodes', [])}
    edges = ir_data.get('edges', [])

    def get_next(source_id, label_filter=None):
        for edge in edges:
            if edge['source'] == source_id:
                edge_label = str(edge.get('label', '')).upper()
                if label_filter is None or label_filter.upper() in edge_label:
                    return nodes.get(edge['target'])
        return None

    current_node = next((n for n in nodes.values() if n['data'].get('label', '').strip().upper() == 'START'), None)

    while current_node:
        label = current_node['data'].get('label', '').strip()
        clean_label = label.upper()
        node_id = current_node['id']

        if clean_label == "STOP":
            break

        # 1. Handle Input
        if "INPUT" in clean_label:
            var = label.split()[-1]
            
            if bool(re.search(r'\binput[sS]\b', label, re.IGNORECASE)):
                current_type = "string"
                code.append(f"    {var} = input('Enter {var}: ')")
            elif bool(re.search(r'\binput[cC]\b', label, re.IGNORECASE)):
                current_type = "char"
                code.append(f"    {var} = input('Enter {var}: ')[0]") 
            else:
                current_type = "float"
                code.append(f"    {var} = float(input('Enter {var}: '))")
                
            declared_vars[var] = current_type
            current_node = get_next(node_id)

        # 2. Handle Decision Blocks (Nests full blocks correctly)
        elif "?" in label or "IF" in clean_label:
            condition = label.replace("?", "").strip()
            condition = re.sub(r'\bif\b', '', condition, flags=re.IGNORECASE).strip()
            code.append(f"    if {condition}:")
            
            yes_node = get_next(node_id, "YES") or get_next(node_id, "TRUE")
            if yes_node:
                curr_yes = yes_node
                while curr_yes and curr_yes['data'].get('label', '').strip().upper() != 'STOP':
                    y_lbl = curr_yes['data'].get('label', '').strip()
                    y_clean = y_lbl.upper()
                    
                    if "PRINT" in y_clean or "OUTPUT" in y_clean:
                        v = re.sub(r'\b(print|output)\b', '', y_lbl, flags=re.IGNORECASE).strip()
                        code.append(f"        print({v})")
                    elif "=" in y_lbl:
                        code.append(f"        {y_lbl}")
                    curr_yes = get_next(curr_yes['id'])
            else:
                code.append("        pass")
            
            code.append("    else:")
            
            no_node = get_next(node_id, "NO") or get_next(node_id, "FALSE")
            if no_node:
                curr_no = no_node
                while curr_no and curr_no['data'].get('label', '').strip().upper() != 'STOP':
                    n_lbl = curr_no['data'].get('label', '').strip()
                    n_clean = n_lbl.upper()
                    
                    if "PRINT" in n_clean or "OUTPUT" in n_clean:
                        v = re.sub(r'\b(print|output)\b', '', n_lbl, flags=re.IGNORECASE).strip()
                        code.append(f"        print({v})")
                    elif "=" in n_lbl:
                        code.append(f"        {n_lbl}")
                    curr_no = get_next(curr_no['id'])
            else:
                code.append("        pass")
            
            current_node = next((n for n in nodes.values() if n['data'].get('label', '').strip().upper() == 'STOP'), None)

        # 3. Handle Output Global
        elif "PRINT" in clean_label or "OUTPUT" in clean_label:
            val = re.sub(r'\b(print|output)\b', '', label, flags=re.IGNORECASE).strip()
            code.append(f"    print({val})")
            current_node = get_next(node_id)

        # 4. Handle Process Blocks
        elif "=" in label:
            var_part = label.split('=')[0].strip()
            right_part = label.split('=')[1].strip()
            
            right_side_type = declared_vars.get(right_part, "float")
            declared_vars[var_part] = right_side_type
            
            code.append(f"    {label}")
            current_node = get_next(node_id)

        else:
            current_node = get_next(node_id)

    code.extend(["", "if __name__ == '__main__':", "    main()"])
    return "\n".join(code)