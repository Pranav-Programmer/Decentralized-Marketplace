// frontend/public/app.js
const API_BACKEND = "http://localhost:4000";
const API_CHAIN = "http://localhost:4001";

function log(msg) {
  const el = document.getElementById("log");
  el.innerText = msg + "\n" + el.innerText;
  console.log(msg);
}

async function sha256Hex(str) {
  const enc = new TextEncoder();
  const data = enc.encode(str);
  const hash = await crypto.subtle.digest("SHA-256", data);
  const hex = Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, "0")).join("");
  return "0x" + hex;
}

async function fetchAccounts() {
  const r = await fetch(`${API_CHAIN}/accounts`);
  if (!r.ok) return [];
  const j = await r.json();
  return j.accounts || [];
}

async function createJob(clientAddr, rewardWei, payloadRef) {
  const res = await fetch(`${API_BACKEND}/jobs`, {
    method: "POST",
    headers: {"Content-Type":"application/json"},
    body: JSON.stringify({ client_addr: clientAddr, reward: rewardWei, payload_ref: payloadRef })
  });
  if (!res.ok) throw new Error("Create job failed: " + res.status);
  return await res.json();
}

// ---------- jobs fetching and rendering (REPLACE EXISTING getOpenJobs / refreshJobs / renderJobs) ----------
async function getOpenJobs() {
  // fetch jobs from backend (active jobs)
  const r = await fetch(`${API_BACKEND}/jobs/open`);
  if (!r.ok) {
    throw new Error('Failed to fetch jobs: ' + r.status);
  }
  return await r.json();
}

// fetch on-chain status for a job (safe: returns a normalized object even on errors)
async function fetchOnchainStatus(job) {
  try {
    const jobIdHex = await sha256Hex(job.id);
    const r = await fetch(`${API_CHAIN}/getJob`, {
      method: "POST",
      headers: {"Content-Type":"application/json"},
      body: JSON.stringify({ jobIdHex })
    });
    if (!r.ok) {
      // try to read error text and return fallback
      const text = await r.text();
      console.warn('getJob returned non-200:', text);
      return { funded: false, released: false, client: null, worker: null };
    }
    const j = await r.json();
    // ensure booleans present (some fallbacks return strings)
    return {
      funded: !!j.funded,
      released: !!j.released,
      client: j.client || null,
      worker: j.worker || null,
      reward: j.reward || null,
      resultHash: j.resultHash || null
    };
  } catch (e) {
    console.warn('fetchOnchainStatus error for job', job.id, e);
    return { funded: false, released: false, client: null, worker: null };
  }
}


// helper: call chain-service getJob (on-chain read)
async function getOnChainJob(jobIdHex) {
  const r = await fetch(`${API_CHAIN}/getJob`, {
    method: "POST",
    headers: {"Content-Type":"application/json"},
    body: JSON.stringify({ jobIdHex })
  });
  if (!r.ok) {
    const t = await r.text();
    throw new Error("getJob failed: " + t);
  }
  return await r.json(); // { client, worker, reward, resultHash, funded, released }
}

async function fundJob(job) {
  try {
    const jobIdHex = await sha256Hex(job.id);
    const body = { jobIdHex, amountWei: String(job.reward) };
    log(`Funding job ${job.id} (${jobIdHex}) with ${job.reward} wei...`);
    const r = await fetch(`${API_CHAIN}/fundJob`, {
      method: "POST", headers: {"Content-Type":"application/json"}, body: JSON.stringify(body)
    });
    const j = await r.json();
    if (j.error) {
      log("fundJob response error: " + JSON.stringify(j));
      return;
    }
    log("fundJob response: " + JSON.stringify(j));
    // update backend DB client_addr to the on-chain funder (server wallet)
    if (j.funder) {
      await fetch(`${API_BACKEND}/jobs/${job.id}/update_client`, {
        method: "POST", headers: {"Content-Type":"application/json"},
        body: JSON.stringify({ client_addr: j.funder })
      });
      log("Updated job client in DB to funder: " + j.funder);
    }
    await refreshJobs();
  } catch (e) {
    log("fundJob response: " + JSON.stringify({ error: e.toString() }));
  }
}

