import re

def generate_c(ir_data):
    code = [
        "#include <stdio.h>",
        "#include <string.h>",
        "",
        "int main() {",
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

    # Case-insensitive check to find the START node
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
            elif bool(re.search(r'\binput[cC]\b', label, re.IGNORECASE)):
                current_type = "char"
            else:
                current_type = "float"
            
            if var not in declared_vars:
                declared_vars[var] = current_type
                if current_type == "string":
                    code.append(f"    char {var}[256];")
                elif current_type == "char":
                    code.append(f"    char {var};")
                else:
                    code.append(f"    float {var};")
                
            code.append(f"    printf(\"Enter {var}: \");")
            
            if current_type == "string":
                code.append("    fflush(stdout);")
                code.append(f"    fgets({var}, sizeof({var}), stdin);")
                code.append(f"    {var}[strcspn({var}, \"\\n\")] = 0;")
            elif current_type == "char":
                code.append(f"    scanf(\" %c\", &{var});")
            else:
                code.append(f"    scanf(\"%f\", &{var});")
                
            current_node = get_next(node_id)
            
        # 2. Handle Output Global
        elif "PRINT" in clean_label or "OUTPUT" in clean_label:
            val = re.sub(r'\b(print|output)\b', '', label, flags=re.IGNORECASE).strip()
            
            if val in declared_vars and declared_vars[val] == "string":
                code.append(f"    printf(\"%s\\n\", {val});")
            elif val in declared_vars and declared_vars[val] == "char":
                code.append(f"    printf(\"%c\\n\", {val});")
            else:
                code.append(f"    printf(\"%g\\n\", (float)({val}));")
                
            current_node = get_next(node_id)

        # 3. Handle Decision Blocks (Nests full blocks correctly)
        elif "?" in label or "IF" in clean_label:
            condition = label.replace("?", "").strip()
            condition = re.sub(r'\bif\b', '', condition, flags=re.IGNORECASE).strip()
            code.append(f"    if ({condition}) {{")
            
            # Follow YES path until it runs out or hits a terminal block
            yes_node = get_next(node_id, "YES") or get_next(node_id, "TRUE")
            if yes_node:
                curr_yes = yes_node
                while curr_yes and curr_yes['data'].get('label', '').strip().upper() != 'STOP':
                    y_lbl = curr_yes['data'].get('label', '').strip()
                    y_clean = y_lbl.upper()
                    
                    if "PRINT" in y_clean or "OUTPUT" in y_clean:
                        v = re.sub(r'\b(print|output)\b', '', y_lbl, flags=re.IGNORECASE).strip()
                        # If printing a raw quote literal string
                        if v.startswith('"') or v.startswith("'"):
                            v_clean = v.replace('"', '').replace("'", "")
                            code.append(f"        printf(\"%s\\n\", \"{v_clean}\");")
                        elif v in declared_vars and declared_vars[v] == "string":
                            code.append(f"        printf(\"%s\\n\", {v});")
                        elif v in declared_vars and declared_vars[v] == "char":
                            code.append(f"        printf(\"%c\\n\", {v});")
                        else:
                            code.append(f"        printf(\"%g\\n\", (float)({v}));")
                    elif "=" in y_lbl:
                        v_p = y_lbl.split('=')[0].strip()
                        r_p = y_lbl.split('=')[1].strip()
                        if declared_vars.get(v_p) == "string":
                            code.append(f"        strcpy({v_p}, {r_p});")
                        else:
                            code.append(f"        {y_lbl};")
                    curr_yes = get_next(curr_yes['id'])
            
            code.append("    } else {")
            
            # Follow NO path until it runs out or hits a terminal block
            no_node = get_next(node_id, "NO") or get_next(node_id, "FALSE")
            if no_node:
                curr_no = no_node
                while curr_no and curr_no['data'].get('label', '').strip().upper() != 'STOP':
                    n_lbl = curr_no['data'].get('label', '').strip()
                    n_clean = n_lbl.upper()
                    
                    if "PRINT" in n_clean or "OUTPUT" in n_clean:
                        v = re.sub(r'\b(print|output)\b', '', n_lbl, flags=re.IGNORECASE).strip()
                        if v.startswith('"') or v.startswith("'"):
                            v_clean = v.replace('"', '').replace("'", "")
                            code.append(f"        printf(\"%s\\n\", \"{v_clean}\");")
                        elif v in declared_vars and declared_vars[v] == "string":
                            code.append(f"        printf(\"%s\\n\", {v});")
                        elif v in declared_vars and declared_vars[v] == "char":
                            code.append(f"        printf(\"%c\\n\", {v});")
                        else:
                            code.append(f"        printf(\"%g\\n\", (float)({v}));")
                    elif "=" in n_lbl:
                        v_p = n_lbl.split('=')[0].strip()
                        r_p = n_lbl.split('=')[1].strip()
                        if declared_vars.get(v_p) == "string":
                            code.append(f"        strcpy({v_p}, {r_p});")
                        else:
                            code.append(f"        {n_lbl};")
                    curr_no = get_next(curr_no['id'])
            
            code.append("    }")
            current_node = next((n for n in nodes.values() if n['data'].get('label', '').strip().upper() == 'STOP'), None)

        # 4. Handle Process Blocks
        elif "=" in label:
            var_part = label.split('=')[0].strip()
            right_part = label.split('=')[1].strip()
            
            if var_part not in declared_vars and var_part.isidentifier():
                right_side_type = declared_vars.get(right_part, "float") 
                declared_vars[var_part] = right_side_type 
                
                if right_side_type == "string":
                    code.append(f"    char {var_part}[256];")
                elif right_side_type == "char":
                    code.append(f"    char {var_part};")
                else:
                    code.append(f"    float {var_part};")
            
            if declared_vars.get(var_part) == "string":
                code.append(f"    strcpy({var_part}, {right_part});")
            else:
                code.append(f"    {label};")
                
            current_node = get_next(node_id)
            
        else:
            current_node = get_next(node_id)

    code.append("    return 0;")
    code.append("}")
    return "\n".join(code)