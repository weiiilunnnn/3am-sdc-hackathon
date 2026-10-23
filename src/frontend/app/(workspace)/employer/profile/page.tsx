import Link from "next/link";
import { PageIntro } from "../../WorkspaceStates";

export default function EmployerProfilePage() {
  return <main className="page-wrap employer-page employer-company-profile-page">
    <PageIntro kicker="EMPLOYER VIEW · COMPANY PROFILE" title={<>Meet Company X.</>} description="The company profile for this Employer View demo workspace." index="OWN PROFILE / 03" />
    <div className="employer-notice" role="note"><strong>Demo profile:</strong> Company X is a fictional IT company created for this prototype. This profile is illustrative and is not an authenticated or registered organization.</div>
    <section className="panel employer-company-card" aria-labelledby="employer-company-name">
      <div className="employer-company-monogram" aria-hidden="true">X</div>
      <div className="employer-company-identity">
        <span className="employer-member-number">EMPLOYER DEMO PROFILE</span>
        <h2 id="employer-company-name">Company X</h2>
        <p>Information Technology · Demo company</p>
      </div>
      <span className="employer-company-badge">SYNTHETIC DEMO</span>
    </section>
    <section className="panel employer-company-details" aria-labelledby="employer-company-details-title">
      <div className="section-heading"><span className="section-no">01</span><div><h2 id="employer-company-details-title">Company overview</h2><p>Fictional details for the Employer View prototype.</p></div></div>
      <dl className="employer-company-facts">
        <div><dt>Company name</dt><dd>Company X</dd></div>
        <div><dt>Industry</dt><dd>Information Technology (IT)</dd></div>
        <div><dt>Profile type</dt><dd>Fictional demo organization</dd></div>
      </dl>
      <p className="employer-company-description">Company X is a fictional IT company used to demonstrate department setup, team skills review and learning-plan workflows. No real company or employee information is represented.</p>
      <Link className="button secondary" href="/employer">Return to dashboard</Link>
    </section>
  </main>;
}
