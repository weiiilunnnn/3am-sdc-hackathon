import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";
import { EmploymentSnapshotView, formatCooldown, type EmploymentSnapshotViewProps } from "../src/frontend/app/(workspace)/radar/EmploymentSnapshot";
import Home from "../src/frontend/app/(workspace)/profile/page";
import type { EmploymentDashboard } from "../src/frontend/lib/api";

// Resolve the app's own React version, with the standalone frontend package.
const requireFrontend = createRequire(new URL("../src/frontend/package.json", import.meta.url));
const { createElement } = requireFrontend("react");
const { renderToStaticMarkup } = requireFrontend("react-dom/server");

const fixture: EmploymentDashboard = {
  mode: "real",
  source: {
    id: "remoteok", name: "Remote OK", url: "https://remoteok.com/api", website_url: "https://remoteok.com",
    documentation_url: "https://remoteok.com/faq#feeds-sponsorship", terms_url: "https://remoteok.com/legal",
    terms_reviewed_on: "2026-10-21", permitted_use: "Conditional API reuse with attribution.",
    coverage: "Synthetic international fixture, not representative.",
    measurement: "Exact configured phrase mentions per retained posting.",
    limitations: "Snapshot only. No historical growth or verified open status.", refresh_policy: "Manual; one attempt per 24 hours.", sample_limit: 100,
  },
  jobs: [
    {
      source_job_id: "fixture1", title: "Fictional Python <Engineer>", company: "Example Employer",
      location: null, source_url: "https://remoteok.com/remote-jobs/fixture1",
      source_date: "2026-10-20T00:00:00Z", published_at: "2026-10-20T00:00:00Z",
      retrieved_at: "2026-10-21T00:00:00Z", tags: ["python"], topic_ids: ["llms"],
      skill_mentions: [{ skill_id: "local:python-programming", label: "Python programming", terms: ["python"], fields: ["title"] }],
    },
    {
      source_job_id: "fixture2", title: "Fictional Support", company: "Second Example",
      location: "Remote (synthetic)", source_url: "https://remoteok.com/remote-jobs/fixture2",
      source_date: "2026-10-19T00:00:00Z", published_at: "2026-10-19T00:00:00Z",
      retrieved_at: "2026-10-21T00:00:00Z", tags: [], topic_ids: [], skill_mentions: [],
    },
  ],
  skill_counts: [{ skill_id: "local:python-programming", label: "Python programming", posting_count: 1, share_percent: 50 }],
  topic_counts: { llms: 1, rag: 0 }, posting_count: 2, employer_count: 2,
  location_labels: ["Remote (synthetic)"], unknown_location_count: 1,
  published_from: "2026-10-19T00:00:00Z", published_to: "2026-10-20T00:00:00Z",
  source_feed_updated_at: "2026-10-21T00:00:00Z", received_records: 2, excluded_records: 0,
  last_successful_refresh: "2026-10-21T00:00:00Z", last_attempt_at: "2026-10-21T00:00:00Z",
  refresh_status: "success", cooldown_seconds: 0, cache_fallback: false, error_message: null,
};

function render(overrides: Partial<EmploymentSnapshotViewProps> = {}) {
  return renderToStaticMarkup(createElement(EmploymentSnapshotView, {
    dashboard: fixture, loading: false, refreshing: false, error: "", cooldownSeconds: 0,
    onRetry: () => {}, onRefresh: () => {}, ...overrides,
  }));
}

test("profile component exposes fictional-only boundary, fields and visible loading state", () => {
  const html = renderToStaticMarkup(createElement(Home));
  assert.match(html, /Fictional demo profiles only/);
  assert.match(html, /data-testid="loading-profile-message"/);
  assert.match(html, /data-testid="input-interests"/);
  assert.match(html, /disabled="" data-testid="button-save-profile"/);
});

test("employment component renders attributed records, denominator and escaped text", () => {
  const html = render();
  assert.match(html, /2 retained \(denominator\)/);
  assert.match(html, /Fictional Python &lt;Engineer&gt;/);
  assert.match(html, /Location unspecified/);
  assert.match(html, /Original source date/);
  assert.match(html, /rel="noopener noreferrer" data-testid="link-job-fixture1"/);
  assert.doesNotMatch(html, /nofollow/);
  assert.match(html, /not a confirmed requirement/);
  assert.match(html, /50%/);
});

test("loading and empty caches do not manufacture postings", () => {
  assert.match(render({ dashboard: null, loading: true }), /data-testid="loading-employment"/);
  const html = render({ dashboard: { ...fixture, jobs: [], posting_count: 0, skill_counts: [] } });
  assert.match(html, /data-testid="empty-employment"/);
  assert.doesNotMatch(html, /data-testid="job-fixture1"/);
});

test("provider and retry errors leave existing cached postings visible", () => {
  const html = render({ dashboard: { ...fixture, refresh_status: "failed", cache_fallback: true, error_message: "Synthetic timeout" }, error: "Synthetic read failure" });
  assert.match(html, /Showing the previous cached snapshot/);
  assert.match(html, /data-testid="button-retry-employment"/);
  assert.match(html, /data-testid="job-fixture1"/);
  assert.match(render({ loading: true }), /data-testid="job-fixture1"/);
});

test("topic and skill filters restrict actual record cards and explain zero matches", () => {
  for (const filter of [{ initialTopicFilter: "llms" }, { initialSkillFilter: "local:python-programming" }]) {
    const html = render(filter);
    assert.match(html, /data-testid="job-fixture1"/);
    assert.doesNotMatch(html, /data-testid="job-fixture2"/);
  }
  const empty = render({ initialTopicFilter: "rag" });
  assert.match(empty, /data-testid="empty-employment-filtered"/);
  assert.match(empty, /zero matches in this sample only/);
});

test("profile relevance uses exact IDs only and cooldown is not invented", () => {
  const html = render({ profileSkills: [{ skill_id: null, skill_name: "Python programming" }], cooldownSeconds: 86399 });
  assert.match(html, /None of your saved skill IDs match/);
  assert.match(html, /Next refresh in 23h 59m/);
  assert.equal(formatCooldown(-5), "0s");
  assert.equal(formatCooldown(63), "1m 3s");
});
