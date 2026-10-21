"""Train Pathwaay's role matcher and scenario forecaster from synthetic CSVs."""

from pathlib import Path

from src.services.career_model import CareerModel, MODEL_DIR


if __name__ == "__main__":
    MODEL_DIR.mkdir(parents=True, exist_ok=True)
    (MODEL_DIR / "role_matcher.joblib").unlink(missing_ok=True)
    (MODEL_DIR / "skill_forecaster.joblib").unlink(missing_ok=True)
    CareerModel()
    print(f"Trained and saved model artifacts to {Path(MODEL_DIR).resolve()}")
