"""Build a single-function native source patch; never read/write config or call APIs.

Deployment must separately check the exact approved source hash and retain its
private preimage. Unknown or already-patched source is rejected, not guessed.
"""
import ast

FUNCTION = '_save_discovered_models_to_config'
OLD = '            entry["models"] = {model_id: {} for model_id in model_ids}'
OLD_COMPARE = 'and list(existing) == model_ids'
NEW = '''            # Refresh the discovered catalogue without discarding user metadata.
            entry["models"] = {
                model_id: (
                    dict(existing[model_id])
                    if isinstance(existing, dict)
                    and isinstance(existing.get(model_id), dict)
                    else {}
                )
                for model_id in model_ids
            }'''


def build_patch(raw):
    """Return new bytes, preserving encoding/newlines and all other source bytes."""
    text = raw.decode('utf-8-sig')
    functions = [n for n in ast.parse(text).body
                 if isinstance(n, ast.FunctionDef) and n.name == FUNCTION]
    if len(functions) != 1:
        raise ValueError('Exactly one known native catalogue function required')
    fn = functions[0]
    lines = text.splitlines(keepends=True)
    segment = ''.join(lines[fn.lineno - 1:fn.end_lineno])
    newline = '\r\n' if '\r\n' in segment else '\n'
    if segment.splitlines().count(OLD) != 1 or segment.count(OLD_COMPARE) != 1:
        raise ValueError('Known unpatched catalogue assignment required')
    replacement = NEW.replace('\n', newline)
    changed = segment.replace(OLD, replacement, 1).replace(
        OLD_COMPARE, 'and set(existing) == set(model_ids)', 1)
    result = ''.join(lines[:fn.lineno - 1]) + changed + ''.join(lines[fn.end_lineno:])
    ast.parse(result)
    return (b'\xef\xbb\xbf' if raw.startswith(b'\xef\xbb\xbf') else b'') + result.encode('utf-8')
