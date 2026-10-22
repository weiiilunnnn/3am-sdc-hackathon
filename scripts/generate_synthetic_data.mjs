import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

// Deterministic, explicitly synthetic demo data. It is not observed labour-market data.
const roles = [
  { name: "Data Analyst", major: "data_science", interests: ["analytics", "business", "communication"], skills: ["sql", "visualization", "statistics"] },
  { name: "Business Intelligence Analyst", major: "business", interests: ["analytics", "business", "communication"], skills: ["sql", "visualization", "cloud"] },
  { name: "Machine Learning Intern", major: "computer_science", interests: ["ai", "research", "analytics"], skills: ["python", "statistics", "machine_learning"] },
  { name: "Product Analyst", major: "business", interests: ["product", "analytics", "communication"], skills: ["sql", "statistics", "visualization"] },
  { name: "Data Scientist", major: "data_science", interests: ["ai", "research", "analytics"], skills: ["python", "statistics", "machine_learning"] },
  { name: "Machine Learning Engineer", major: "computer_science", interests: ["ai", "building", "research"], skills: ["python", "machine_learning", "cloud"] },
  { name: "AI Engineer", major: "computer_science", interests: ["ai", "building", "product"], skills: ["python", "machine_learning", "cloud"] },
  { name: "Data Engineer", major: "engineering", interests: ["building", "analytics", "business"], skills: ["python", "sql", "cloud"] },
];
const interests = ["analytics", "ai", "business", "building", "communication", "product", "research"];
const skills = ["python", "sql", "statistics", "visualization", "machine_learning", "cloud"];
const majors = ["data_science", "computer_science", "business", "economics", "engineering", "other"];
let state = 73021;
const rand = () => ((state = (state * 1664525 + 1013904223) >>> 0) / 4294967296);
const maybe = (p) => rand() < p;
const csv = (rows) => rows.map((row) => row.map((v) => `"${String(v).replaceAll('"', '""')}"`).join(",")).join("\n") + "\n";

const profileHeader = ["major", ...interests.map((x) => `interest_${x}`), ...skills.map((x) => `skill_${x}`), "experience_months", "target_role"];
const profileRows = [profileHeader];
for (const role of roles) {
  for (let i = 0; i < 360; i++) {
    const major = maybe(0.68) ? role.major : majors[Math.floor(rand() * majors.length)];
    const activeInterests = new Set(interests.filter((x) => maybe(role.interests.includes(x) ? 0.78 : 0.19)));
    const activeSkills = new Set(skills.filter((x) => maybe(role.skills.includes(x) ? 0.72 : 0.16)));
    profileRows.push([major, ...interests.map((x) => +activeInterests.has(x)), ...skills.map((x) => +activeSkills.has(x)), Math.floor(rand() * 37), role.name]);
  }
}

// One learner-row table that adds the registration profile schema while
// preserving the original model features and synthetic role label. The source
// rows contain no real identity, education, or work-history details, so those
// registration fields deliberately remain empty.
const unifiedProfileHeader = [
  "profile_id", "data_origin", "registration_profile_data_available",
  "first_name", "last_name", "education_level", "university", "cgpa", "school_awards",
  "experiences_json", "skills_json", "interest_tags_json", "education_record", "volunteering", "projects",
  "certifications", "achievements", "interests", "work_activities", "strengths",
  "skills_to_develop", "aspiration", "profile_summary", "weekly_hours", "learning_budget", "learning_mode",
  "major", ...interests.map((x) => `interest_${x}`), ...skills.map((x) => `skill_${x}`),
  "experience_months", "target_role",
];
const unifiedProfileRows = [unifiedProfileHeader];
for (let index = 1; index < profileRows.length; index++) {
  const row = profileRows[index];
  const values = Object.fromEntries(profileHeader.map((column, columnIndex) => [column, row[columnIndex]]));
  const skillTags = skills.filter((skill) => values[`skill_${skill}`] === 1);
  const interestTags = interests.filter((interest) => values[`interest_${interest}`] === 1);
  const unified = {
    profile_id: `synthetic-${String(index).padStart(4, "0")}`,
    data_origin: "synthetic_role_profile",
    registration_profile_data_available: "false",
    first_name: "", last_name: "", education_level: "", university: "", cgpa: "", school_awards: "",
    experiences_json: "[]", skills_json: JSON.stringify(skillTags), interest_tags_json: JSON.stringify(interestTags),
    education_record: "", volunteering: "", projects: "", certifications: "", achievements: "", interests: "",
    work_activities: "", strengths: "", skills_to_develop: "", aspiration: "", profile_summary: "",
    weekly_hours: "", learning_budget: "", learning_mode: "",
    ...values,
  };
  unifiedProfileRows.push(unifiedProfileHeader.map((column) => unified[column] ?? ""));
}

