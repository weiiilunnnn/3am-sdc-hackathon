"""SH features against Main's real persistence and versioned skill catalogue."""
import os
import tempfile
import unittest
from unittest.mock import patch
from fastapi.testclient import TestClient
from src.main import app
from src.services.esco_skill_mapper import esco_status, normalise_skill
from src.services.registration_cv import validate_extracted_resume, RegistrationCVError
from src.services.disruption_reference import import_references, occupation_research
import test_hybrid_profiles as hybrid


class CVPersistenceTests(unittest.TestCase):
    setUp = hybrid.HybridProfileTests.setUp
    tearDown = hybrid.HybridProfileTests.tearDown
    create = hybrid.HybridProfileTests.create
    def test_cv_snapshot_survives_create_update_and_recovery(self):
        skill = normalise_skill('Python')
        self.assertIsNotNone(skill['esco_uri'])
        self.draft['skills'] = [{'name': skill['canonical_name'], 'skill_id': skill['esco_uri'], 'proficiency': 'unknown'}]
        snapshot = self.draft['registration_profile']
        snapshot['skills'] = [skill['canonical_name']]
        snapshot['skillLinks'] = [{'name': skill['canonical_name'], 'skill_id': skill['esco_uri'],
            'taxonomy_source': skill['taxonomy_source'], 'esco_uri': skill['esco_uri'],
            'esco_label': skill['canonical_name'], 'source_version': skill['source_version'], 'original_text':'Python'}]
        snapshot['cvDetails'] = {'phone': '+60 12-345 6789', 'languages': 'English',
            'projects': [{'id':'cv-project-1','title':'Fixture project','description':'Confirmed details'}]}
        first = self.create('cv-integration-roundtrip')
        raw = self.client.get('/api/profiles/'+first['id']).json()
        self.assertEqual(raw['registration_profile']['cvDetails']['projects'][0]['description'], 'Confirmed details')
        self.assertEqual(raw['skills'][0]['skill_id'],skill['esco_uri'])
        adapted = self.client.get('/api/v2/profiles/'+first['id']).json()
        self.assertIn(skill['esco_uri'],[s['skill_id'] for s in adapted['skills']])
        snapshot['cvDetails']['languages'] = 'English, Malay'
        updated = self.client.put('/api/profiles/'+first['id'],json=self.draft,headers={'If-Match':first['updated_at']})
        self.assertEqual(updated.status_code,200,updated.text)
        self.assertEqual(updated.json()['registration_profile']['cvDetails']['languages'],'English, Malay')
        stale = self.client.put('/api/profiles/'+first['id'],json=self.draft,headers={'If-Match':first['updated_at']})
        self.assertEqual(stale.status_code,409)

    def test_cv_snapshot_is_bounded(self):
        self.draft['registration_profile']['cvDetails'] = {'phone': '1'*31}
        self.assertEqual(self.client.post('/api/profiles',json=self.draft).status_code,422)


class CVFeatureTests(unittest.TestCase):
    def test_bundled_index_and_ambiguous_skills(self):
        status = esco_status()
        self.assertTrue(status['loaded'])
        self.assertEqual(status['concept_count'],14359)
        self.assertEqual(normalise_skill('Python')['taxonomy_source'],'ESCO v1.2.1')
        self.assertIsNone(normalise_skill('SQL')['esco_uri'])
        self.assertIsNone(normalise_skill('generic programmes and qualifications')['esco_uri'])

    def test_resume_requires_literal_support(self):
        text = 'Fixture Learner studied Computing and used Python.'
        result = validate_extracted_resume({'is_cv':True,'fields':{
            'full_name':{'value':'Fixture Learner','quote':'Fixture Learner'},
            'major':{'value':'Computing','quote':'studied Computing'},
            'university':{'value':'Invented University','quote':'studied Computing'}},
            'skills':[{'value':'Python','quote':'used Python'},{'value':'Java','quote':'used Python'}]},text)
        self.assertEqual(result['fields']['university'],'')
        self.assertEqual(len(result['skills']),1)
        self.assertTrue(result['warnings'])
        with self.assertRaises(RegistrationCVError):
            validate_extracted_resume({'is_cv':False},text)

    def test_upload_consent_and_invalid_file_do_not_call_model(self):
        with tempfile.TemporaryDirectory() as tmp, patch.dict(os.environ, {'APP_DB_PATH': tmp+'/app.sqlite3'}), TestClient(app) as client, patch('src.services.registration_cv._generate') as model:
            response = client.post('/api/profiles/extract-registration-cv-async',content=b'invalid')
            self.assertEqual(response.status_code,400)
            response = client.post('/api/profiles/extract-registration-cv-async',content=b'invalid',headers={
                'X-CV-Processing-Consent':'true','X-Filename':'fixture.pdf','Content-Type':'application/pdf'})
            self.assertEqual(response.status_code,422)
            model.assert_not_called()

    def test_disruption_import_and_insufficient_evidence(self):
        with tempfile.TemporaryDirectory() as tmp, patch.dict(os.environ,{'APP_DB_PATH':tmp+'/app.sqlite3'}):
            onet = b'O*NET-SOC Code,Task ID,Task,Title,Task Type\n15-1252.00,1,Write software programs,Software developers,Core\n15-1252.00,2,Test software programs,Software developers,Core\n'
            tasks = b'task,penetration\nWrite software programs,0.2\nTest software programs,0.1\n'
            jobs = b'occ_code,title,observed_exposure\n15-1252,Software developers,0.2\n'
            import_references(onet,tasks,jobs,min_onet=2,min_anthropic=2,min_jobs=1)
            self.assertEqual(occupation_research('15-1252',{'id':'local:python-programming','name':'Python'})['status'],'task_evidence_available')
            self.assertEqual(occupation_research('15-1252',{'id':None,'name':'Baking'})['status'],'skill_task_link_insufficient')
            with self.assertRaises(ValueError):
                import_references(b'invalid',tasks,jobs,min_onet=2,min_anthropic=2,min_jobs=1)
            self.assertEqual(occupation_research('15-1252',{'id':'local:python-programming','name':'Python'})['status'],'task_evidence_available')
