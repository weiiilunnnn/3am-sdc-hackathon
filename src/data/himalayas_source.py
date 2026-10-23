"""Himalayas public API provenance and conservative collection policy."""

SOURCE_ID = "himalayas"
HIMALAYAS_SOURCE = {
    "id": SOURCE_ID,
    "name": "Himalayas",
    "url": "https://himalayas.app/jobs/api",
    "documentation_url": "https://himalayas.app/api",
    "terms_url": "https://himalayas.app/terms",
    "coverage": "Capped, browsed remote-job feed; eligibility is not the employer's location.",
    "refresh_policy": "One backend refresh per 24 hours; stop on rate limits and preserve the last good snapshot.",
}