async function claimJob(job) {
  try {
    const jobIdHex = await sha256Hex(job.id);
    // check funded on-chain
    const onchain = await getOnChainJob(jobIdHex);
    if (!onchain.funded) {
      alert("Job is not funded on-chain. Click Fund first.");
      return;
    }
    log(`Claiming job ${job.id}...`);
    const r = await fetch(`${API_CHAIN}/claimJob`, {
      method: "POST", headers: {"Content-Type":"application/json"}, body: JSON.stringify({ jobIdHex })
    });
    const j = await r.json();
    if (j.error) {
      log("claimJob response: " + JSON.stringify(j));
      return;
    }
    log("claimJob response: " + JSON.stringify(j));
    // optionally update DB worker_addr to the claiming actor if actor returned
    if (j.actor) {
      await fetch(`${API_BACKEND}/jobs/${job.id}/claim`, { method: "POST" , headers: {"Content-Type":"application/json"}, body: JSON.stringify({ worker_addr: j.actor })}).catch(()=>{});
    }
    await refreshJobs();
  } catch (e) {
    log("claimJob error: " + e);
  }
}

async function dispatchJob(job) {
  log(`Dispatching job ${job.id} (backend will spawn a worker) ...`);
  const r = await fetch(`${API_BACKEND}/jobs/${job.id}/dispatch`, { method: "POST" });
  const j = await r.json();
  log("dispatch response: " + JSON.stringify(j));
  // Wait a small time for worker to run & notarize, then refresh
  setTimeout(refreshJobs, 1500);
}

async function submitResult(job) {
  try {
    const jobIdHex = await sha256Hex(job.id);
    const onchain = await getOnChainJob(jobIdHex);
    // ensure server wallet is the worker (only worker may submit with server wallet)
    const server = await (await fetch(`${API_CHAIN}/serverAccount`)).json();
    if (onchain.worker.toLowerCase() !== (server.account || "").toLowerCase()) {
      alert("On-chain worker is not the server wallet. Either run Claim with server wallet or submit result through the Dispatch (backend worker) or use MetaMask as the worker.");
      return;
    }
    const resultText = `result_of_${job.id}_${Date.now()}`;
    const resultHashHex = await sha256Hex(resultText);
    log(`Submitting result for ${job.id} -> ${resultHashHex}`);
    const r = await fetch(`${API_CHAIN}/submitResult`, {
      method: "POST", headers: {"Content-Type":"application/json"},
      body: JSON.stringify({ jobIdHex, resultHashHex })
    });
    const j = await r.json();
    if (j.error) log("submitResult response: " + JSON.stringify(j));
    else log("submitResult response: " + JSON.stringify(j));
    await refreshJobs();
  } catch (e) {
    log("submitResult error: " + e);
  }
}

async function releasePayment(job) {
  try {
    const jobIdHex = await sha256Hex(job.id);
    const onchain = await getOnChainJob(jobIdHex);
    const server = await (await fetch(`${API_CHAIN}/serverAccount`)).json();

    // If the on-chain client != server wallet, release must be performed by the client account (MetaMask)
    if (onchain.client.toLowerCase() !== (server.account || "").toLowerCase()) {
      alert("Release must be called by the on-chain client (the account that funded this job). Use MetaMask (client) to call releasePayment, or fund using the server wallet so the server can call release.");
      return;
    }

    log(`Releasing payment for ${job.id} ...`);
    const r = await fetch(`${API_CHAIN}/releasePayment`, {
      method: "POST", headers: {"Content-Type":"application/json"},
      body: JSON.stringify({ jobIdHex })
    });
    const j = await r.json();
    if (j.error) log("releasePayment response: " + JSON.stringify(j));
    else log("releasePayment response: " + JSON.stringify(j));
    await refreshJobs();
  } catch (e) {
    log("releasePayment error: " + e);
  }
}