const skillByRole = {
  "Data Analyst": ["SQL", "Data cleaning", "Business metrics", "Analytical reasoning"],
  "Business Intelligence Analyst": ["SQL", "Dashboard storytelling", "Business reporting", "Data modelling"],
  "Machine Learning Intern": ["Python", "Statistics", "Model evaluation", "Feature engineering"],
  "Product Analyst": ["Product metrics", "Experiment analysis", "SQL", "User behaviour analysis"],
  "Data Scientist": ["Machine learning", "Statistics", "Python", "Causal thinking"],
  "Machine Learning Engineer": ["Python", "Cloud deployment", "MLOps", "Model monitoring"],
  "AI Engineer": ["Python", "LLM evaluation", "Prompt and tool design", "Cloud deployment"],
  "Data Engineer": ["SQL", "Data pipelines", "Cloud platforms", "Data quality"],
};
// UN goal titles and targets are reference data; skill links and weights below
// are curated synthetic examples, not measured SDG impact.
const sdgCatalog = [
  ["1", "No Poverty", "End poverty in all its forms everywhere.", "1.4", "Equal rights to economic resources", "Ensure that all people have equal rights to economic resources and access to basic services, property, natural resources, appropriate technology and financial services."],
  ["2", "Zero Hunger", "End hunger, achieve food security and improved nutrition and promote sustainable agriculture.", "2.4", "Sustainable food production", "Ensure sustainable food production systems and resilient agricultural practices."],
  ["3", "Good Health and Well-being", "Ensure healthy lives and promote well-being for all at all ages.", "3.8", "Access to quality health-care services", "Achieve universal health coverage, including access to quality essential health-care services."],
  ["4", "Quality Education", "Ensure inclusive and equitable quality education and promote lifelong learning opportunities for all.", "4.4", "Relevant skills for employment and decent work", "Increase the number of young people and adults with relevant skills, including technical and vocational skills, for employment, decent jobs and entrepreneurship."],
  ["5", "Gender Equality", "Achieve gender equality and empower all women and girls.", "5.b", "Enabling technology for women’s empowerment", "Enhance the use of enabling technology, in particular information and communications technology, to promote the empowerment of women."],
  ["6", "Clean Water and Sanitation", "Ensure availability and sustainable management of water and sanitation for all.", "6.3", "Improve water quality", "Improve water quality by reducing pollution, eliminating dumping and minimizing release of hazardous chemicals and materials."],
  ["7", "Affordable and Clean Energy", "Ensure access to affordable, reliable, sustainable and modern energy for all.", "7.3", "Improve energy efficiency", "Double the global rate of improvement in energy efficiency."],
  ["8", "Decent Work and Economic Growth", "Promote sustained, inclusive and sustainable economic growth, full and productive employment and decent work for all.", "8.2", "Productivity through diversification, technology and innovation", "Achieve higher levels of economic productivity through diversification, technological upgrading and innovation."],
  ["9", "Industry, Innovation and Infrastructure", "Build resilient infrastructure, promote inclusive and sustainable industrialization and foster innovation.", "9.5", "Enhance research and technological capability", "Enhance scientific research and upgrade the technological capabilities of industrial sectors, including by encouraging innovation."],
  ["10", "Reduced Inequalities", "Reduce inequality within and among countries.", "10.2", "Promote inclusion for all", "Empower and promote the social, economic and political inclusion of all, irrespective of status."],
  ["11", "Sustainable Cities and Communities", "Make cities and human settlements inclusive, safe, resilient and sustainable.", "11.3", "Inclusive and sustainable urbanisation", "Enhance inclusive and sustainable urbanization and capacity for participatory, integrated and sustainable human settlement planning and management."],
  ["12", "Responsible Consumption and Production", "Ensure sustainable consumption and production patterns.", "12.6", "Sustainable practices and sustainability reporting", "Encourage companies to adopt sustainable practices and to integrate sustainability information into their reporting cycle."],
  ["13", "Climate Action", "Take urgent action to combat climate change and its impacts.", "13.3", "Climate education and awareness", "Improve education, awareness-raising and human and institutional capacity on climate change mitigation, adaptation, impact reduction and early warning."],
  ["14", "Life Below Water", "Conserve and sustainably use the oceans, seas and marine resources for sustainable development.", "14.2", "Protect and restore marine ecosystems", "Sustainably manage and protect marine and coastal ecosystems to avoid significant adverse impacts."],
  ["15", "Life on Land", "Protect, restore and promote sustainable use of terrestrial ecosystems, sustainably manage forests, combat desertification, and halt and reverse land degradation and halt biodiversity loss.", "15.5", "Halt biodiversity loss", "Take urgent and significant action to reduce the degradation of natural habitats and halt the loss of biodiversity."],
  ["16", "Peace, Justice and Strong Institutions", "Promote peaceful and inclusive societies, provide access to justice for all and build effective, accountable and inclusive institutions at all levels.", "16.6", "Effective, accountable and transparent institutions", "Develop effective, accountable and transparent institutions at all levels."],
  ["17", "Partnerships for the Goals", "Strengthen the means of implementation and revitalize the Global Partnership for Sustainable Development.", "17.6", "Science, technology and innovation cooperation", "Enhance North-South, South-South and triangular regional and international cooperation on access to science, technology and innovation."],
].map(([number, title, summary, target_code, target_title, target_definition]) => ({
  number, title, summary, target_code, target_title, target_definition,
  icon_url: `https://open-sdg.github.io/sdg-translations/assets/img/goals/en/${number}.png`,
}));
const sdgSecondaryTargets = [
  ["1", "1.2", "Reduce poverty in all its dimensions", "Reduce at least by half the proportion of people living in poverty in all its dimensions according to national definitions."],
  ["2", "2.a", "Invest in rural infrastructure and agricultural research", "Increase investment in rural infrastructure, agricultural research and extension services, technology development and plant and livestock gene banks."],
  ["3", "3.4", "Reduce premature mortality and promote mental health", "Reduce premature mortality from non-communicable diseases and promote mental health and well-being."],
  ["4", "4.3", "Equal access to technical, vocational and higher education", "Ensure equal access for women and men to affordable and quality technical, vocational and tertiary education, including university."],
  ["5", "5.5", "Women’s participation and equal leadership", "Ensure women’s full and effective participation and equal opportunities for leadership at all levels of decision-making."],
  ["6", "6.4", "Water-use efficiency and water scarcity", "Substantially increase water-use efficiency and ensure sustainable withdrawals and supply of freshwater to address water scarcity."],
  ["7", "7.2", "Increase the share of renewable energy", "Increase substantially the share of renewable energy in the global energy mix."],
  ["8", "8.5", "Full employment and decent work for all", "Achieve full and productive employment and decent work for all, with equal pay for work of equal value."],
  ["9", "9.c", "Access to information and communications technology", "Significantly increase access to information and communications technology and strive to provide universal and affordable access to the Internet."],
  ["10", "10.3", "Equal opportunity and reduced inequalities", "Ensure equal opportunity and reduce inequalities of outcome, including by eliminating discriminatory laws, policies and practices."],
  ["11", "11.6", "Reduce cities’ environmental impact", "Reduce the adverse per capita environmental impact of cities, including by paying special attention to air quality and waste management."],
  ["12", "12.8", "Information and awareness for sustainable lifestyles", "Ensure that people everywhere have the relevant information and awareness for sustainable development and lifestyles in harmony with nature."],
  ["13", "13.2", "Integrate climate measures into policy and planning", "Integrate climate change measures into national policies, strategies and planning."],
  ["14", "14.5", "Conserve coastal and marine areas", "Conserve at least 10 per cent of coastal and marine areas, consistent with national and international law and based on the best available scientific information."],
  ["15", "15.9", "Integrate biodiversity into planning and accounting", "Integrate ecosystem and biodiversity values into national and local planning, development processes and poverty reduction strategies."],
  ["16", "16.10", "Public access to information and protection of freedoms", "Ensure public access to information and protect fundamental freedoms, in accordance with national legislation and international agreements."],
  ["17", "17.17", "Encourage effective public partnerships", "Encourage and promote effective public, public-private and civil society partnerships."],
];

