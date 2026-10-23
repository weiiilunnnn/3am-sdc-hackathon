import io
import json
import unittest
from unittest.mock import Mock, patch
from urllib.error import URLError
from src.services.sources.esco import EscoClient, EscoError

URI='http://data.europa.eu/esco/occupation/00000000-0000-0000-0000-000000000000'


def response(data,headers=None):
    obj=io.BytesIO(json.dumps(data).encode());obj.headers=headers or {};return obj


class EscoClientTests(unittest.TestCase):
    def test_pinned_lookup_cache_and_unknown_returned_version(self):
        opener=Mock(return_value=response({'uri':URI,'className':'Occupation'}))
        client=EscoClient(opener=opener)
        first=client.fetch('occupation','v1.2.1',uri=URI)
        self.assertIsNone(first['returned_version'])
        self.assertEqual(first['requested_version'],'v1.2.1')
        self.assertTrue(client.fetch('occupation','v1.2.1',uri=URI)['cache_hit'])
        self.assertEqual(opener.call_count,1)
        self.assertIn('selectedVersion=v1.2.1',opener.call_args.args[0].full_url)

    def test_timeout_bounded_retry_and_malformed_payload(self):
        opener=Mock(side_effect=TimeoutError())
        with patch('src.services.sources.esco.sleep'):
            with self.assertRaises(EscoError):EscoClient(opener=opener,retries=1).fetch('occupation','v1.2.1',uri=URI)
        self.assertEqual(opener.call_count,2)
        with self.assertRaises(EscoError):EscoClient(opener=Mock(return_value=response([]))).fetch('occupation','v1.2.1',uri=URI)
        broken=io.BytesIO(b'not JSON');broken.headers={}
        with self.assertRaises(EscoError):EscoClient(opener=Mock(return_value=broken)).fetch('occupation','v1.2.1',uri=URI)

    def test_version_identity_mismatch_and_allowlist(self):
        for data in [{'uri':URI,'className':'Occupation','version':'v1.2.0'},{'uri':URI+'wrong','className':'Occupation'}]:
            with self.assertRaises(EscoError):EscoClient(opener=Mock(return_value=response(data))).fetch('occupation','v1.2.1',uri=URI)
        for kind,uri in [('occupation','https://example.org'),('skill',URI),('evil',URI)]:
            with self.assertRaises(EscoError):EscoClient().fetch(kind,'v1.2.1',uri=uri)

    def test_search_bounds_and_version_cache_separation(self):
        opener=Mock(side_effect=[response({'_embedded':{'results':[]}}),response({'_embedded':{'results':[]}})])
        client=EscoClient(opener=opener)
        client.fetch('skill','v1.2.1',text='Python',offset=1,limit=2)
        client.fetch('skill','v1.2.0',text='Python',offset=1,limit=2)
        self.assertEqual(opener.call_count,2)
        self.assertIn('offset=1',opener.call_args.args[0].full_url)
        for kwargs in [{'limit':101},{'offset':-1},{'text':'x'*101}]:
            with self.assertRaises(EscoError):client.fetch('skill','v1.2.1',**({'text':'x'}|kwargs))
