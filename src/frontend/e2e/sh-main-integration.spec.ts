import { expect, test } from '@playwright/test';
const pythonId = 'http://data.europa.eu/esco/skill/ccd0a1d9-afda-43d9-b901-96344886e14d';

test('CV review persists through backend failure, retry, edit and browser-session recovery', async ({page, browser, context}) => {
  test.setTimeout(120_000);
  await page.route('**/api/profiles/extract-registration-cv-async', route => route.fulfill({status:202,json:{job_id:'fictional-cv-job-123456',status:'processing'}}));
  await page.route('**/api/profiles/extract-registration-cv-async/*', route => route.fulfill({json:{status:'completed',result:{
    status:'review_required',fields:{full_name:'Fixture Learner',email:'fictional@example.invalid',major:'Computing',university:'Fixture University',education_level:'Bachelor',education_record:'Studied Computing',profile_summary:'Fictional integration test profile.'},
    experiences:[],projects:['Built a fictional Python chart.'],certifications:[],achievements:[],warnings:[],
    skills:[{original_text:'Python',canonical_name:'Python (computer programming)',esco_uri:pythonId,source_version:'1.2.1',taxonomy_source:'ESCO v1.2.1',legacy_skill_id:'local:python-programming',match_status:'esco_exact',evidence:'Python'}],
    esco:{loaded:true,version:'1.2.1',concept_count:14359,message:'Verified fixture'},
  }}}));
  await page.goto('/register');
  await page.getByRole('button',{name:/Begin your journey/}).click();
  await expect(page.getByRole('heading',{name:'Start with your CV.'})).toBeVisible();
  await page.locator('input[type=file]').setInputFiles({name:'fictional.pdf',mimeType:'application/pdf',buffer:Buffer.from('%PDF-1.4 fictional upload; extraction mocked')});
  await page.getByRole('checkbox').check();
  await page.getByRole('button',{name:'Extract my CV →'}).click();
  await expect(page.getByRole('heading',{name:'Here’s what we found.'})).toBeVisible();
  await page.getByLabel('Field of study',{exact:true}).fill('');
  await page.getByRole('button',{name:'Confirm & enter Pathwaay →'}).click();
  await expect(page.locator('p.cvft-error[role="alert"]')).toContainText('field of study');
  await page.getByLabel('Field of study',{exact:true}).fill('Computing');
  await page.route('**/api/profiles',route=>route.fulfill({status:503,json:{detail:'Fixture backend outage'}}));
  await page.getByRole('button',{name:'Confirm & enter Pathwaay →'}).click();
  await expect(page.locator('p.cvft-error[role="alert"]')).toContainText('Fixture backend outage');
  expect(await page.evaluate(()=>localStorage.getItem('aiversecity.synthetic-profile-id'))).toBeNull();
  await page.unroute('**/api/profiles');
  const response = page.waitForResponse(r=>r.url().endsWith('/api/profiles')&&r.request().method()==='POST');
  await page.getByRole('button',{name:'Confirm & enter Pathwaay →'}).click();
  const savedResponse = await response;
  expect(savedResponse.status()).toBe(201);
  const saved = await savedResponse.json();
  expect(saved.skills[0].skill_id).toBe(pythonId);
  await expect(page).toHaveURL(/\/profile$/);
  await expect(page.getByRole('heading',{name:'Fixture Learner',exact:true})).toBeVisible();
  await page.goto('/profile/edit');
  await page.getByLabel('Phone number',{exact:false}).fill('+60 12-345 6789');
  const update = page.waitForResponse(r=>r.url().endsWith('/api/profiles/'+saved.id)&&r.request().method()==='PUT');
  await page.getByRole('button',{name:/Save changes/}).click();
  const editedResponse=await update;
  expect(editedResponse.status()).toBe(200);
  expect((await editedResponse.json()).registration_profile.cvDetails.phone).toBe('+60 12-345 6789');
  await expect(page).toHaveURL(/\/profile$/);
  await page.goto('/cv-studio');
  await expect(page.getByRole('article',{name:'CV document preview'})).toContainText('+60 12-345 6789');
  await expect(page.getByRole('article',{name:'CV document preview'})).toContainText('Python (computer programming)');
  await page.getByRole('button',{name:/Modern Minimal/}).click();
  await expect(page.locator('.cv2-paper')).toHaveClass(/cv2-template-modern/);
  const returningContext=await browser.newContext({storageState:await context.storageState()});
  const returning=await returningContext.newPage();
  // Enter CV Studio directly in a new session to test backend recovery without
  // first visiting Profile (which otherwise hydrates a browser draft).
  await returning.goto('/cv-studio');
  await expect(returning.locator('.cv2-paper')).toContainText('Fixture Learner');
  await expect(returning.locator('.cv2-paper')).toContainText('+60 12-345 6789');
  await returning.goto('/profile');
  await expect(returning.getByRole('heading',{name:'Fixture Learner',exact:true})).toBeVisible();
  await returningContext.close();
  const matchingPromise = page.waitForResponse(
    r => r.url().endsWith('/api/v2/matches') &&
         r.request().method() === 'POST'
  );

  await page.goto('/role-matching');

  const matchingResponse = await matchingPromise;
  expect(matchingResponse.status()).toBe(200);

  const matching = await matchingResponse.json();

  expect(matching.profile_id).toBe(saved.id);
  expect(matching.recognised_user_skill_count).toBe(1);
  expect(matching.insufficient_evidence).toBe(true);
  expect(matching.results).toHaveLength(0);

  await expect(
    page.getByRole('heading', { name: 'Add more specific skills' })
  ).toBeVisible();
});

test('manual registration remains accessible from CV onboarding',async ({page})=>{
  await page.goto('/register');
  await page.getByRole('button',{name:/Begin your journey/}).click();
  await page.getByRole('button',{name:'Continue with manual registration'}).click();
  await expect(page.getByLabel('First name',{exact:true})).toBeVisible();
});
