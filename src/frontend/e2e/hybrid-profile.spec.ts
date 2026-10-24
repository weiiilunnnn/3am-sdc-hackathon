import { expect, test } from "@playwright/test";
const PROFILE_KEY = "aiversecity.synthetic-profile-id";
const HANDOFF = "pathwaay.registration-profile";
const mainFixture = () => ({firstName:"Fixture",lastName:"Learner",educationLevel:"Bachelor’s degree",university:"Test university",major:"Computing",cgpa:"3.5",schoolAwards:"",experiences:[],skills:["Python","SQL","Data Analysis"],educationRecord:"",volunteering:"",projects:"",certifications:"",achievements:"",interests:"",workActivities:"",strengths:"",skillsToDevelop:"",aspiration:"",profileSummary:"Fixture summary",weeklyHours:"8",learningBudget:"0",learningMode:"Self-paced"});

test("Main registration saves once, recovers after browser closure, and reaches all shared pages", async ({page, browser, context}) => {
  test.setTimeout(150_000);
  await page.goto('/register');
  await page.getByRole('button',{name:/Begin your journey/}).click();
  // SH adds a CV fast-track choice; keep coverage of Main's manual onboarding.
  await page.getByRole('button',{name:'Continue with manual registration'}).click();
  await page.getByLabel('First name',{exact:true}).fill('Fixture');
  await page.getByLabel('Last name',{exact:true}).fill('Learner');
  await page.getByRole('button',{name:/Continue/}).click();
  await page.getByPlaceholder('e.g. Data Science').fill('Computing');
  await page.getByRole('button',{name:/Continue/}).click();
  await page.getByRole('button',{name:'Python programming',exact:true}).click();
  await page.getByRole('button',{name:'Data analysis',exact:true}).click();
  await page.getByLabel('Search skills',{exact:true}).fill('SQL');
  await page.getByRole('button',{name:/as a custom skill/}).click();
  await page.getByRole('button',{name:/Continue/}).click();
  // Main's remaining five steps are optional; no fabricated profile facts.
  for(let i=0;i<4;i++) await page.getByRole('button',{name:/Continue/}).click();
  await page.route('**/api/profiles', route => route.fulfill({status:503,json:{detail:'Fixture save outage'}}));
  await page.getByRole('button',{name:/Shape my pathway/}).click();
  await expect(page.locator('p[role="alert"]')).toContainText('Fixture save outage');
  expect(await page.evaluate(k => !!sessionStorage.getItem(k),HANDOFF)).toBeTruthy();
  expect(await page.evaluate(k => localStorage.getItem(k),PROFILE_KEY)).toBeNull();
  await page.unroute('**/api/profiles');
  const response = page.waitForResponse(r => r.url().endsWith('/api/profiles') && r.request().method()==='POST');
  await page.getByRole('button',{name:/Shape my pathway/}).click();
  const saved = await (await response).json();
  expect(saved.synthetic_demo).toBe(false); expect(saved.years_experience).toBeNull();
  expect(saved.skills.every((s:any)=>s.proficiency==='unknown')).toBeTruthy();
  await expect(page).toHaveURL(/\/profile$/, {timeout:20_000});
  await expect(page.getByRole('heading',{name:'Fixture Learner',exact:true})).toBeVisible();
  await page.goto('/home'); await expect(page.getByRole('heading',{name:'Computing',exact:true})).toBeVisible();
  await page.goto('/cv-studio'); await expect(page.getByRole('article',{name:'CV document preview'})).toContainText('Python programming');
  await page.getByTestId('link-role-matching').click();
  const card = page.getByTestId('career-card').first(); await expect(card).toBeVisible();
  await card.getByRole('link',{name:/Explore More/}).click();
  await expect(page.getByTestId('career-overview')).toBeVisible();
  await expect(page.getByTestId('link-role-matching')).toHaveAttribute('aria-current','page');
  await page.getByRole('link',{name:/Explore Pathway/}).click();
  await expect(page.getByTestId('pathway-view')).toBeVisible();
  await expect(page.getByRole('banner')).toHaveCount(1);
  const recoveredContext = await browser.newContext({storageState:await context.storageState()});
  const returning = await recoveredContext.newPage();
  await returning.goto('/profile');
  await expect(returning.getByRole('heading',{name:'Fixture Learner',exact:true})).toBeVisible();
  expect(await returning.evaluate(k=>JSON.parse(sessionStorage.getItem(k)!).skills,HANDOFF)).toContain('SQL');
  expect(await returning.evaluate(k=>localStorage.getItem(k),PROFILE_KEY)).toBe(saved.id);
  await recoveredContext.close();
});

test("Main edit updates the existing row and preserves evidence, proficiency and unrelated records", async ({page,request}) => {
  const sample = (await (await request.get('/api/profiles/samples')).json()).profiles[0];
  const {sample_id,label,taxonomy,...draft} = sample;
  const record = {id:'existing-evidence',title:'User-provided project',organization:null,period:null,description:'Existing evidence must survive.',skill_ids:[]};
  const created = await (await request.post('/api/profiles',{data:{...draft,synthetic_demo:false,registration_profile:mainFixture(),projects:[record],skills:[{name:'Python',skill_id:'local:python-programming',proficiency:'advanced',evidence_record_ids:[record.id]}]}})).json();
  await page.addInitScript(({key,id})=>localStorage.setItem(key,id),{key:PROFILE_KEY,id:created.id});
  await page.goto('/profile/edit');
  // Main's retained editor only shows inputs after opening their section.
  await page.getByRole('button',{name:'Edit profile summary'}).click();
  await page.getByRole('textbox',{name:'Profile summary',exact:true}).fill('Edited through Main.');
  const update = page.waitForResponse(r=>r.url().endsWith('/api/profiles/'+created.id)&&r.request().method()==='PUT');
  await page.getByRole('button',{name:/Save changes/}).click();
  const saved = await (await update).json();
  expect(saved.id).toBe(created.id);
  expect(saved.projects).toEqual([record]);
  expect(saved.skills.find((s:any)=>s.skill_id==='local:python-programming')).toMatchObject({proficiency:'advanced',evidence_record_ids:[record.id]});
  expect(saved.registration_profile.profileSummary).toBe('Edited through Main.');
  await expect(page).toHaveURL(/\/profile$/);
  await expect(page.getByText('Edited through Main.',{exact:true})).toBeVisible();
});

test("stale backend identity is reported without silently creating a replacement", async ({page}) => {
  let creates=0;
  page.on('request',r=>{if(r.url().endsWith('/api/profiles')&&r.method()==='POST')creates++;});
  await page.addInitScript(key=>localStorage.setItem(key,'missing-fixture-profile'),PROFILE_KEY);
  await page.goto('/profile');
  await expect(page.locator('p[role="alert"]')).toContainText('Profile not found');
  expect(await page.evaluate(key=>localStorage.getItem(key),PROFILE_KEY)).toBe('missing-fixture-profile');
  expect(creates).toBe(0);
});
