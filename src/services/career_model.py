"""Synthetic-data career matching and scenario estimation for Pathwaay."""

from __future__ import annotations

import csv
import os
from pathlib import Path
from typing import Any

import joblib
from sklearn.ensemble import RandomForestClassifier, RandomForestRegressor
from sklearn.feature_extraction import DictVectorizer

SRC_DIR = Path(__file__).resolve().parents[1]
PROJECT_ROOT = Path(__file__).resolve().parents[2]
DATA_DIR = Path(os.getenv("PATHWAAY_DATA_DIR", PROJECT_ROOT / "data"))
MODEL_DIR = Path(os.getenv("PATHWAAY_MODEL_DIR", PROJECT_ROOT / "models"))
PROFILE_DATA = DATA_DIR / "synthetic_role_profiles.csv"
TREND_DATA = DATA_DIR / "synthetic_skill_scenarios.csv"

ROLE_SKILLS = {
    "Data Analyst": ["SQL", "Data cleaning", "Business metrics", "Analytical reasoning"],
    "Business Intelligence Analyst": ["SQL", "Dashboard storytelling", "Business reporting", "Data modelling"],
    "Machine Learning Intern": ["Python", "Statistics", "Model evaluation", "Feature engineering"],
    "Product Analyst": ["Product metrics", "Experiment analysis", "SQL", "User behaviour analysis"],
    "Data Scientist": ["Machine learning", "Statistics", "Python", "Causal thinking"],
    "Machine Learning Engineer": ["Python", "Cloud deployment", "MLOps", "Model monitoring"],
    "AI Engineer": ["Python", "LLM evaluation", "Prompt and tool design", "Cloud deployment"],
    "Data Engineer": ["SQL", "Data pipelines", "Cloud platforms", "Data quality"],
}

INTERESTS = ("analytics", "ai", "business", "building", "communication", "product", "research")
SKILLS = ("python", "sql", "statistics", "visualization", "machine_learning", "cloud")


def _profile_features(profile: dict[str, Any]) -> dict[str, Any]:
    values: dict[str, Any] = {"major": str(profile.get("major", "other")).strip().lower().replace(" ", "_")}
    selected_interests = {str(item).lower().replace(" ", "_") for item in profile.get("interests", [])}
    selected_skills = {str(item).lower().replace(" ", "_") for item in profile.get("skills", [])}
    values.update({f"interest_{name}": int(name in selected_interests) for name in INTERESTS})
    values.update({f"skill_{name}": int(name in selected_skills) for name in SKILLS})
    values["experience_months"] = max(0, min(240, int(profile.get("experience_months", 6))))
    return values


def _read_rows(path: Path) -> list[dict[str, str]]:
    if not path.exists():
        raise RuntimeError(f"Required synthetic dataset is missing: {path}")
    with path.open(newline="", encoding="utf-8") as handle:
        return list(csv.DictReader(handle))


class CareerModel:
    """Two CPU-friendly scikit-learn models trained from the committed synthetic CSVs."""

    def __init__(self) -> None:
        self.profile_vectorizer = DictVectorizer(sparse=True)
        self.matcher = RandomForestClassifier(
            n_estimators=180, min_samples_leaf=2, class_weight="balanced_subsample",
            random_state=2026, n_jobs=-1,
        )
        self.trend_vectorizer = DictVectorizer(sparse=True)
        self.forecaster = RandomForestRegressor(
            n_estimators=180, min_samples_leaf=2, random_state=2026, n_jobs=-1,
        )
        self._load_or_train()

    def _load_or_train(self) -> None:
        matcher_file = MODEL_DIR / "role_matcher.joblib"
        forecast_file = MODEL_DIR / "skill_forecaster.joblib"
        if matcher_file.exists() and forecast_file.exists():
            self.profile_vectorizer, self.matcher = joblib.load(matcher_file)
            self.trend_vectorizer, self.forecaster = joblib.load(forecast_file)
            return

        profile_rows = _read_rows(PROFILE_DATA)
        x_profile = [
            {key: (int(value) if key.startswith(("interest_", "skill_")) or key == "experience_months" else value)
             for key, value in row.items() if key != "target_role"}
            for row in profile_rows
        ]
        y_profile = [row["target_role"] for row in profile_rows]
        self.matcher.fit(self.profile_vectorizer.fit_transform(x_profile), y_profile)

        trend_rows = _read_rows(TREND_DATA)
        x_trend = [{
            "role": row["role"], "skill": row["skill"], "year": int(row["year"]),
            "scenario": row["scenario"], "ai_exposure": float(row["ai_exposure"]),
            "skill_relevance": float(row["skill_relevance"]),
        } for row in trend_rows]
        y_trend = [float(row["demand_index"]) for row in trend_rows]
        self.forecaster.fit(self.trend_vectorizer.fit_transform(x_trend), y_trend)
        MODEL_DIR.mkdir(parents=True, exist_ok=True)
        joblib.dump((self.profile_vectorizer, self.matcher), matcher_file)
        joblib.dump((self.trend_vectorizer, self.forecaster), forecast_file)

    def recommend(self, profile: dict[str, Any]) -> dict[str, Any]:
        vector = self.profile_vectorizer.transform([_profile_features(profile)])
        probabilities = self.matcher.predict_proba(vector)[0]
        ranked = sorted(zip(self.matcher.classes_, probabilities), key=lambda item: item[1], reverse=True)
        return {
            "recommendations": [
                {"role": role, "score": round(float(score) * 100, 1), "skills": ROLE_SKILLS[role]}
                for role, score in ranked[:5]
            ],
            "scenario_estimates": {
                scenario: [self._forecast(role, scenario) for role, _score in ranked[:3]]
                for scenario in ("moderate", "fast")
            },
            "model": "synthetic-random-forest-v1",
            "data_notice": "Illustrative estimates from synthetic data; not observed labour-market forecasts.",
        }

    def _forecast(self, role: str, scenario: str) -> dict[str, Any]:
        year = 2030
        projections = []
        for skill in ROLE_SKILLS[role]:
            exposure = 0.34 + (list(ROLE_SKILLS).index(role) % 4) * 0.13
            relevance = 0.58 + ((ROLE_SKILLS[role].index(skill) * 7 + list(ROLE_SKILLS).index(role) * 3) % 5) * 0.08
            row = {"role": role, "skill": skill, "year": year, "scenario": scenario,
                   "ai_exposure": exposure, "skill_relevance": relevance}
            index = float(self.forecaster.predict(self.trend_vectorizer.transform([row]))[0])
            projections.append({"skill": skill, "demand_index": round(max(0, min(100, index)), 1)})
        return {"role": role, "year": year, "skills": projections}


_model: CareerModel | None = None


def get_model() -> CareerModel:
    global _model
    if _model is None:
        _model = CareerModel()
    return _model


def recommend(profile: dict[str, Any]) -> dict[str, Any]:
    return get_model().recommend(profile)
