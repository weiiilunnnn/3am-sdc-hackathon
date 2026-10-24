# Profile Relevance unmatched-skill adjustment

Displayed Profile Relevance now uses `100 * M / (M + 0.75 * (T - M))`.
M is the existing IDF-weighted matched sum, retaining optional strength 0.4;
T is the existing IDF-weighted recognised-profile sum. Unresolved skills remain
unscored. No recognised skills gives an unavailable score, not a fabricated zero.
Zero overlap remains zero and full weighted overlap remains one hundred percent.

The conservative lambda 0.75 discounts unmatched weight. This is a monotonic
rescaling, not improved evidence, career readiness, or a hiring probability.
The original `100 * M / T` still controls the existing thirty-percent qualification
threshold. Evidence guards, essential coverage, ranking and search pagination
remain unchanged. Search and recommendations use one shared display formula.
API shapes and UI labels are preserved; method version and scoring configuration
identify the new formula, lambda, and separate qualification calculation.

Offline validation used the existing full ESCO v1.2.1 index (3,658 occupations).
For labelled sample demo-graduate-a, eleven roles still qualify and their mean
display score increases from 41.04 to 47.95. For demo-graduate-b, twenty-seven
still qualify; the first twenty-five mean increases from 43.35 to 50.28.
demo-graduate-c still has no qualifying roles. These are qualifying/top-page
averages, not catalogue-wide averages. Rankings and essential coverage were
compared unchanged for these samples. No claims of improved predictive accuracy
are made. Existing canonical ESCO recognition is unchanged.
