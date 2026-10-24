import { expect, test, type Page } from "@playwright/test";
import type { CareerAnalysis } from "../lib/career-analysis";

const fixture = (role: string): CareerAnalysis => ({
  role_id: role, evidence_key: `evidence-${role}`, status: "unavailable", message: "AI unavailable",
  groups: [{group_id:"g",concept_uri:"fixture",title:"Report facts",count:1,mapping_method:"source_concept_fallback",
    explanation:"One requirement is not evidenced.",concepts:[{skill_id:"target",name:"Report facts",skill_type:"skill",requirement:"essential",source_ids:[]}]}],
  matched:[{skill_id:"s",name:"Statistics",skill_type:"skill",requirement:"essential",source_ids:[]}],
  not_evidenced_count:1,grouping_warning:null,interpretations:[],bridges:[],evidence:[],used_cache:false,
});
const completed = (role: string) => ({...fixture(role),status:"ready",interpretations:[{group_id:"g",why_relevant:"This may support learning.",evidence_ids:[]}],
  bridges:[{matched_skill_ids:["s"],target_group_id:"g",explanation:"Statistics could support reporting facts.",evidence_ids:[]}]});

async function mock(page: Page, terminal: "failed" | "expired" = "failed", failAgain = false) {
  let retries=0, starts=0, polls=0;
  let release: (()=>void) | undefined;
  const gate=new Promise<void>(resolve=>release=resolve);
  // No fallthrough to a backend or paid provider is possible.
  await page.route("**/api/**",async route=>{
    const path=new URL(route.request().url()).pathname;
    const body=route.request().method()==="POST"?route.request().postDataJSON():{};
    const role=body.role_id??new URL(route.request().url()).searchParams.get("role_id")??"fixture-role";
    let data: unknown;
    if(path==="/api/v2/bootstrap") data={skills:[],sources:[],profiles:[{profile_id:"fixture",is_synthetic:true,skills:[{skill_id:"s"}]}]};
    else if(path==="/api/v2/roles/detail") data={role:{role_id:role,title:"Fixture Role",description:"Synthetic browser fixture",source_ids:[]},skills:[],sources:[]};
    else if(path==="/api/v2.1/roles/search") data={results:[{role_id:"fixture-role",score:{profile_relevance_pct:50},pathway_available:true}],sources:[],next_offset:null};
    else if(path==="/api/v2/roles/analysis") data=fixture(role);
    else if(path==="/api/v2/roles/analysis/jobs") {
      starts++;
      if(body.retry_failed) {
        retries++;expect(body.retry_job_id).toBe("old-ticket");expect(body.recognised_skill_ids).toEqual(["s"]);
        await gate;
      }
      data={job_id:body.retry_failed?"replacement":"old-ticket",evidence_key:`evidence-${role}`,
        status:body.retry_failed?"queued":terminal,retryable:!body.retry_failed,poll_after_ms:2000,expires_at:null,error_code:"invalid_json",analysis:null};
    } else if(path==="/api/v2/roles/analysis/jobs/status") {
      polls++;data={job_id:"replacement",evidence_key:`evidence-${role}`,status:failAgain?"failed":"completed",retryable:failAgain,
        poll_after_ms:2000,expires_at:null,error_code:failAgain?"invalid_json":null,analysis:failAgain?null:completed(role)};
    } else { await route.abort();return; }
    await route.fulfill({json:data});
  });
  return {counts:()=>({retries,starts,polls}),release:()=>release?.()};
}
const open = (page: Page, role="fixture-role")=>page.goto(`/role-matching/roles/${role}?demo=fixture`);

test("explicit double click submits once, disables immediately, polls and displays bridges",async({page})=>{
  const api=await mock(page);await open(page);
  const button=page.getByRole("button",{name:"Retry AI Analysis"});await expect(button).toBeVisible();
  await button.evaluate(node=>{(node as HTMLButtonElement).click();(node as HTMLButtonElement).click();});
  await expect(page.getByRole("button",{name:"Preparing AI analysis..."})).toBeDisabled();
  await expect.poll(()=>api.counts().retries).toBe(1);api.release();
  await expect(page.getByText("Statistics could support reporting facts.").first()).toBeVisible();
  await expect(button).toHaveCount(0);expect(api.counts()).toEqual({retries:1,starts:2,polls:1});
});

test("expired jobs do not retry on refresh; explicit failure restores fallback and button",async({page})=>{
  const api=await mock(page,"expired",true);await open(page);
  const button=page.getByRole("button",{name:"Retry AI Analysis"});await expect(button).toBeVisible();
  await page.reload();await expect(button).toBeVisible();expect(api.counts().retries).toBe(0);
  await button.click();api.release();await expect(button).toBeVisible();
  await expect(page.getByRole("heading",{name:"Skill Evidence Matrix"})).toBeVisible();
  expect(api.counts().retries).toBe(1);
});

test("navigation cancels a retry and ignores its stale completed response",async({page})=>{
  const api=await mock(page);await open(page);
  await page.getByRole("button",{name:"Retry AI Analysis"}).click();
  await expect.poll(()=>api.counts().retries).toBe(1);
  await open(page,"other-role");api.release();
  await expect(page.getByTestId("career-overview")).toHaveAttribute("data-role-id","other-role");
  await expect(page.getByRole("button",{name:"Retry AI Analysis"})).toBeVisible();
  await expect(page.getByText("Statistics could support reporting facts.")).toHaveCount(0);
  expect(api.counts().retries).toBe(1);
});
