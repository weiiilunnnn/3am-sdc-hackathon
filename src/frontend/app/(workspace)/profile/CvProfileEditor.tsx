"use client";

import Link from "next/link";
import { useState } from "react";
import { CV_COLLECTIONS, cvEntryId, filledCvEntry, normalizeCvDetails, validateCvDetails, type CvCollectionKey, type CvDetails, type CvEntry } from "@/lib/cv-profile";

const LANGUAGES = ["English", "Malay", "Mandarin Chinese", "Cantonese", "Tamil", "Arabic", "Hindi", "Japanese", "Korean", "French", "Spanish", "German", "Other"];
const CONTACTS = [
  { key: "phone", label: "Phone number", placeholder: "+60 12-345 6789", hint: "Use country code where relevant.", type: "tel", max: 30 },
  { key: "location", label: "City / location", placeholder: "Kuala Lumpur, Malaysia", hint: "City or region is enough; no street address needed.", type: "text", max: 90 },
  { key: "linkedin", label: "LinkedIn URL", placeholder: "https://www.linkedin.com/in/your-profile", hint: "Full public linkedin.com URL.", type: "url", max: 260 },
  { key: "github", label: "GitHub URL", placeholder: "https://github.com/your-username", hint: "Full public github.com URL.", type: "url", max: 260 },
  { key: "portfolio", label: "Portfolio URL", placeholder: "https://your-portfolio.com", hint: "Public HTTPS address only; localhost links can't be printed.", type: "url", max: 260 },
  { key: "graduationDate", label: "Graduation date (optional)", placeholder: "2028 or May 2028", hint: "Use a four-digit year (2028, May 2028).", type: "text", max: 35 },
] as const;
const FIELD_MAX: Record<Exclude<keyof CvEntry,"id">,number> = {title:120,organization:120,period:80,url:260,description:2200};