// Curated demo labels for skill-to-target mappings. These are illustrative
// alignment weights, not measured SDG impact or labour-market observations.
const sdgSkillMappings = {
  "Data Analyst": [["SQL", "4.4", 0.76], ["SQL", "8.2", 0.64], ["SQL", "9.5", 0.86], ["SQL", "16.6", 0.60], ["Data cleaning", "8.2", 0.71], ["Data cleaning", "9.5", 0.80], ["Data cleaning", "16.6", 0.68], ["Business metrics", "8.2", 0.84], ["Business metrics", "9.5", 0.75], ["Business metrics", "12.6", 0.65], ["Analytical reasoning", "8.2", 0.79], ["Analytical reasoning", "9.5", 0.88], ["Analytical reasoning", "16.6", 0.66]],
  "Business Intelligence Analyst": [["SQL", "4.4", 0.72], ["SQL", "8.2", 0.60], ["SQL", "9.5", 0.78], ["SQL", "16.6", 0.72], ["Dashboard storytelling", "8.2", 0.88], ["Dashboard storytelling", "9.5", 0.74], ["Dashboard storytelling", "16.6", 0.82], ["Business reporting", "8.2", 0.82], ["Business reporting", "12.6", 0.68], ["Business reporting", "16.6", 0.84], ["Data modelling", "4.4", 0.64], ["Data modelling", "8.2", 0.68], ["Data modelling", "9.5", 0.80], ["Data modelling", "16.6", 0.77]],
  "Machine Learning Intern": [["Python", "4.4", 0.78], ["Python", "9.5", 0.84], ["Statistics", "4.4", 0.73], ["Statistics", "8.2", 0.55], ["Statistics", "9.5", 0.80], ["Model evaluation", "8.2", 0.50], ["Model evaluation", "9.5", 0.81], ["Model evaluation", "16.6", 0.72], ["Feature engineering", "8.2", 0.55], ["Feature engineering", "9.5", 0.86]],
  "Product Analyst": [["Product metrics", "8.2", 0.87], ["Product metrics", "9.5", 0.72], ["Product metrics", "12.6", 0.76], ["Experiment analysis", "4.4", 0.61], ["Experiment analysis", "8.2", 0.76], ["Experiment analysis", "9.5", 0.84], ["SQL", "4.4", 0.69], ["SQL", "8.2", 0.70], ["SQL", "9.5", 0.79], ["SQL", "16.6", 0.62], ["User behaviour analysis", "8.2", 0.83], ["User behaviour analysis", "10.2", 0.72], ["User behaviour analysis", "12.6", 0.61]],
  "Data Scientist": [["Machine learning", "8.2", 0.65], ["Machine learning", "9.5", 0.88], ["Machine learning", "16.6", 0.74], ["Statistics", "4.4", 0.74], ["Statistics", "9.5", 0.82], ["Statistics", "16.6", 0.70], ["Python", "4.4", 0.71], ["Python", "9.5", 0.84], ["Causal thinking", "8.2", 0.45], ["Causal thinking", "9.5", 0.82], ["Causal thinking", "16.6", 0.85]],
  "Machine Learning Engineer": [["Python engineering", "4.4", 0.73], ["Python engineering", "9.5", 0.84], ["MLOps", "8.2", 0.86], ["MLOps", "9.5", 0.88], ["MLOps", "16.6", 0.72], ["APIs", "4.4", 0.57], ["APIs", "8.2", 0.72], ["APIs", "9.5", 0.78], ["APIs", "17.6", 0.63], ["Cloud deployment", "8.2", 0.84], ["Cloud deployment", "9.5", 0.85], ["Cloud deployment", "17.6", 0.72]],
  "AI Engineer": [["LLM workflows", "4.4", 0.75], ["LLM workflows", "9.5", 0.88], ["LLM workflows", "17.6", 0.75], ["Prompt evaluation", "4.4", 0.45], ["Prompt evaluation", "9.5", 0.79], ["Prompt evaluation", "16.6", 0.84], ["APIs", "4.4", 0.58], ["APIs", "9.5", 0.76], ["APIs", "16.6", 0.80], ["APIs", "17.6", 0.70], ["Product judgement", "8.2", 0.50], ["Product judgement", "9.5", 0.62], ["Product judgement", "12.6", 0.55], ["Product judgement", "16.6", 0.72]],
  "Data Engineer": [["SQL", "4.4", 0.74], ["SQL", "8.2", 0.68], ["SQL", "9.5", 0.80], ["SQL", "16.6", 0.70], ["Data pipelines", "8.2", 0.87], ["Data pipelines", "9.5", 0.84], ["Data pipelines", "12.6", 0.67], ["Data pipelines", "16.6", 0.75], ["Cloud platforms", "8.2", 0.84], ["Cloud platforms", "9.5", 0.85], ["Cloud platforms", "17.6", 0.72], ["Data quality", "8.2", 0.78], ["Data quality", "9.5", 0.80], ["Data quality", "12.6", 0.64], ["Data quality", "16.6", 0.86]],
};
const sdgRows = [["role", "skill", "target_code", "alignment_weight"]];
for (const [role, mappings] of Object.entries(sdgSkillMappings)) {
  for (const [skill, targetCode, weight] of mappings) {
    sdgRows.push([role, skill, targetCode, Number(weight).toFixed(2)]);
  }
}
const sdgReferenceRows = [["number", "title", "summary", "icon_url", "target_code", "target_title", "target_definition"]];
for (const goal of sdgCatalog) {
  sdgReferenceRows.push([goal.number, goal.title, goal.summary, goal.icon_url, goal.target_code, goal.target_title, goal.target_definition]);
}
for (const [number, target_code, target_title, target_definition] of sdgSecondaryTargets) {
  const goal = sdgCatalog.find((item) => item.number === number);
  sdgReferenceRows.push([number, goal.title, goal.summary, goal.icon_url, target_code, target_title, target_definition]);
}
const trendHeader = ["role", "skill", "year", "scenario", "ai_exposure", "skill_relevance", "demand_index"];
const trendRows = [trendHeader];
for (let roleIndex = 0; roleIndex < roles.length; roleIndex++) {
  const role = roles[roleIndex];
  const exposure = 0.34 + (roleIndex % 4) * 0.13;
  for (let skillIndex = 0; skillIndex < skillByRole[role.name].length; skillIndex++) {
    const skill = skillByRole[role.name][skillIndex];
    const relevance = 0.58 + ((skillIndex * 7 + roleIndex * 3) % 5) * 0.08;
    for (const scenario of ["moderate", "fast"]) {
      for (let year = 2024; year <= 2032; year++) {
        const progress = year - 2024;
        const acceleration = scenario === "fast" ? 0.085 : 0.045;
        const direction = (skillIndex % 3 === 0 ? 0.035 : skillIndex % 3 === 1 ? 0.014 : -0.004) - exposure * acceleration * (skillIndex % 3 === 2 ? 1.15 : 0.42);
        const noise = (rand() - 0.5) * 0.035;
        const demand = Math.max(0, Math.min(100, 49 + relevance * 24 + progress * 100 * direction + noise * 100));
        trendRows.push([role.name, skill, year, scenario, exposure.toFixed(3), relevance.toFixed(3), demand.toFixed(2)]);
      }
    }
  }
}

