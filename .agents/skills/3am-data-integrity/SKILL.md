---
name: 3am-data-integrity
description: Guides external data sources, metrics, provenance, licensing, and storage changes for the 3AM Aiversecity app. Use when changing data collection, transformations, or source claims.
---

# 3AM Data Integrity

Use this skill before adding a source, changing a measurement, or altering storage.

## Protect users and preserve analytical meaning

- Use public, synthetic, or appropriately licensed information. The profile prototype accepts fictional data only; never request real CVs or personal identifiers for the hackathon demo.
- Never invent observations, source records, job advertisements, occupations, or measurements.
- OpenAlex publication counts represent indexed research activity only. Never describe them as hiring, job openings, employer demand, skill prevalence in vacancies, or forecasts.
- Clearly separate observed data, synthetic examples, and any future estimates or scenarios.
- Preserve existing cache contents when a source refresh fails. Use the existing provider-independent contract in `src/services/sources/base.py` and keep external I/O out of trend business logic.

## Document and validate each real source

Before using a source, verify the official endpoint and usage terms. Record its name, URL, data type, license/terms, geography, observation period, retrieval timestamp, collection method/query, transformations, limitations, and refresh/cache behavior using [the source documentation template](../../../docs/data-source-template.md).

Validate external responses and dates before persistence. Handle missing fields, duplicate identifiers, timeouts, rate limits, and provider errors explicitly. Do not replace failed or missing real data with synthetic values in the real-data cache.

Do not trigger a live refresh for documentation, test, or audit work. Use fixture/mock responses for repeatable tests; make live requests only when they are required by the user’s requested task.

## References

- [Current source and metric notes](../../../docs/features-1-2.md)
- [Architecture and storage](../../../docs/architecture.md)
- [Testing procedures](../../../docs/testing.md)
