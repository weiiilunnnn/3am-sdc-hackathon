"""RunPod Serverless handler for synthetic career matching."""

import runpod
from src.services.career_model import recommend


def handler(job: dict) -> dict:
    profile = job.get("input", {}).get("profile", {})
    return {"output": recommend(profile)}


runpod.serverless.start({"handler": handler})
