"""Publication safety invariants with synthetic canaries, no real key copies."""
from pathlib import Path
import importlib.util,tempfile,unittest,uuid
from unittest.mock import patch
spec=importlib.util.spec_from_file_location('publish_safety',Path(__file__).with_name('publish_safety.py'))
safety=importlib.util.module_from_spec(spec);spec.loader.exec_module(safety)
private=Path(__file__).parent/'private';private.mkdir(exist_ok=True)

class PublicationSafetyTests(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory(dir=private,prefix='scanner-canary-')
        self.root=Path(self.temp.name).resolve()
        assert self.root.is_relative_to(private.resolve())
        self.mock=patch.object(safety,'secret_values',return_value={'synthetic-'+uuid.uuid4().hex})
        self.canaries=self.mock.start().return_value
    def tearDown(self):
        self.mock.stop();self.temp.cleanup()
    def test_safe_text_passes(self):
        (self.root/'report.md').write_text('Fictional DEMO-001 only; config field disabled.',encoding='utf-8')
        self.assertTrue(safety.scan(self.root)['passed'])
    def test_exact_secret_canary_rejected(self):
        (self.root/'report.md').write_text(next(iter(self.canaries)),encoding='utf-8')
        self.assertFalse(safety.scan(self.root)['passed'])
    def test_token_pattern_rejected(self):
        (self.root/'report.md').write_text('ghp_'+'a'*32,encoding='utf-8')
        self.assertFalse(safety.scan(self.root)['passed'])
    def test_private_artifact_rejected(self):
        (self.root/'.env').write_text('FAKE=canary',encoding='utf-8')
        self.assertFalse(safety.scan(self.root)['passed'])

if __name__=='__main__':unittest.main()
