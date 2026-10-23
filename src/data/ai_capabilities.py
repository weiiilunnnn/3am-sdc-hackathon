"""Canonical labels and aliases for extraction, never current-skill recommendations."""

CAPABILITIES = (
    ("ai:agents", "AI agents", "Systems that perform multi-step tasks using tools and human checks.",
     ("AI agents", "AI agent", "agentic systems", "agent architecture")),
    ("ai:evaluation", "AI model evaluation", "Testing AI outputs against examples, criteria and failure cases.",
     ("model evaluation", "LLM evaluation", "AI evaluation", "evaluation criteria", "model testing")),
    ("ai:retrieval", "Retrieval for AI", "Finding relevant source information to ground an AI response.",
     ("retrieval augmented generation", "RAG", "semantic search", "vector search")),
    ("ai:workflows", "AI workflow design", "Combining AI and human steps in a work process.",
     ("AI workflows", "AI workflow", "AI-assisted workflow")),
    ("ai:machine-learning", "Machine learning", "Using trained models to identify patterns or produce predictions.",
     ("machine learning", "ML models", "predictive models")),
)

BY_ID = {item[0]: item for item in CAPABILITIES}