async function refreshJobs() {
  try {
    // load DB jobs
    const jobs = await getOpenJobs();

    // For better UX: fetch on-chain state in parallel for all jobs
    // and attach to job objects so rendering has up-to-date funded/released flags.
    const enhanced = await Promise.all(jobs.map(async (job) => {
      const chain = await fetchOnchainStatus(job);
      return Object.assign({}, job, { _onchain: chain });
    }));

    renderJobs(enhanced);
  } catch (e) {
    log('refreshJobs error: ' + e);
    console.error(e);
  }
}

function renderJobs(jobs) {
  const tbody = document.getElementById("jobs-body");
  tbody.innerHTML = "";

  jobs.forEach(job => {
    const onchain = job._onchain || { funded: false, released: false, client: null, worker: null };

    // Determine text color for the whole row based on on-chain release/fund state
    let rowColor = 'red'; // default: not funded
    if (onchain.released) rowColor = 'green';
    else if (onchain.funded) rowColor = 'orange'; // more visible than yellow on many monitors

    // build action buttons; they will be disabled if released
    const disabledAll = !!onchain.released;

    // Disable Fund button if already funded or released
    const fundDisabled = disabledAll || !!onchain.funded;

    // Claim should be disabled if not funded or already released
    const claimDisabled = disabledAll || !onchain.funded;

    // Dispatch should be disabled until funded (but enabled once funded)
    const dispatchDisabled = disabledAll || !onchain.funded;

    // SubmitResult: prefer enabling only if worker is set (or allow workarounds)
    // Here we allow SubmitResult if not released and if funded (worker may be server wallet)
    const submitDisabled = disabledAll || !onchain.funded;

    // Release: only enable if funded & not released and caller must be client (frontend check done on click)
    const releaseDisabled = disabledAll || !onchain.funded;

    const tr = document.createElement("tr");
    tr.style.color = rowColor;
    tr.innerHTML = `
      <td>${job.id}</td>
      <td>${job.client_addr || (onchain.client ? onchain.client : "")}</td>
      <td>${job.worker_addr || (onchain.worker ? onchain.worker : "")}</td>
      <td>${job.reward}</td>
      <td>${job.payload_ref || ""}</td>
      <td>${job.status || ""}</td>
      <td>${job.result_hash || (onchain.resultHash ? onchain.resultHash : "")}</td>
      <td>
        <button data-id="${job.id}" class="fund" ${fundDisabled ? 'disabled' : ''}>Fund</button>
        <button data-id="${job.id}" class="claim" ${claimDisabled ? 'disabled' : ''}>Claim</button>
        <button data-id="${job.id}" class="dispatch" ${dispatchDisabled ? 'disabled' : ''}>Dispatch</button>
        <button data-id="${job.id}" class="submit" ${submitDisabled ? 'disabled' : ''}>SubmitResult</button>
        <button data-id="${job.id}" class="release" ${releaseDisabled ? 'disabled' : ''}>Release</button>
      </td>
    `;
    tbody.appendChild(tr);
  });

  // attach events (only enabled buttons will be clickable due to disabled attr)
  document.querySelectorAll("button.fund").forEach(b=>{
    b.onclick = async (e)=> {
      const id = e.target.dataset.id;
      const job = jobs.find(j=>j.id===id);
      if (!job) return;
      await fundJob(job);
    };
  });
  document.querySelectorAll("button.claim").forEach(b=>{
    b.onclick = async (e)=> {
      const id = e.target.dataset.id;
      const job = jobs.find(j=>j.id===id);
      if (!job) return;
      await claimJob(job);
    };
  });
  document.querySelectorAll("button.dispatch").forEach(b=>{
    b.onclick = async (e)=> {
      const id = e.target.dataset.id;
      const job = jobs.find(j=>j.id===id);
      if (!job) return;
      await dispatchJob(job);
    };
  });
  document.querySelectorAll("button.submit").forEach(b=>{
    b.onclick = async (e)=> {
      const id = e.target.dataset.id;
      const job = jobs.find(j=>j.id===id);
      if (!job) return;
      await submitResult(job);
    };
  });
  document.querySelectorAll("button.release").forEach(b=>{
    b.onclick = async (e)=> {
      const id = e.target.dataset.id;
      const job = jobs.find(j=>j.id===id);
      if (!job) return;
      await releasePayment(job);
    };
  });
}