const outputDir = resolve(projectRoot, "data");
await mkdir(outputDir, { recursive: true });
await writeFile(resolve(outputDir, "synthetic_role_profiles.csv"), csv(profileRows), "utf8");
await writeFile(resolve(outputDir, "unified_profile_career_dataset.csv"), csv(unifiedProfileRows), "utf8");
await writeFile(resolve(outputDir, "synthetic_skill_scenarios.csv"), csv(trendRows), "utf8");
await writeFile(resolve(outputDir, "synthetic_sdg_skill_mappings.csv"), csv(sdgRows), "utf8");
await writeFile(resolve(outputDir, "sdg_goal_reference.csv"), csv(sdgReferenceRows), "utf8");
await writeFile(resolve(outputDir, "README.md"), "# Synthetic career dataset\n\nGenerated by node scripts/generate_synthetic_data.mjs. Goal names, summaries, selected target wording, and icon links are reference data from the United Nations Sustainable Development Goals. Role-skill links and alignment weights are curated illustrative examples, not measured SDG impact. No files contain observed job-posting, wage, employment, SDG-impact, or measured AI-adoption data.\n\n- unified_profile_career_dataset.csv: canonical learner-row table combining the 2,880 synthetic model profiles with the registration profile schema. It contains synthetic role-matching features and labels; name, school, grades, awards, work history, and other personal narrative fields are intentionally blank because the source data does not provide them. Skills and categorized interests are serialized as JSON arrays, and experiences are an empty JSON array.\n- synthetic_role_profiles.csv: original compact model-training features, retained for reference.\n- synthetic_skill_scenarios.csv: simulated skill-demand indices by role, year (2024-2032), and moderate/fast AI-adoption scenario.\n- synthetic_sdg_skill_mappings.csv: illustrative role-skill-to-target links and weights used to rank a role's best-supported goals from the full 17-goal catalog.\n- sdg_goal_reference.csv: UN goal summaries and two subdomain references per goal, with icon image URLs from the Open SDG icon translations library.\n- Scores demonstrate model mechanics only. Replace or recalibrate them with public trend signals and reviewed mapping evidence before making real-world claims.\n", "utf8");
console.log(`Wrote ${unifiedProfileRows.length - 1} unified profiles, ${trendRows.length - 1} scenario rows, ${sdgRows.length - 1} SDG mapping rows and ${sdgReferenceRows.length - 1} goal references to ${outputDir}`);
