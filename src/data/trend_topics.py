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
    "Count of OpenAlex Works search results for the quoted topic phrase, grouped by publication year. "
    "Search covers titles, abstracts, available full text and provider keywords."
)

LIMITATIONS = (
    "This is research activity, not employer demand. OpenAlex may stem words and match provider "
    "keywords; a quoted query is not a strict unstemmed full-text match. Topics can overlap, "
    "and index coverage changes over time."
)

TREND_TOPICS = [
    {
        "id": "llms",
        "label": "Large language models",
        "query": "large language model",
        "definition": 'OpenAlex Works search query: "large language model".',
    },
    {
        "id": "ai_agents",
        "label": "AI agents",
        "query": "AI agent",
        "definition": 'OpenAlex Works search query: "AI agent".',
    },
    {
        "id": "rag",
        "label": "Retrieval-augmented generation",
        "query": "retrieval augmented generation",
        "definition": 'OpenAlex Works search query: "retrieval augmented generation".',
    },
    {
        "id": "computer_vision",
        "label": "Computer vision",
        "query": "computer vision",
        "definition": 'OpenAlex Works search query: "computer vision".',
    },
    {
        "id": "responsible_ai",
        "label": "Responsible AI",
        "query": "responsible AI",
        "definition": 'OpenAlex Works search query: "responsible AI".',
    },
]

TREND_TOPICS_BY_ID = {topic["id"]: topic for topic in TREND_TOPICS}
