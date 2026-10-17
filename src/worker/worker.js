const env = require('../config/env');
const jobRepo = require('../repositories/jobRepository');
const { processEvent } = require('../services/emailProcessor');

const MAX_ATTEMPTS = 5;

let running = false; // false once stopWorker() is called
let timer = null;    // the pending setTimeout, so we can cancel it
let current = null;  // the tick in progress, so shutdown can wait for it

// 1, 2, 4, 8 seconds for attempts 1..4. Attempt 5 never waits: it's dead-lettered.
function backoffSeconds(attempts) {
  return 2 ** (attempts - 1);
}

// One job: process it, then record the outcome on the job row.
async function runJob(job) {
  try {
    const note = await processEvent(job.inbound_event_id);
    await jobRepo.markDone(job.id, note);
    console.log(`[worker] job ${job.id} done: ${note}`);
  } catch (err) {
    const message = err.message || String(err);
    if (job.attempts >= MAX_ATTEMPTS) {
      await jobRepo.moveToDeadLetter(job, message);
      console.error(`[worker] job ${job.id} dead-lettered after ${job.attempts} attempts: ${message}`);
    } else {
      const delay = backoffSeconds(job.attempts);
      await jobRepo.scheduleRetry(job.id, message, delay);
      console.warn(`[worker] job ${job.id} attempt ${job.attempts} failed, retry in ${delay}s: ${message}`);
    }
  }
}

// One tick: put crashed jobs back, then drain everything that's ready right now.
async function tick() {
  await jobRepo.reclaimStale();
  let job;
  while (running && (job = await jobRepo.claimNext())) {
    await runJob(job);
  }
}

// setTimeout, not setInterval: the next tick is scheduled only after this one
// finishes, so two ticks can never overlap, however slow a job is.
function scheduleNext() {
  if (!running) return;
  timer = setTimeout(async () => {
    current = tick().catch((err) => console.error('[worker] tick failed:', err.message));
    await current;
    current = null;
    scheduleNext();
  }, env.WORKER_POLL_MS);
}

function startWorker() {
  if (running) return;
  running = true;
  console.log(`[worker] started, polling every ${env.WORKER_POLL_MS}ms`);
  scheduleNext();
}

// Stop polling, and wait for the job in progress so it isn't cut off halfway.
async function stopWorker() {
  running = false;
  clearTimeout(timer);
  if (current) await current;
  console.log('[worker] stopped');
}

module.exports = { startWorker, stopWorker };
