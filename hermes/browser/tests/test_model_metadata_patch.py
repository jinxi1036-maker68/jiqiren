"""Tests use a synthetic catalogue and mocked load/save; no native home or API."""
import copy
import sys
import types
import unittest
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from model_metadata_patch import build_patch, FUNCTION, OLD

# The structural branch being patched, with only a synthetic in-memory save.
SOURCE = '''# prefix must survive
def _save_discovered_models_to_config(api_url, model_ids):
    from hermes_cli.config import load_config, save_config
    cfg = load_config()
    for entry in cfg['custom_providers']:
        if entry['base_url'] != api_url:
            continue
        existing = entry.get('models')
        discovered = entry.get('models_discovered') is True
        if isinstance(existing, dict) and not discovered:
            continue
        if isinstance(existing, list) and any(isinstance(x, dict) for x in existing):
            continue
        if isinstance(existing, dict) and list(existing) == model_ids:
            continue
        if model_ids:
            entry["models"] = {model_id: {} for model_id in model_ids}
            entry['models_discovered'] = True
            save_config(cfg)
# suffix must survive
'''


class ModelMetadataPatch(unittest.TestCase):
    def execute(self, existing, ids, discovered=True):
        state = {'voice': {'auto_tts': True}, 'custom_providers': [
            {'base_url': 'https://fixture.invalid/v1', 'models_discovered': discovered, 'models': existing}]}
        saved = []
        module = types.ModuleType('hermes_cli.config')
        module.load_config = lambda: copy.deepcopy(state)
        module.save_config = lambda cfg: saved.append(copy.deepcopy(cfg))
        with patch.dict(sys.modules, {'hermes_cli.config': module}):
            ns = {}; exec(compile(build_patch(SOURCE.encode()), '<synthetic>', 'exec'), ns)
            ns[FUNCTION]('https://fixture.invalid/v1', ids)
        return state, saved

    def test_reorder_and_new_model_keep_metadata_and_voice(self):
        _, saved = self.execute({'a': {'context_length': 524288, 'nested': {'keep': True}}, 'b': {}}, ['b', 'a', 'c'])
        self.assertEqual(saved[0]['custom_providers'][0]['models'],
                         {'b': {}, 'a': {'context_length': 524288, 'nested': {'keep': True}}, 'c': {}})
        self.assertEqual(saved[0]['voice'], {'auto_tts': True})

    def test_same_catalogue_keeps_no_write_behavior(self):
        self.assertEqual(self.execute({'a': {'context_length': 524288}}, ['a'])[1], [])

    def test_catalogue_order_only_change_does_not_write_config(self):
        self.assertEqual(self.execute({'a': {'context_length': 524288}, 'b': {}}, ['b', 'a'])[1], [])

    def test_non_discovered_curated_mapping_not_replaced(self):
        self.assertEqual(self.execute({'a': {'context_length': 524288}}, ['b'], False)[1], [])

    def test_list_of_ids_remains_supported_and_removed_model_not_kept(self):
        _, saved = self.execute(['old'], ['new'])
        self.assertEqual(saved[0]['custom_providers'][0]['models'], {'new': {}})

    def test_preserves_bom_crlf_and_all_bytes_outside_function(self):
        raw = b'\xef\xbb\xbf' + SOURCE.replace('\n', '\r\n').encode()
        result = build_patch(raw)
        self.assertTrue(result.startswith(b'\xef\xbb\xbf# prefix must survive\r\n'))
        self.assertTrue(result.endswith(b'# suffix must survive\r\n'))
        self.assertNotIn(b'\n', result.replace(b'\r\n', b''))

    def test_unknown_and_already_patched_source_rejected(self):
        for raw in [SOURCE.replace(OLD, '            pass').encode(), build_patch(SOURCE.encode()),
                    SOURCE.replace(FUNCTION, 'unrelated_function').encode()]:
            with self.assertRaises(ValueError): build_patch(raw)


if __name__ == '__main__': unittest.main()
