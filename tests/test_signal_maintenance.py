import os
import tempfile
import unittest
from unittest.mock import patch
from types import SimpleNamespace

from src.services.signal_maintenance import refresh_signal_evidence
from src.services.session_signal_adapter import SessionSkill, _resolved_skill
from src.services.skill_connections import extract_document
from src.services.storage import connection


class SignalMaintenanceTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.env = patch.dict(os.environ, {'APP_DB_PATH': self.tmp.name + '/test.sqlite3'})
        self.env.start()

    def tearDown(self):
        self.env.stop()
        self.tmp.cleanup()

    def test_fresh_database_populates_and_restarts_do_not_repeat_requests(self):
        with patch('src.services.signal_maintenance.reference_status', return_value={'ready': False}), \
             patch('scripts.refresh_disruption_references.download', return_value=b'data') as download, \
             patch('src.services.signal_maintenance.import_references', return_value={'matched_tasks': 200}) as imported, \
             patch('src.services.signal_maintenance.refresh_employment', return_value=SimpleNamespace(posting_count=3, refresh_status='success')), \
             patch('src.services.signal_maintenance.process_skill_connections', return_value={'connections': 1}) as extract, \
             patch('src.services.signal_maintenance.refresh_trends', return_value=SimpleNamespace(refresh_status='success')):
            result = refresh_signal_evidence()
            self.assertEqual(result['references']['matched_tasks'], 200)
            self.assertEqual(download.call_count, 3)
            imported.assert_called_once()
            extract.assert_called_once()
            self.assertEqual(refresh_signal_evidence(), {'status': 'cooldown'})
            self.assertEqual(download.call_count, 3)

    def test_provider_failure_does_not_block_other_sources(self):
        with patch('src.services.signal_maintenance.reference_status', side_effect=OSError('offline')), \
             patch('src.services.signal_maintenance.refresh_employment', side_effect=[SimpleNamespace(posting_count=0, refresh_status='failed'), SimpleNamespace(posting_count=5, refresh_status='success')]) as jobs, \
             patch('src.services.signal_maintenance.process_skill_connections', return_value={}) as extract, \
             patch('src.services.signal_maintenance.refresh_trends', return_value=SimpleNamespace(refresh_status='failed')):
            with self.assertLogs('src.services.signal_maintenance', level='ERROR'):
                result = refresh_signal_evidence()
            self.assertEqual(result['references'], 'failed')
            self.assertEqual(result['employment']['postings'], 5)
            self.assertEqual(jobs.call_count, 2)
            extract.assert_called_once()

    def test_profile_languages_resolve_and_extract_only_observed_passages(self):
        for name in ['JavaScript', 'TypeScript', 'SQL', 'HTML', 'CSS']:
            skill = _resolved_skill(SessionSkill(name=name, skill_id='https://example.test/esco'))
            self.assertEqual(skill['id'], 'local:' + name.lower())
            job = SimpleNamespace(source_job_id='test', title='Software Developer',
                evidence_text=f'Build AI agents using {name} to support customer enquiries.')
            document = extract_document(job)
            self.assertTrue(any(s['id'] == skill['id'] for task in document['tasks'] for s in task['skills']))
            self.assertTrue(document['tasks'][0]['ai_capabilities'])
        self.assertIsNone(_resolved_skill(SessionSkill(name='Unknown technology'))['id'])

    def test_bundled_research_is_attributed_and_never_replaces_existing_data(self):
        from src.services.storage import initialize_database
        from src.services.signal_maintenance import seed_research_cache
        from src.services.trend_service import get_dashboard
        initialize_database()
        seed_research_cache()
        dashboard = get_dashboard()
        self.assertEqual(len(dashboard.topics), 5)
        self.assertTrue(all(len(t.observations) >= 2 for t in dashboard.topics))
        self.assertTrue(all(o.data_mode == 'real' and 'api.openalex.org' in o.source_url for t in dashboard.topics for o in t.observations))
        with connection() as db:
            db.execute('UPDATE trend_observations SET value = 123456')
        seed_research_cache()
        self.assertTrue(all(o.value == 123456 for t in get_dashboard().topics for o in t.observations))

    def test_reference_download_rejects_truncated_payload(self):
        import io
        from scripts.refresh_disruption_references import download
        response = io.BytesIO(b'x' * 150)
        response.headers = {'Content-Length': '1000'}
        with patch('scripts.refresh_disruption_references.urlopen', return_value=response):
            with self.assertRaisesRegex(ValueError, 'truncated'):
                download('https://example.test/data.csv')
