# Data-source documentation template

Copy this template for each new real-world dataset or API. Fill in every field before presenting the source as available. Use `Not applicable` with a reason rather than silently omitting a field.

## Source identity

- **Source name:**
- **Official landing page:**
- **API or dataset URL:**
- **Provider / publisher:**
- **Data type and unit of observation:**
- **Stable record identifier, if available:**
- **License or terms of use:**
- **Attribution required:**
- **Terms checked on:**

## Coverage and collection

- **Geographic coverage:**
- **Population or subject coverage:**
- **Observation period / as-of date:**
- **Retrieval timestamp and timezone:**
- **Collection method:**
- **Query, filters, and parameters:**
- **Refresh cadence / rate limits:**
- **Authentication or paid-service requirement:**

## Processing and reliability

- **Validation performed:**
- **Deduplication and identifier rules:**
- **Transformations / aggregation formula:**
- **Missing-period and zero-baseline handling:**
- **Cache and failure behavior:**
- **Known limitations, bias, and possible query overlap:**
- **How real data is distinguished from synthetic or estimated data:**

## Review checklist

- [ ] Official endpoint and terms were checked.
- [ ] The metric is named in plain language with its unit and denominator.
- [ ] A source URL and observation period are available to users.
- [ ] Retrieval time is stored with an explicit timezone.
- [ ] Transformations can be reproduced from the documented query.
- [ ] Missing, duplicate, malformed, and unavailable data are handled.
- [ ] A failed refresh does not silently replace valid cached data.
- [ ] Claims do not exceed the source's geographic or population coverage.
- [ ] Synthetic examples are separate and explicitly labelled.
- [ ] Tests use fixtures/mocks rather than depending on a live provider.

## Metric-claim guardrail

Describe what the source measures, not what a user hopes it means. For example, indexed research-publication counts are research activity; they are not job openings, hiring demand, employer skill requirements, or a forecast.
