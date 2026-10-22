"""Explicit, bounded operator actions for optional RunPod signal processing."""

from __future__ import annotations

import argparse
import json

from src.services.connection_model import prepare_connection_explanation, prepare_model_extraction


def main() -> None:
    parser = argparse.ArgumentParser()
    actions = parser.add_subparsers(dest="action", required=True)
    extract = actions.add_parser("extract", help="Process one saved job description")
    extract.add_argument("document_id")
    explain = actions.add_parser("explain", help="Explain one saved supported connection")
    explain.add_argument("connection_id")
    args = parser.parse_args()
    result = (prepare_model_extraction(args.document_id) if args.action == "extract"
              else prepare_connection_explanation(args.connection_id))
    print(json.dumps(result, ensure_ascii=False))


if __name__ == "__main__":
    main()
