import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]


class CLITests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.variables = {**os.environ, 'AULA_DATA_DIR': str(Path(self.temp.name) / 'data')}

    def tearDown(self):
        self.temp.cleanup()

    def run_cli(self, *args, body=None):
        return subprocess.run([sys.executable, 'server/manage.py', *args], cwd=ROOT, env=self.variables, input=json.dumps(body) if body is not None else None, text=True, capture_output=True)

    def test_codex_save_uses_the_requested_path_and_is_repeatable(self):
        document = {'path': ['International Trade', 'Temas', 'Tema 1', 'Apuntes'], 'title': 'Resumen desde Codex', 'content': '# Una idea\n\nContenido solicitado.', 'request_id': 'cli-test-unique'}
        first = self.run_cli('save', body=document)
        self.assertEqual(first.returncode, 0, first.stderr)
        second = self.run_cli('save', body=document)
        self.assertEqual(second.returncode, 0, second.stderr)
        self.assertEqual(json.loads(first.stdout)['id'], json.loads(second.stdout)['id'])
        index = self.run_cli('list')
        self.assertEqual(index.returncode, 0, index.stderr)
        saved = next(n for n in json.loads(index.stdout) if n['kind'] == 'note')
        self.assertEqual(saved['path'], document['path'] + [document['title']])
        self.assertNotIn('content', saved)

    def test_export_preserves_files_and_import_requires_explicit_replacement(self):
        self.run_cli('save', body={'path': ['Trade', 'Apuntes'], 'title': 'Copia de mi clase', 'content': 'Texto que debe sobrevivir'})
        out = str(Path(self.temp.name) / 'backup.json')
        self.assertEqual(self.run_cli('export', '--out', out).returncode, 0)
        content = Path(out).read_text()
        self.assertNotEqual(self.run_cli('export', '--out', out).returncode, 0)
        self.assertEqual(Path(out).read_text(), content)
        self.assertNotEqual(self.run_cli('import', '--file', out).returncode, 0)
        self.assertEqual(self.run_cli('import', '--file', out, '--replace').returncode, 0)
        self.assertEqual(len(json.loads(self.run_cli('list').stdout)), 3)


if __name__ == '__main__':
    unittest.main()
