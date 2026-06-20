import re

class IRBuilder:
    def __init__(self, ir_data):
        """
        Initializes the Intermediate Representation (IR) Builder.
        Takes raw graph JSON data from the frontend containing nodes and edges.
        """
        self.raw_nodes = ir_data.get('nodes', [])
        self.raw_edges = ir_data.get('edges', [])
        
        # Look up dictionaries for fast graph walking
        self.nodes = {n['id']: n for n in self.raw_nodes}
        self.symbol_table = {}  # Tracks variable scopes and inferred data types
        self.errors = []        # Stores semantic compilation errors

    def get_next_node(self, source_id, label_filter=None):
        """
        Walks the Control Flow Graph (CFG) edges from a given source node.
        Can filter out pathways using case-insensitive 'YES'/'NO' labels.
        """
        for edge in self.raw_edges:
            if edge['source'] == source_id:
                edge_label = str(edge.get('label', '')).strip().upper()
                if label_filter is None or label_filter.upper() in edge_label:
                    return self.nodes.get(edge['target'])
        return None

    def build_and_validate(self):
        """
        Executes Semantic Analysis and builds the symbol table map 
        by walking through the program's lifecycle layout.
        """
        # Find the global entry point of the visual script
        current_node = next(
            (n for n in self.nodes.values() if n['data'].get('label', '').strip().upper() == 'START'), 
            None
        )

        if not current_node:
            self.errors.append("Semantic Error: Flowchart lacks a valid 'START' terminal node.")
            return False

        while current_node:
            label = current_node['data'].get('label', '').strip()
            clean_label = label.upper()
            node_id = current_node['id']

            if clean_label == "STOP":
                break

            # 1. Evaluate Input Scopes & Types
            if "INPUT" in clean_label:
                # Capture the identifier suffix using the spacing extraction rule
                parts = label.split()
                if len(parts) < 2:
                    self.errors.append(f"Syntax Error in Node [{node_id}]: Malformed INPUT expression.")
                    current_node = self.get_next_node(node_id)
                    continue
                
                var_name = parts[-1]

                # Match cross-language lexical type regex constraints
                if bool(re.search(r'\binput[sS]\b', label, re.IGNORECASE)):
                    inferred_type = "string"
                elif bool(re.search(r'\binput[cC]\b', label, re.IGNORECASE)):
                    inferred_type = "char"
                else:
                    inferred_type = "float"

                self.symbol_table[var_name] = inferred_type
                current_node = self.get_next_node(node_id)

            # 2. Evaluate Conditional Decision Splits
            elif "?" in label or "IF" in clean_label:
                # Strip logical branch operators to isolate the condition expression
                condition = label.replace("?", "").strip()
                condition = re.sub(r'\bif\b', '', condition, flags=re.IGNORECASE).strip()

                # Parse used variables from the expression to verify declaration status
                used_vars = re.findall(r'\b[a-zA-Z_][a-zA-Z0-9_]*\b', condition)
                for var in used_vars:
                    if var not in self.symbol_table:
                        self.errors.append(f"Semantic Error: Variable '{var}' used in condition before declaration.")

                # Recursively analyze both downstream branching paths
                yes_node = self.get_next_node(node_id, "YES") or self.get_next_node(node_id, "TRUE")
                if yes_node:
                    self._validate_branch_path(yes_node)

                no_node = self.get_next_node(node_id, "NO") or self.get_next_node(node_id, "FALSE")
                if no_node:
                    self._validate_branch_path(no_node)

                # Direct forced jump to STOP terminal matching your backend compiler reset rule
                current_node = next(
                    (n for n in self.nodes.values() if n['data'].get('label', '').strip().upper() == 'STOP'), 
                    None
                )

            # 3. Evaluate Process Assignment Math Expressions
            elif "=" in label:
                try:
                    var_part, expr_part = label.split('=', 1)
                    var_part = var_part.strip()
                    expr_part = expr_part.replace(';', '').strip() # Clean trailing semicolons

                    # Verify that expressions on the right-hand side utilize declared variables
                    right_side_vars = re.findall(r'\b[a-zA-Z_][a-zA-Z0-9_]*\b', expr_part)
                    for r_var in right_side_vars:
                        # Ignore numeric functional constructs or constants
                        if r_var not in self.symbol_table and not r_var.replace('.', '', 1).isdigit():
                            self.errors.append(f"Semantic Error: Variable '{r_var}' referenced before assignment.")

                    # Deduce the left-hand variable's type based on symbol table configuration
                    if right_side_vars:
                        # Default inherit type from primary right-hand operand identifier matches
                        primary_type = self.symbol_table.get(right_side_vars[0], "float")
                    else:
                        primary_type = "float"

                    self.symbol_table[var_part] = primary_type

                except ValueError:
                    self.errors.append(f"Syntax Error in Node [{node_id}]: Invalid assignment syntax.")

                current_node = self.get_next_node(node_id)

            # 4. Evaluate Global Print Operations
            elif "PRINT" in clean_label or "OUTPUT" in clean_label:
                print_target = re.sub(r'\b(print|output)\b', '', label, flags=re.IGNORECASE).strip()
                p_vars = re.findall(r'\b[a-zA-Z_][a-zA-Z0-9_]*\b', print_target)
                
                for p_var in p_vars:
                    if p_var not in self.symbol_table and not p_var.startswith(('"', "'")):
                        self.errors.append(f"Semantic Error: Attempting to print undeclared variable '{p_var}'.")

                current_node = self.get_next_node(node_id)
            
            else:
                current_node = self.get_next_node(node_id)

        return len(self.errors) == 0

    def _validate_branch_path(self, start_branch_node):
        """
        Helper subroutine to traverse scoped branch paths safely until reaching a STOP terminal.
        """
        curr = start_branch_node
        while curr and curr['data'].get('label', '').strip().upper() != 'STOP':
            lbl = curr['data'].get('label', '').strip()
            
            if "=" in lbl:
                var_part, expr_part = lbl.split('=', 1)
                var_part = var_part.strip()
                right_vars = re.findall(r'\b[a-zA-Z_][a-zA-Z0-9_]*\b', expr_part)
                for r_v in right_vars:
                    if r_v not in self.symbol_table and not r_v.replace('.', '', 1).isdigit():
                        self.errors.append(f"Semantic Error inside branch: Variable '{r_v}' not declared.")
                
                if var_part not in self.symbol_table:
                    self.symbol_table[var_part] = "float"

            elif bool(re.search(r'\b(print|output)\b', lbl, re.IGNORECASE)):
                p_content = re.sub(r'\b(print|output)\b', '', lbl, flags=re.IGNORECASE).strip()
                p_vars = re.findall(r'\b[a-zA-Z_][a-zA-Z0-9_]*\b', p_content)
                for pv in p_vars:
                    if pv not in self.symbol_table and not pv.startswith(('"', "'")):
                        self.errors.append(f"Semantic Error inside branch: Variable '{pv}' not declared.")

            curr = self.get_next_node(curr['id'])