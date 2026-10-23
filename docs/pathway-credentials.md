# Certifications and skill assessments

The pathway response now includes optional `credentials`, `credential_message`,
`credential_metrics` and `credential_used_cache` fields. Existing learning phases,
gap coverage, scores, scheduling and resource budgets are unchanged. The UI replaces
the Next Steps presentation with Certifications & Skill Assessments, retaining
uncovered requirements in a separate Remaining Learning Gaps disclosure.

## Discovery and constraints

The backend uses the existing shared GLM Runpod client for optional query planning
and evidence-grounded candidate evaluation. Tavily Search and Extract supply public
official-provider content through the existing transport. No new client or dependency
is introduced. Only non-identifying role titles and ESCO requirement labels are sent.
Both matched and missing concepts may support an assessment recommendation; neither
establishes eligibility, proficiency, full coverage or readiness.

Each uncached credential lookup permits one search (four hits), one extraction
(four pages), and at most two optional Runpod calls, within a 12-second network
deadline. This is additional to the existing learning-resource discovery budget.
Concurrent requests cannot queue indefinitely: busy calls receive local options.
The existing provider-domain allowlist applies; arbitrary web domains, generic
preparation guides, unavailable credentials, title mismatches, unsupported outcomes
and pages with no literal ESCO label/alias overlap are rejected. Retrieved text is
untrusted; LLM claims cannot create credential facts. Conservative literal checks
can miss legitimate credentials or leave details unknown.

Verified entries retain official source URLs, excerpts, origin and check timestamp.
Full pages and personal profiles are not persisted. Up to 32 public-metadata result
sets are cached in memory for 24 hours (empty sets: 60 seconds); restart clears them.
Local entries require manual re-review within 180 days. Missing keys, provider
errors and rejected results preserve relevant local records; an empty section is
explicit when nothing qualifies. `FEATURE4_DYNAMIC_DISCOVERY_ENABLED=false` also
disables credential web lookup. No extra keys are required.

Exam and certificate fees are independent. Unknown fees are never marked free.
With an explicit budget, both fees must be known in the same currency and their
sum must fit, unless the credential is explicitly verified free. There is no currency
conversion. Credential budgets are assessed independently of learning costs, not a
combined checkout total. Provider eligibility, restrictions and prices must still
be checked before enrolment. Practice tests alone do not award a credential.

## Initial reviewed fallback source

`src/data/credentials/catalogue.json` contains one actual freeCodeCamp Python
Certification, reviewed 22 October 2026. Official pages:

- https://www.freecodecamp.org/learn/python-v9
- https://www.freecodecamp.org/news/freecodecamps-new-python-certification-is-now-live

The official announcement (15 December 2025) confirms the free verified credential,
Python content, project/exam workflow and desktop/laptop exam requirement. The app
stores only links, factual metadata and short excerpts, not course or exam content;
provider copyright and terms apply (https://www.freecodecamp.org/news/terms-of-service/).
Online availability and regional eligibility are not guaranteed. The source is
provider documentation, not labour-market evidence; no employment statistics or
geographical demand claims are derived. Mapping to role concepts uses exact ESCO
labels/aliases; this is an application relevance rule, not provider endorsement.
Only a relevant record is shown. The small fallback does not cover all occupations.

## Verification

`tests/test_credentials.py` uses fictional provider pages and mocked transports.
It covers verification, costs, currency, missing keys, cache, local fallback,
optional GLM failures, and additive pathway response validation.
Frontend rendering tests cover origin, evidence, fees, unknowns and empty state.
No live Runpod/Tavily calls are part of automated verification.
