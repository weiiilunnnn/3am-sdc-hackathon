"""Local synthetic evaluation; reports facts from the installed index only."""
import hashlib
import json
from pathlib import Path
import statistics
import sys
from time import perf_counter

ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT))
from src.occupation_index import get_occupation_index
from src.data_repository import get_catalogues
from src.models import UserProfile, ProfileSkill
from src.profile_relevance import discover


def evaluate():
    started=perf_counter();index=get_occupation_index();cold=(perf_counter()-started)*1000
    if index.coverage!='local_full':
        raise SystemExit('Full index unavailable; evaluation must not claim full statistics.')
    names={s.name:s for s in index.skills.values()}
    missing_terms=[]
    def profile(pid,terms):
        chosen,unknown={},[]
        for term in terms:
            candidates=index.aliases.get(' '.join(term.casefold().split()),set())
            skill=names.get(term) or (index.skills[next(iter(candidates))] if len(candidates)==1 else None)
            if skill:chosen[skill.skill_id]=ProfileSkill(skill_id=skill.skill_id,name=skill.name)
            else:unknown.append(term);missing_terms.append(term)
        return UserProfile(schema_version='1.0',profile_id='demo-discovery-'+pid,is_synthetic=True,
            education='Synthetic '+pid.replace('-',' ')+' profile',skills=list(chosen.values()),unresolved_skills=unknown,
            learning_preferences={'hours_per_week':5,'budget':{'amount':0,'currency':'MYR'}})
    profiles=[
        profile('data',['Python (computer programming)','SQL','machine learning']),
        profile('web',['HTML','CSS','JavaScript','React','web programming','use markup languages']),
        profile('business',['Excel','accounting','financial reporting','financial statements','prepare financial statements']),
        profile('generic-one',['communication']),
        profile('generic-two',['work in teams','build team spirit']),
        profile('specific-one',['Python (computer programming)']),
        profile('unknown',['Pyhton typo','not a reviewed skill']),
        profile('empty',[]),
        profile('mixed',['Python (computer programming)','SQL','machine learning','accounting','financial statements','CSS','work in teams','JavaScript']),
    ]
    alias=profile('aliases',['Python (computer programming)'])
    alias.skills.append(ProfileSkill(skill_id='Python',name='Python'))
    profiles.append(alias)
    fixture={'schema_version':'1.0','profiles':[p.model_dump(mode='json') for p in profiles]}
    (ROOT/'data/demo/discovery_profiles.json').write_text(json.dumps(fixture,indent=2)+'\n',encoding='utf-8')
    rows=[]
    for p in get_catalogues().profiles+profiles:
        durations=[]
        for _ in range(3):
            t=perf_counter();response=discover(p,index);durations.append((perf_counter()-t)*1000)
        rows.append({'profile_id':p.profile_id,'recognised_count':response.recognised_user_skill_count,
            'unknown_terms':response.unknown_user_skills,'qualification_count':response.total_qualifying_roles,
            'candidate_count':response.discovered_candidate_count,'status':response.status,
            'diagnostics':response.diagnostic_counts,'median_matching_ms':round(statistics.median(durations),3),
            'top_results':[{'role_id':r.role_id,'title':r.role_title,'profile_relevance_pct':r.score.profile_relevance_pct,
                'strict_coverage_pct':r.score.essential_coverage_pct,'qualification_reason':r.qualification_reason} for r in response.results[:3]]})
    baseline=json.loads((ROOT/'docs/future-role-baseline.json').read_text())
    preserved={p:hashlib.sha256((ROOT/p).read_bytes()).hexdigest()==h for p,h in baseline['files'].items()}
    report={'esco_release':index.catalog.dataset_version,'data_source_status':index.coverage,'occupation_count':index.n,
        'skill_count':len(index.skills),'index_cold_load_ms':round(cold,3),'upstream_requests_during_matching':0,
        'unmapped_requested_terms':sorted(set(missing_terms)),'preserved_reskilling_hashes':preserved,'profiles':rows}
    from fastapi.testclient import TestClient
    from src.main import app
    client=TestClient(app)
    api=[]
    for p in get_catalogues().profiles:
        times=[]
        for _ in range(3):
            t=perf_counter();r=client.post('/api/v2/matches',json={'schema_version':'2.0','profile':p.model_dump(mode='json')})
            r.raise_for_status();times.append((perf_counter()-t)*1000)
        api.append({'profile_id':p.profile_id,'median_local_asgi_request_ms':round(statistics.median(times),3),'response_bytes':len(r.content)})
    report['api_measurements']=api
    (ROOT/'docs/discovery-evaluation.json').write_text(json.dumps(report,indent=2)+'\n',encoding='utf-8')
    print('Evaluated',len(rows),'synthetic profiles;',index.n,'occupations;',len(index.skills),'concepts')
    print('Unmapped requested terms:',', '.join(report['unmapped_requested_terms']))
    print('Reskilling files unchanged:',all(preserved.values()))
    for row in rows:print(row['profile_id'],row['recognised_count'],'recognised;',row['qualification_count'],'qualified;',row['median_matching_ms'],'ms')


if __name__=='__main__':evaluate()
