"""Reproducible OpenAlex search definitions for AI research activity."""

OPENALEX_SOURCE = {
    "id": "openalex",
    "name": "OpenAlex Works API",
    "url": "https://api.openalex.org/works",
    "documentation_url": "https://developers.openalex.org/",
    "authentication": "Basic queries work without a key; optional OPENALEX_API_KEY is supported.",
    "license": "OpenAlex metadata is CC0.",
    "license_url": "https://openalex.org/about",
    "source_type": "Scholarly research metadata",
}

MEASUREMENT = (
    "Count of OpenAlex Works records whose indexed searchable full text matches the "
    "topic phrase, grouped by publication year."
)

LIMITATIONS = (
    "This is research activity, not employer demand. Full-text phrase matches are an "
    "imperfect proxy, topic definitions can overlap, and OpenAlex coverage changes over time."
)

TREND_TOPICS = [
    {
        "id": "llms",
        "label": "Large language models",
        "query": "large language model",
        "definition": 'OpenAlex full-text search phrase: "large language model".',
    },
    {
        "id": "ai_agents",
        "label": "AI agents",
        "query": "AI agent",
        "definition": 'OpenAlex full-text search phrase: "AI agent".',
    },
    {
        "id": "rag",
        "label": "Retrieval-augmented generation",
        "query": "retrieval augmented generation",
        "definition": 'OpenAlex full-text search phrase: "retrieval augmented generation".',
    },
    {
        "id": "computer_vision",
        "label": "Computer vision",
        "query": "computer vision",
        "definition": 'OpenAlex full-text search phrase: "computer vision".',
    },
    {
        "id": "responsible_ai",
        "label": "Responsible AI",
        "query": "responsible AI",
        "definition": 'OpenAlex full-text search phrase: "responsible AI".',
    },
]

TREND_TOPICS_BY_ID = {topic["id"]: topic for topic in TREND_TOPICS}
