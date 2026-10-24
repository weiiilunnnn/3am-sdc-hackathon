#!/usr/bin/env python3
"""Refresh local O*NET and Anthropic research evidence (manual, not page-load).

Runs with APP_DB_PATH pointing to the SAME SQLite DB as scripts/dev.py.
Use --onet-file/--anthropic-task-file/--anthropic-job-file for offline imports.
"""
from __future__ import annotations
import argparse
import sys
from pathlib import Path
from urllib.request import Request, urlopen

from src.services.disruption_reference import import_references, reference_status

# Download only the required table, not the entire 16 MB O*NET database.
ONET_TASKS = 'https://www.onetcenter.org/dl_files/database/db_31_0_csv/task_statements.csv'
ANTHROPIC_TASKS = 'https://huggingface.co/datasets/Anthropic/EconomicIndex/resolve/main/labor_market_impacts/task_penetration.csv'
ANTHROPIC_JOBS = 'https://huggingface.co/datasets/Anthropic/EconomicIndex/resolve/main/labor_market_impacts/job_exposure.csv'


def download(url: str, cap: int = 65_000_000) -> bytes:
    request=Request(url,headers={'User-Agent':'PathwaayHackathon-ResearchPrototype/0.2','Accept':'application/octet-stream'})
    with urlopen(request,timeout=60) as response:
        data=response.read(cap+1)
        expected=response.headers.get("Content-Length")
        if expected is not None and len(data) < int(expected):
            raise ValueError("Source download was truncated; refusing an incomplete dataset")
        if len(data)>cap:
            raise ValueError('Source exceeds reasonable download size; refused')
        if len(data)<100:
            raise ValueError('Source is too small to contain research data')
        return data


def main():
    from src.environment import load_backend_environment
    load_backend_environment()
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('--onet-file',type=Path,help='Official O*NET 31.0 CSV ZIP or Task Statements.csv')
    p.add_argument('--anthropic-task-file',type=Path,help='Anthropic task_penetration.csv')
    p.add_argument('--anthropic-job-file',type=Path,help='Anthropic job_exposure.csv')
    p.add_argument('--status',action='store_true',help='Show imported version and source counts')
    args=p.parse_args()
    if args.status:
        print(reference_status());return 0
    sources=[('O*NET 31.0 Task Statements',args.onet_file,ONET_TASKS),
             ('Anthropic task penetration',args.anthropic_task_file,ANTHROPIC_TASKS),
             ('Anthropic occupation exposure',args.anthropic_job_file,ANTHROPIC_JOBS)]
    blobs=[]
    for name,local,url in sources:
        print('Reading',name, 'from '+str(local) if local else 'from official source... ',flush=True)
        try:
            blobs.append(local.read_bytes() if local else download(url))
        except Exception as e:
            print(f'ERROR reading {name}: {e}',file=sys.stderr)
            print('For manual files download O*NET CSV at https://www.onetcenter.org/database.html '
                  'and Anthropic CSVs at https://huggingface.co/datasets/Anthropic/EconomicIndex/tree/main/labor_market_impacts; '
                  'then use --onet-file, --anthropic-task-file and --anthropic-job-file.',file=sys.stderr)
            return 1
    try:
        report=import_references(*blobs)
    except (ValueError,OSError) as e:
        print('ERROR: old database kept; import rejected:',e,file=sys.stderr)
        return 1
    print('Imported O*NET',report['onet_version'], 'tasks:',report['onet_rows'])
    print('Anthropic occupation rows:',report['anthropic_job_rows'],'Task-text matches:',report['matched_tasks'])
    print('Data used from published sources, not a job replacement forecast.')
    return 0

if __name__=='__main__':raise SystemExit(main())
