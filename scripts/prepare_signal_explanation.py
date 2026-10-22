"""Explicitly prepare one optional cached RunPod explanation; never run on page GET."""

from __future__ import annotations

import argparse
import json

from src.services.signal_explanations import prepare_explanation
from src.services.trend_experience import get_trend_experience


def main() -> None:
    parser = argparse.ArgumentParser()
    choice = parser.add_mutually_exclusive_group(required=True)
    choice.add_argument("--sample-id")
    choice.add_argument("--profile-id")
    args = parser.parse_args()
    experience = get_trend_experience(sample_id=args.sample_id, profile_id=args.profile_id)
    if not experience or not experience["insights"]:
        raise SystemExit("No supported profile finding is cached; no model call was made.")
    result = prepare_explanation(experience["profile"], experience["insights"][0])
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
