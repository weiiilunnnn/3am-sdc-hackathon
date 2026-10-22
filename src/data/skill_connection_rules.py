"""Reviewable candidate links. These definitions propose relevance, not observed demand."""

from __future__ import annotations

from dataclasses import dataclass

MAPPING_VERSION = "skill-connections-v2"


@dataclass(frozen=True)
class ConnectionRule:
    id: str
    current_skill_id: str
    ai_skill_id: str
    ai_skill_name: str
    definition: str
    relationship: str
    task: str
    explanation: str
    source_terms: tuple[str, ...]
    target_terms: tuple[str, ...]
    role_family: str | None
    basis: str


RULES = (
    ConnectionRule(
        "python-ai-evaluation", "local:python-programming", "ai:model-evaluation",
        "AI model evaluation",
        "Testing model responses with examples, rubrics and failure checks.",
        "builds_on", "Testing software and checking outputs",
        "Use programming and testing experience to create checks for AI model responses.",
        ("python",), ("model testing", "evaluation criteria", "agent quality"),
        "software_engineering", "same_posting",
    ),
    ConnectionRule(
        "python-ai-agents", "local:python-programming", "ai:agent-development",
        "AI agent development",
        "Building AI systems that carry out multi-step tasks with tools and human checks.",
        "changes_workflow", "Building software",
        "Build and monitor multi-step AI workflows alongside conventional backend systems.",
        ("python",), ("build ai agents", "ai agent architecture", "production-grade ai agents"),
        "software_engineering", "same_posting",
    ),
    ConnectionRule(
        "communication-ai-workflows", "local:communication", "ai:workflow-design",
        "AI workflow design",
        "Turning a team's process into a task flow with clear AI and human responsibilities.",
        "builds_on", "Explaining work to other people",
        "Use communication skills to understand a team's process before designing an AI-assisted workflow.",
        ("communication",), ("understand their work", "design, ship and iterate on agents"),
        "software_engineering", "same_posting",
    ),
    ConnectionRule(
        "database-ai-retrieval", "local:search-databases", "ai:retrieval-design",
        "Retrieval for AI applications",
        "Preparing searchable, trusted data that an AI application can use as context.",
        "builds_on", "Finding information in databases",
        "Apply database-search thinking to the data context used by AI applications.",
        ("data platform", "database"), ("powers ai agents", "trusted business context"),
        None, "shared_data_task",
    ),
)