export default function CvProfileEditor({ details, editPage, onChange, onSave }: {
  details?: CvDetails;
  editPage: boolean;
  onChange: (details: CvDetails) => void;
  onSave: () => void;
}) {
  const [attempted, setAttempted] = useState(false);
  const data = normalizeCvDetails(details);
  const errors = validateCvDetails(data);
  const errorCount = Object.keys(errors).length;
  const update = (changes: Partial<CvDetails>) => onChange({ ...data, ...changes });
  const updateEntry = (key: CvCollectionKey, id: string, field: keyof CvEntry, value: string) =>
    update({ [key]: data[key].map((entry) => entry.id === id ? { ...entry, [field]: value } : entry) });
  const contacts = [data.phone, data.location, data.linkedin, data.github, data.portfolio].filter(Boolean);
  const collections = CV_COLLECTIONS.map((collection) => ({ ...collection, count: data[collection.key].filter(filledCvEntry).length }));
  const chosenLanguages = data.languages.split(/[,;\n]/).map((name) => name.trim()).filter(Boolean);
  const save = () => {
    setAttempted(true);
    if (errorCount) {
      document.getElementById("cv-profile-details")?.scrollIntoView({ behavior:"smooth",block:"start" });
      return;
    }
    onSave();
  };
  const addLanguage = (name:string) => {
    const clean=name.trim();
    if (!clean || chosenLanguages.some((item)=>item.toLowerCase()===clean.toLowerCase()))return;
    update({languages:[...chosenLanguages,clean].join(", ")});
  };
  return <section id="cv-profile-details" className="completed-panel cv-profile-extras" aria-labelledby="cv-profile-title">
    <div className="cv-profile-header">
      <div>
        <div className="completed-section-kicker">ADDITIONAL CV INFORMATION</div>
        <h2 id="cv-profile-title">Your professional details</h2>
        <p>Optional CV information. You can skip anything that does not apply; registration stays unchanged.</p>
      </div>
      {!editPage && <Link className="button secondary small" href="/profile/edit#cv-profile-details">Edit details ↗</Link>}
    </div>
    {editPage ? <>
      {attempted && errorCount>0 && <p className="cv-extra-validation-summary" role="alert">Please correct {errorCount} highlighted field{errorCount===1?"":"s"} before saving. We check formatting, not whether your claims are true.</p>}
      <div className="cv-extra-grid">
        {CONTACTS.map(({key,label,placeholder,hint,type,max}) => <label className="cv-extra-field" key={key}>
          <span>{label}</span><input type={type} value={data[key]} maxLength={max} aria-invalid={Boolean(errors[key])}
            onChange={(event) => update({ [key]: event.target.value })} placeholder={placeholder}/>
          <span className="cv-extra-example">{hint}</span>
          {errors[key]&&<span role="status" className="cv-extra-field-error">{errors[key]}</span>}
        </label>)}
        <div className="cv-extra-field cv-extra-wide">
          <label htmlFor="cv-language-freeform">Languages</label>
          <div className="cv-extra-language-tools">
            <select aria-label="Add a language" defaultValue="" onChange={(event)=>{addLanguage(event.target.value);event.target.value="";}}>
              <option value="" disabled>Add from common languages…</option>
              {LANGUAGES.filter((v)=>v!=="Other").map((v)=><option key={v} value={v}>{v}</option>)}
            </select>
            <span className="cv-extra-example">Or enter another language below.</span>
          </div>
          <input id="cv-language-freeform" value={data.languages} maxLength={350} aria-invalid={Boolean(errors.languages)}
            onChange={(event)=>update({languages:event.target.value})} placeholder="English, Malay, Mandarin Chinese"/>
          {chosenLanguages.length>0&&<div className="cv-extra-language-tags" aria-label="Remove a language">
            {chosenLanguages.map((v,i)=><button type="button" key={`${v}-${i}`} title={`Remove ${v}`}
              onClick={()=>update({languages:chosenLanguages.filter((_,j)=>j!==i).join(", ")})}>{v} ×</button>)}
          </div>}
          {errors.languages&&<span className="cv-extra-field-error" role="status">{errors.languages}</span>}
        </div>
      </div>
      <p className="cv-extra-help">Use accurate, verifiable details. Links must start with https://. Invalid or local links are omitted from the exported CV.</p>
      {CV_COLLECTIONS.map(({key,title,singular}) => <details key={key} className="cv-extra-group">
        <summary>{title} <span>{data[key].filter(filledCvEntry).length} saved · expand to edit</span></summary>
        <div className="cv-extra-records">
          {data[key].map((entry,index) => <div className="cv-extra-record" key={entry.id}>
            <div className="cv-extra-record-top"><strong>{singular} {index+1}</strong><button type="button" className="cv-text-button" onClick={() => update({ [key]: data[key].filter((item) => item.id !== entry.id) })}>Remove</button></div>
            <div className="cv-extra-grid">
              {([
                ["title", "Title / qualification", key==="additionalEducation"?"e.g. BSc Computer Science":`Enter ${singular.toLowerCase()} title`],
                ["organization", "Organization / university", "e.g. Asia Pacific University"],
                ["period", "Period / date", "e.g. Jan 2025 – Present or 2022–2028"],
                ["url", "Relevant URL", "https://example.com/credential"],
              ] as const).map(([field,label,placeholder]) => {
                const fieldKey=`${key}.${entry.id}.${field}`;
                return <label className="cv-extra-field" key={field}><span>{label}</span>
                  <input type={field==="url"?"url":"text"} value={entry[field]} maxLength={FIELD_MAX[field]} aria-invalid={Boolean(errors[fieldKey])}
                    onChange={(event) => updateEntry(key,entry.id,field,event.target.value)} placeholder={placeholder}/>
                  {errors[fieldKey]&&<span className="cv-extra-field-error" role="status">{errors[fieldKey]}</span>}
                </label>;
              })}
              <label className="cv-extra-field cv-extra-wide"><span>Responsibilities, results or description (one bullet per line)</span>
                <textarea rows={3} maxLength={FIELD_MAX.description} aria-invalid={Boolean(errors[`${key}.${entry.id}.description`])}
                  value={entry.description} onChange={(event) => updateEntry(key,entry.id,"description",event.target.value)}
                  placeholder="For example: Developed a Python dashboard to analyze energy use"/>
                {errors[`${key}.${entry.id}.description`]&&<span className="cv-extra-field-error" role="status">{errors[`${key}.${entry.id}.description`]}</span>}
              </label>
            </div>
            <p className="cv-extra-example">Tips: include a meaningful title, an appropriate organization, a year and what you accomplished. Descriptions remain free-text; Pathwaay does not verify claims.</p>
          </div>)}
          <button type="button" className="button secondary small" disabled={data[key].length>=20}
            onClick={() => update({ [key]: [...data[key], {id:cvEntryId(),title:"",organization:"",period:"",description:"",url:""}] })}>
            + Add {singular.toLowerCase()}{data[key].length>=20?" (limit reached)":""}
          </button>
        </div>
      </details>)}
      <div className="cv-extra-save"><p>Changes are a draft until you save your profile. Blank sections never appear in the CV.</p>
        <button className="button small" type="button" onClick={save}>Save profile changes ↗</button></div>
    </> : <>
      {contacts.length || data.graduationDate || data.languages || collections.some((item) => item.count) ? <div className="cv-extra-readonly">
          {contacts.length > 0 && <p><strong>Contact:</strong> {contacts.join(" · ")}</p>}
          {data.graduationDate && <p><strong>Graduation:</strong> {data.graduationDate}</p>}
          {data.languages && <p><strong>Languages:</strong> {data.languages}</p>}
          {collections.filter((item)=>item.count>0).map((item)=><p key={item.key}><strong>{item.title}:</strong> {item.count} {item.count===1?"entry":"entries"}</p>)}
        </div> : <p className="cv-extra-help">No additional CV details yet. Add contact links, structured projects, awards or languages whenever you're ready.</p>}
      <Link className="cv-text-button" href="/cv-studio">View your CV in CV Studio →</Link>
    </>}
  </section>;
}