// initial UI
document.body.innerHTML = `
  <h2>Decentralized Job Marketplace — Visualizer</h2>
  <div>
    <label>Client (auto from chain-service accounts): </label>
    <select id="account-select"></select>
    <button id="create-job">Create Job</button>
    <button id="refresh">Refresh Jobs</button>
  </div>
  <hr/>
  <table border="1" style="width:100%;font-size:12px">
    <thead>
      <tr>
        <th>id</th><th>client_addr</th><th>worker_addr</th><th>reward</th><th>payload_ref</th><th>status</th><th>result_hash</th><th>actions</th>
      </tr>
    </thead>
    <tbody id="jobs-body"></tbody>
  </table>
  <h3>Log</h3>
  <pre id="log" style="height:240px; overflow:auto; background:#111; color:#9f9; padding:10px;"></pre>
`;

// wire UI handlers
document.getElementById("refresh").onclick = refreshJobs;

document.getElementById("create-job").onclick = async ()=>{
  try {
    const sel = document.getElementById("account-select");
    const client = sel.value;
    if (!client) return alert("No account available from chain-service");
    const payload = `payload://demo-${Date.now()}`;
    const rewardWei = 10000000000000000;
    const res = await createJob(client, rewardWei, payload);
    log("Created job: " + JSON.stringify(res));
    await refreshJobs();
  } catch (e) {
    log("create-job error: " + e);
    console.error(e);
    alert('Create job failed: ' + (e.message || e));
  }
};


// load accounts and jobs at start (auto-select server wallet when present)
(async ()=>{
  try {
    // fetch list of unlocked provider accounts
    const accountsResp = await fetch(`${API_CHAIN}/accounts`);
    if (!accountsResp.ok) throw new Error('accounts fetch failed: ' + accountsResp.status);
    const accountsJson = await accountsResp.json();
    const rawAccounts = accountsJson.accounts || [];

    // fetch chain-service server wallet (the private-key wallet used by chain-service)
    let serverAddr = null;
    try {
      const serverResp = await fetch(`${API_CHAIN}/serverAccount`);
      if (serverResp.ok) {
        const serverJson = await serverResp.json();
        serverAddr = serverJson.account || null;
      }
    } catch (e) {
      // ignore - serverAccount optional
      console.warn('serverAccount fetch failed:', e);
    }

    const sel = document.getElementById("account-select");

    // populate dropdown safely (handles string or object entries)
    rawAccounts.forEach(a=>{
      let addr = null;
      if (typeof a === 'string') addr = a;
      else if (a && typeof a === 'object') {
        addr = a.address || a.addr || a.acct || a[0] || null;
      }
      const display = addr || (typeof a === 'object' ? JSON.stringify(a) : String(a));
      const o = document.createElement("option");
      o.value = addr || display;
      o.innerText = display;
      sel.appendChild(o);
    });

    // AUTO-SELECT server wallet if it is present in the dropdown; otherwise pick first option if any
    // <-- one-line auto-select patch:
    sel.value = serverAddr || (sel.options.length > 0 ? sel.options[0].value : "");

    // refresh jobs view
    await refreshJobs();
    log("UI ready. Accounts loaded. Server wallet: " + (serverAddr || 'none'));
  } catch (e) {
    log("startup error: " + e);
    console.error(e);
  }
})();

