// Pure functions, no database: given an email, decide what it means.
// Keyword rules are a heuristic: good enough for common recruiter emails,
// and easy to extend. Kept free of I/O so they can be tested with plain input.

// Checked in this order; first match wins. Rejected comes first because a
// rejection often mentions "interview" too ("after your interview, unfortunately...").
const STATUS_RULES = [
  ['rejected', /unfortunately|regret to inform|not (?:be )?moving forward|move forward with other|other candidates|not been selected|position has been filled/i],
  ['offer', /offer letter|pleased to offer|job offer|extend(?:ing)? (?:you )?an offer|offer of employment/i],
  ['interview', /interview|on-?site|schedule a (?:call|time)|your availability/i],
  ['screening', /phone screen|screening call|assessment|coding (?:challenge|test)|take-?home|hackerrank|codility/i],
  ['applied', /thank you for applying|thanks for applying|thank you for your application|thanks for your application|application (?:has been )?received|received your application/i],
];

function detectStatus(subject, text) {
  const haystack = `${subject}\n${text}`;
  for (const [status, pattern] of STATUS_RULES) {
    if (pattern.test(haystack)) return status;
  }
  return null; // no idea what this email is about
}

// Statuses only move forward. Rejected can happen at any stage, and is final.
const RANK = { applied: 0, screening: 1, interview: 2, offer: 3 };

function shouldUpdate(current, next) {
  if (!next || next === current) return false;
  if (current === 'rejected') return false;
  if (next === 'rejected') return true;
  return RANK[next] > RANK[current];
}

// Senders whose domain says nothing about the hiring company:
// personal mail, and job platforms (ATS) that email on behalf of many companies.
const NO_COMPANY_SIGNAL = [
  'gmail.com', 'outlook.com', 'hotmail.com', 'yahoo.com',
  'greenhouse.io', 'greenhouse-mail.io', 'lever.co', 'myworkdayjobs.com', 'workday.com',
  'ashbyhq.com', 'smartrecruiters.com', 'workable.com', 'icims.com',
  'linkedin.com', 'indeed.com', 'naukri.com',
];
const DOMAIN_SUFFIXES = new Set(['com', 'co', 'io', 'in', 'uk', 'org', 'net', 'ai', 'dev', 'jobs', 'us']);

// "jobs@careers.acme.co.uk" -> "acme". null if the domain is not a company signal.
function senderCompanyLabel(from) {
  const domain = from.split('@')[1] || '';
  if (NO_COMPANY_SIGNAL.some((d) => domain === d || domain.endsWith(`.${d}`))) return null;
  const labels = domain.split('.').filter((l) => !DOMAIN_SUFFIXES.has(l));
  return labels.length ? labels[labels.length - 1] : null;
}

const LEGAL_SUFFIXES = /\b(?:inc|llc|ltd|limited|corp|corporation|pvt|private|gmbh)\b\.?/gi;

// "Acme, Inc." -> "acme"   (for comparing with a domain label)
function normalizeCompany(name) {
  return name.replace(LEGAL_SUFFIXES, '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// apps: the user's applications, newest first.
// 1. sender domain matches the company name  (jobs@acme.com -> "Acme Inc")
// 2. otherwise the company name appears in subject/text as a whole word
//    (needed for ATS mail: no-reply@greenhouse.io, "Your application to Acme")
function matchApplication(apps, { from, subject, text }) {
  const label = senderCompanyLabel(from);
  if (label) {
    const byDomain = apps.find((a) => normalizeCompany(a.company) === label);
    if (byDomain) return byDomain;
  }

  const haystack = `${subject}\n${text}`;
  return (
    apps.find((a) => {
      const name = a.company.replace(LEGAL_SUFFIXES, '').replace(/[.,]/g, '').trim();
      if (name.length < 3) return false; // "HP", "X": too likely to match by accident
      return new RegExp(`\\b${escapeRegex(name)}\\b`, 'i').test(haystack);
    }) || null
  );
}

// Used only when an "applied" email matches no application: guess what to create.
// Capitalised words after "applying to", "position at", etc. Heuristic: the user
// can rename it later. Returns null when no company can be found.
const COMPANY_PATTERNS = [
  /(?:applying|application|applied) (?:to|at|with) ([A-Z][\w&.'-]*(?: [A-Z][\w&.'-]*){0,3})/,
  /interest in (?:joining )?([A-Z][\w&.'-]*(?: [A-Z][\w&.'-]*){0,3})/,
  /(?:position|role|job|opening) at ([A-Z][\w&.'-]*(?: [A-Z][\w&.'-]*){0,3})/,
];
const ROLE_PATTERNS = [
  /(?:application|applying) for (?:the |a |an )?([A-Z][\w\/&+#.()' -]{2,80}?)(?: (?:position|role|opening))?(?: at | with |[!.,|]|$)/,
  /(?:for|as) (?:the |a |an )?([A-Z][\w\/&+#.()' -]{2,80}?) (?:position|role|opening)\b/,
  / [-–|:] ([A-Z][\w\/&+#.()' -]{2,80})$/,
];

function firstMatch(patterns, s) {
  for (const p of patterns) {
    const m = s.match(p);
    if (m) return m[1].trim();
  }
  return null;
}

function guessCompanyAndRole({ from, subject, text }) {
  let company = firstMatch(COMPANY_PATTERNS, `${subject}\n${text}`);
  if (!company) {
    const label = senderCompanyLabel(from); // careers@razorpay.com -> "razorpay"
    if (label) company = label.charAt(0).toUpperCase() + label.slice(1);
  }
  if (!company) return null;
  const role = firstMatch(ROLE_PATTERNS, subject) || firstMatch(ROLE_PATTERNS, text) || 'Unknown role';
  return { company: company.slice(0, 255), role: role.slice(0, 255) };
}

module.exports = {
  detectStatus,
  shouldUpdate,
  senderCompanyLabel,
  normalizeCompany,
  matchApplication,
  guessCompanyAndRole,
};
