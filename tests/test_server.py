import copy
import http.client
import json
from pathlib import Path
import tempfile
import threading
import unittest
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from server.app import Store, Problem, make_server, openapi


class DataTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.store = Store(self.temp.name)

    def tearDown(self):
        self.temp.cleanup()

    def test_nine_real_courses_and_nested_folders(self):
        self.store.seed()
        nodes = self.store.nodes()
        courses = [n for n in nodes if n['kind'] == 'course']
        self.assertEqual(len(courses), 9)
        self.assertIn('International Trade', [n['title'] for n in courses])
        self.assertEqual(len([n for n in nodes if n['kind'] == 'folder']), 45)
        course = next(n for n in courses if n['title'] == 'International Trade')
        topics = next(n for n in nodes if n['parent_id'] == course['id'] and n['title'] == 'Temas')
        topic = next(n for n in nodes if n['parent_id'] == topics['id'] and n['title'] == 'Tema 1')
        self.assertTrue(any(n['parent_id'] == topic['id'] and n['title'] == 'Apuntes' for n in nodes))

    def test_edit_move_restart_and_delete_cascade(self):
        course = self.store.create({'kind': 'course', 'title': 'International Trade'})
        folder = self.store.create({'kind': 'folder', 'title': 'Tema 2', 'parent_id': course['id']})
        note = self.store.create({'kind': 'note', 'title': 'Ventaja comparativa', 'content': 'Coste de oportunidad', 'parent_id': folder['id']})
        self.store.update(note['id'], {'content': '## Ricardo\n\n**Coste de oportunidad**', 'pinned': True})
        after_restart = Store(self.temp.name)
        saved = next(n for n in after_restart.nodes() if n['id'] == note['id'])
        self.assertIn('Ricardo', saved['content'])
        self.assertTrue(saved['pinned'])
        after_restart.update(note['id'], {'parent_id': course['id']})
        after_restart.delete(folder['id'])
        self.assertEqual(len(after_restart.nodes()), 2)
        after_restart.delete(course['id'])
        self.assertEqual(after_restart.nodes(), [])

    def test_invalid_parent_cycle_and_concurrent_edit_preserve_data(self):
        folder = self.store.create({'kind': 'folder', 'title': 'Tema 1'})
        child = self.store.create({'kind': 'folder', 'title': 'Apuntes', 'parent_id': folder['id']})
        with self.assertRaises(Problem):
            self.store.update(folder['id'], {'parent_id': child['id']})
        with self.assertRaises(Problem):
            self.store.create({'kind': 'note', 'title': 'No guardar', 'parent_id': 'missing'})
        updated = self.store.update(folder['id'], {'title': 'Tema actualizado'})
        with self.assertRaises(Problem) as error:
            self.store.update(folder['id'], {'title': 'Contenido antiguo', 'expected_updated_at': folder['updated_at']})
        self.assertEqual(error.exception.status, 409)
        self.assertEqual(self.store.nodes()[0]['title'], updated['title'])

    def test_backup_roundtrip_excludes_credentials(self):
        self.store.set_password('una-contraseña-de-prueba', 'Ginés')
        self.store.seed()
        self.store.chatgpt_document({'path': ['International Trade', 'Temas', 'Tema 1', 'Apuntes'], 'title': 'Mi resumen', 'content': 'Contenido privado'})
        backup = self.store.backup()
        self.assertNotIn('password_hash', json.dumps(backup))
        self.assertNotIn('api_key_hash', json.dumps(backup))
        temp2 = tempfile.TemporaryDirectory()
        try:
            target = Store(temp2.name)
            target.restore(backup)
            self.assertEqual(target.nodes(), self.store.nodes())
            self.assertTrue(any(a['actor'] == 'ChatGPT' for a in target.activity()))
            self.assertIsNone(target.setting('password_hash'))
        finally:
            temp2.cleanup()

    def test_invalid_backup_is_atomic(self):
        self.store.seed()
        before = self.store.nodes()
        malformed = copy.deepcopy(self.store.backup())
        malformed['nodes'][0]['parent_id'] = 'nonexistent'
        with self.assertRaises(Problem):
            self.store.restore(malformed)
        self.assertEqual(before, self.store.nodes())
        malformed = copy.deepcopy(self.store.backup())
        folder = next(n for n in malformed['nodes'] if n['kind'] == 'folder')
        folder['parent_id'] = folder['id']
        with self.assertRaises(Problem):
            self.store.restore(malformed)
        self.assertEqual(before, self.store.nodes())

    def test_chatgpt_routes_to_existing_folders_and_retries_are_idempotent(self):
        self.store.seed()
        count = len(self.store.nodes())
        request = {'path': ['International Trade', 'Temas', 'Tema 1', 'Apuntes'], 'title': 'Comparative advantage', 'content': '# Ricardo', 'request_id': 'test-unique-123'}
        created = self.store.chatgpt_document(request)
        self.assertEqual(len(self.store.nodes()), count + 1)
        self.assertEqual(self.store.chatgpt_document(request)['id'], created['id'])
        self.assertEqual(len(self.store.nodes()), count + 1)
        with self.assertRaises(Problem):
            self.store.chatgpt_document({**request, 'content': 'Otro contenido'})
        self.assertEqual(self.store.activity()[0]['actor'], 'ChatGPT')

    def test_chatgpt_rejects_ambiguous_folder_and_rolls_back(self):
        course = self.store.create({'kind': 'course', 'title': 'Trade'})
        self.store.create({'kind': 'folder', 'title': 'Tema 1', 'parent_id': course['id']})
        self.store.create({'kind': 'folder', 'title': 'tema 1', 'parent_id': course['id']})
        before = self.store.nodes()
        with self.assertRaises(Problem):
            self.store.chatgpt_document({'path': ['Trade', 'Tema 1'], 'title': 'Nuevo', 'content': 'No guardar'})
        self.assertEqual(before, self.store.nodes())


class HTTPTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.server = make_server(port=0, directory=self.temp.name)
        self.thread = threading.Thread(target=self.server.serve_forever, daemon=True)
        self.thread.start()
        self.cookie = ''

    def tearDown(self):
        self.server.shutdown()
        self.server.server_close()
        self.thread.join()
        self.temp.cleanup()

    def request(self, path, method='GET', body=None, headers=None):
        connection = http.client.HTTPConnection('127.0.0.1', self.server.server_port, timeout=5)
        h = {'Content-Type': 'application/json', 'Cookie': self.cookie, **(headers or {})}
        connection.request(method, path, json.dumps(body) if body is not None else None, h)
        response = connection.getresponse()
        status = response.status
        cookie = response.getheader('Set-Cookie')
        content = response.read()
        connection.close()
        if cookie:
            self.cookie = cookie.split(';')[0]
        return status, json.loads(content)

    def setup_account(self):
        status, _ = self.request('/api/auth/setup', 'POST', {'name': 'Ginés', 'password': 'contraseña-de-prueba-123', 'template': True})
        self.assertEqual(status, 201)

    def test_authentication_logout_and_rate_limit(self):
        self.assertEqual(self.request('/api/state')[0], 401)
        self.setup_account()
        self.assertEqual(self.request('/api/state')[0], 200)
        self.request('/api/auth/logout', 'POST')
        self.assertEqual(self.request('/api/state')[0], 401)
        self.assertEqual(self.request('/api/auth/login', 'POST', {'password': 'contraseña-de-prueba-123'})[0], 200)
        self.request('/api/auth/logout', 'POST')
        for _ in range(5):
            self.assertEqual(self.request('/api/auth/login', 'POST', {'password': 'wrong'})[0], 401)
        self.assertEqual(self.request('/api/auth/login', 'POST', {'password': 'wrong'})[0], 429)

    def test_private_key_read_create_and_revocation(self):
        self.setup_account()
        self.assertEqual(self.request('/api/chatgpt/tree')[0], 401)
        status, data = self.request('/api/key', 'POST')
        self.assertEqual(status, 200)
        key = data['key']
        h = {'Authorization': 'Bearer ' + key}
        self.assertEqual(self.request('/api/chatgpt/tree', headers=h)[0], 200)
        payload = {'path': ['International Trade', 'Temas', 'Tema 2', 'Apuntes'], 'title': 'Del chat a Aula', 'content': 'Un resumen de clase'}
        status, note = self.request('/api/chatgpt/documents', 'POST', payload, h)
        self.assertEqual(status, 201)
        self.assertEqual(note['title'], payload['title'])
        self.request('/api/key', 'DELETE')
        self.assertEqual(self.request('/api/chatgpt/tree', headers=h)[0], 401)

    def test_origin_host_and_public_setup_protection(self):
        self.setup_account()
        before = self.server.store.nodes()
        self.assertEqual(self.request('/api/nodes', 'POST', {'kind': 'note', 'title': 'Attack'}, {'Origin': 'https://evil.example'})[0], 403)
        self.assertEqual(self.request('/api/state', headers={'Host': 'evil.example'})[0], 403)
        self.assertEqual(self.server.store.nodes(), before)
        self.server.public_url = 'https://aula.example'
        self.assertEqual(self.request('/api/auth/setup', 'POST', {'password': 'another-password-123'})[0], 403)

    def test_local_mode_and_public_password_mode_are_separate(self):
        with self.assertRaises(ValueError):
            make_server(host='0.0.0.0', local_mode=True, directory=self.temp.name)
        self.server.local_mode = True
        self.assertEqual(self.request('/api/state')[0], 200)
        self.assertEqual(self.request('/api/chatgpt/tree')[0], 401)

    def test_openapi_matches_real_actions(self):
        status, schema = self.request('/api/openapi.json')
        self.assertEqual(status, 200)
        self.assertEqual(schema['openapi'], '3.1.0')
        self.assertEqual(schema['paths']['/api/chatgpt/documents']['post']['operationId'], 'saveStudyDocument')
        self.assertEqual(schema['components']['securitySchemes']['bearerAuth']['scheme'], 'bearer')


if __name__ == '__main__':
    unittest.main()
