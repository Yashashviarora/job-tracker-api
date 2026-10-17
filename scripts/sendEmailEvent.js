// Dev tool: pretends to be the mail provider. Builds an email event, signs it
// with WEBHOOK_SECRET exactly like the provider would, and POSTs it.
//
// node scripts/sendEmailEvent.js --id evt-1 --from jobs@acme.com --to you@x.com --subject "Interview"
// Extra switches: --bad-sig (wrong secret), --old (timestamp 10 min ago), --url <endpoint>
require('dotenv').config({ quiet: true });
const { sign } = require('../src/utils/signature');

// "--name value" -> value, or the fallback if not given
function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}
const flag = (name) => process.argv.includes(`--${name}`);

async function main() {
  const secret = process.env.WEBHOOK_SECRET;
  if (!secret) throw new Error('WEBHOOK_SECRET is not set in .env');

  const url = arg('url', 'http://localhost:3000/events/email');
  const event = {
    event_id: arg('id', `evt-${Date.now()}`),
    from: arg('from', 'recruiting@acme.com'),
    to: arg('to', 'you@example.com'),
    subject: arg('subject', 'Interview invitation'),
    text: arg('text', 'We would like to schedule an interview with you.'),
  };

  // Sign the exact string we send. Any byte changed after this breaks the HMAC.
  const body = JSON.stringify(event);
  let timestamp = Math.floor(Date.now() / 1000);
  if (flag('old')) timestamp -= 600; // outside the 5-minute window
  const signature = sign(body, String(timestamp), flag('bad-sig') ? 'not-the-real-secret' : secret);

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Timestamp': String(timestamp),
      'X-Signature': signature,
    },
    body,
  });
  console.log(res.status, await res.text());
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
