"""Remote OK feed provenance and bounded snapshot configuration."""

SOURCE_ID = "remoteok"
SAMPLE_LIMIT = 100
REFRESH_SECONDS = 24 * 60 * 60
REMOTEOK_SOURCE = {
    "id": SOURCE_ID,
    "name": "Remote OK",
    "url": "https://remoteok.com/api",
    "website_url": "https://remoteok.com",
    "documentation_url": "https://remoteok.com/faq#feeds-sponsorship",
    "terms_url": "https://remoteok.com/legal",
    "terms_reviewed_on": "2026-10-21",
    "permitted_use": (
        "The official FAQ offers free public feeds for aggregators/sharing. Credit Remote OK "
        "and link to each original Remote OK posting without nofollow. No logo is used. "
        "This is conditional API use, not an open-data licence."
    ),
    "coverage": (
        "A bounded sample from one remote-job board with international, country-restricted, "
        "and unspecified location labels. Not a representative global labour-market sample."
    ),
    "measurement": (
        "Number and share of retained feed postings containing an exact configured skill "
        "phrase in title, provider tags, or description. Each posting counts once per skill."
    ),
    "limitations": (
        "Snapshot only: no historical growth, vacancy totals, or forecast is calculated. "
        "Feed membership does not confirm that a job is still open. Publication dates may "
        "reflect reposting. Keyword mentions are not verified skill requirements; missing "
        "mentions are not evidence a skill is unnecessary. Coverage and tags may be biased."
    ),
    "refresh_policy": (
        "Manual, at most one attempt per 24 hours. The provider publishes no numeric limit "
        "in the cited FAQ; this conservative cache policy is an application limit."
    ),
    "sample_limit": SAMPLE_LIMIT,
}

# Exact phrase rules, not model inference. Broad AI mentions do not imply an AI subtopic.
SKILL_PHRASES = [
    ("local:python-programming", "Python programming", ["python"]),
    ("mention:sql", "SQL", ["sql"]),
    ("local:machine-learning", "Machine learning", ["machine learning", "machine-learning", "ml"]),
    ("local:data-analysis", "Data analysis", ["data analysis", "data analytics"]),
    ("mention:ai", "Artificial intelligence", ["artificial intelligence", "ai"]),
    ("mention:javascript", "JavaScript", ["javascript"]),
    ("mention:typescript", "TypeScript", ["typescript"]),
    ("local:spreadsheet-analysis", "Spreadsheet analysis", ["excel", "spreadsheets"]),
    ("local:communication", "Communication", ["communication"]),
    ("local:project-planning", "Project planning", ["project planning", "project management"]),
    ("local:customer-service", "Customer service", ["customer service", "customer support"]),
]

TOPIC_PHRASES = {
    "llms": ["large language model", "large language models", "llm", "llms"],
    "ai_agents": ["ai agent", "ai agents", "agentic"],
    "rag": ["retrieval augmented generation", "retrieval-augmented generation"],
    "computer_vision": ["computer vision", "image recognition"],
    "responsible_ai": ["responsible ai", "ai ethics", "ai governance", "ai safety"],
}
