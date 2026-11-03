import base64
from concurrent.futures import ThreadPoolExecutor
import hashlib
import os
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

os.environ.setdefault('AUTH_SESSION_SECRET', 'test-session')
os.environ.setdefault('MCP_INTERNAL_API_TOKEN', 'test-internal')
from fastapi.testclient import TestClient
from mcp_service import server as s


class TokenTests(unittest.TestCase):
    def setUp(self):
        tmp = tempfile.TemporaryDirectory()
        self.addCleanup(tmp.cleanup)
        p = patch.object(s, 'DATA_DIR', Path(tmp.name))
        p.start()
        self.addCleanup(p.stop)
        self.client = TestClient(s.app)
        self.cid = s.register_oauth_client({'redirect_uris': ['https://example.com/cb']})['client_id']
        self.verifier = 'v' * 64
        challenge = base64.urlsafe_b64encode(hashlib.sha256(self.verifier.encode()).digest()).rstrip(b'=').decode()
        with s._connect() as db:
            db.execute('INSERT INTO oauth_codes VALUES(?,?,?,?,?,?,?,?,?,0)', (s._hash('code'), self.cid, 'user', 'user@example.com', 'https://example.com/cb', 'openid recordings:read', s.MCP_RESOURCE_URL, challenge, s._now() + 300))

    def post(self, **data):
        return self.client.post('/oauth/token', data={'client_id': self.cid, **data})

    def exchange(self):
        return self.post(grant_type='authorization_code', code='code', redirect_uri='https://example.com/cb', code_verifier=self.verifier)

    def test_persistence_rotation_replay(self):
        first = self.exchange()
        self.assertEqual(first.status_code, 200)
        token = first.json()['refresh_token']
        self.client = TestClient(s.app)
        result = self.post(grant_type='refresh_token', refresh_token=token)
        self.assertEqual(result.status_code, 200)
        self.assertNotEqual(token, result.json()['refresh_token'])
        self.assertEqual(s._decode_access_token(result.json()['access_token'])['sub'], 'user')
        self.assertEqual(self.post(grant_type='refresh_token', refresh_token=token).json()['error'], 'invalid_grant')
        self.assertEqual(self.exchange().json()['error'], 'invalid_grant')
        self.assertEqual(result.headers['cache-control'], 'no-store')
        with s._connect() as db:
            self.assertEqual(db.execute('SELECT count(*) FROM oauth_refresh_tokens').fetchone()[0], 1)
            self.assertNotEqual(db.execute('SELECT token_hash FROM oauth_refresh_tokens').fetchone()[0], result.json()['refresh_token'])

    def test_errors(self):
        for data, error in [({}, 'invalid_request'), ({'grant_type': 'password'}, 'unsupported_grant_type'), ({'grant_type': 'refresh_token'}, 'invalid_request'), ({'grant_type': 'refresh_token', 'refresh_token': 'secret', 'client_id': 'other'}, 'invalid_client'), ({'grant_type': 'refresh_token', 'refresh_token': 'secret', 'client_secret': 'secret'}, 'invalid_client')]:
            with self.subTest(data=data):
                response = self.post(**data)
                self.assertEqual(response.status_code, 400)
                self.assertEqual(response.json()['error'], error)
        response = self.client.post('/oauth/token', data={'grant_type': 'refresh_token', 'client_id': self.cid}, headers={'Authorization': 'Basic c2VjcmV0'})
        self.assertEqual(response.json()['error'], 'invalid_client')

    def test_binding_scope_expiry_pkce(self):
        response = self.post(grant_type='authorization_code', code='code', redirect_uri='https://example.com/cb', code_verifier='wrong')
        self.assertEqual(response.json()['error'], 'invalid_grant')
        token = self.exchange().json()['refresh_token']
        other = s.register_oauth_client({'redirect_uris': ['https://example.com/other']})['client_id']
        for extra, error in [({'client_id': other}, 'invalid_grant'), ({'resource': 'https://evil.example'}, 'invalid_target'), ({'scope': 'recordings:write'}, 'invalid_scope')]:
            self.assertEqual(self.post(grant_type='refresh_token', refresh_token=token, **extra).json()['error'], error)
        result = self.post(grant_type='refresh_token', refresh_token=token, scope='recordings:read')
        self.assertEqual(result.json()['scope'], 'recordings:read')
        with s._connect() as db:
            db.execute('UPDATE oauth_refresh_tokens SET expires_at=0')
        self.assertEqual(self.post(grant_type='refresh_token', refresh_token=result.json()['refresh_token']).json()['error'], 'invalid_grant')

    def test_parallel_refresh(self):
        token = self.exchange().json()['refresh_token']
        def redeem(_):
            client = TestClient(s.app)
            return client.post('/oauth/token', data={'client_id': self.cid, 'grant_type': 'refresh_token', 'refresh_token': token}).status_code
        with ThreadPoolExecutor(max_workers=2) as pool:
            self.assertEqual(sorted(pool.map(redeem, range(2))), [200, 400])

    def test_rollback(self):
        token = self.exchange().json()['refresh_token']
        with patch.object(s, 'issue_access_token', side_effect=RuntimeError('signing failed')):
            with self.assertRaises(RuntimeError):
                self.post(grant_type='refresh_token', refresh_token=token)
        self.assertEqual(self.post(grant_type='refresh_token', refresh_token=token).status_code, 200)

    def test_safe_logging(self):
        with self.assertLogs(s.__name__, level='INFO') as logs:
            self.post(grant_type='refresh_token', refresh_token='SECRET-REFRESH', client_secret='SECRET-CLIENT')
        text = '\n'.join(logs.output)
        self.assertIn('status=400', text)
        self.assertNotIn('SECRET', text)


if __name__ == '__main__':
    unittest.main()
