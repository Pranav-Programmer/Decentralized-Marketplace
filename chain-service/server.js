// chain-service/server.js
require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const { ethers } = require('ethers');
const fs = require('fs-extra');
const path = require('path');

const app = express();
app.use(bodyParser.json());

/* -----------------------
   Simple CORS for dev
   ----------------------- */
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', 'http://localhost:3000');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

/* -----------------------
   Config & provider
   ----------------------- */
const RPC = process.env.RPC_URL || "http://127.0.0.1:8545";
const provider = new ethers.JsonRpcProvider(RPC);

const PRIVATE_KEY = process.env.PRIVATE_KEY || null;
const wallet = PRIVATE_KEY ? new ethers.Wallet(PRIVATE_KEY, provider) : null;

const ABI_PATH = process.env.CONTRACT_ABI_PATH || path.join(__dirname, '../contracts/artifacts/contracts/SimpleEscrow.sol/SimpleEscrow.json');
const CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS || null;

/* -----------------------
   Persistent in-memory state
   - file on disk holds a JSON map: jobIdHex -> state
   - state fields: client, worker, funded, resultHash, released, lastTxs (array)
   ----------------------- */
const STATE_FILE = path.join(__dirname, 'onchainState.json');
let onchainState = {};

// load persisted state if present
try {
  if (fs.existsSync(STATE_FILE)) {
    onchainState = fs.readJsonSync(STATE_FILE);
    console.log('Loaded onchainState from', STATE_FILE);
  } else {
    onchainState = {};
  }
} catch (e) {
  console.warn('Could not read onchain state file, starting fresh:', e.toString());
  onchainState = {};
}

function persistState() {
  try {
    fs.writeJsonSync(STATE_FILE, onchainState, { spaces: 2 });
  } catch (e) {
    console.error('Failed to persist state:', e.toString());
  }
}

/* -----------------------
   Helpers
   ----------------------- */
async function loadAbi() {
  if (!ABI_PATH || !fs.existsSync(ABI_PATH)) throw new Error(`ABI path not found: ${ABI_PATH}`);
  const json = await fs.readJson(ABI_PATH);
  return json.abi;
}

async function loadContract(signerOrProvider) {
  const abi = await loadAbi();
  if (!CONTRACT_ADDRESS) throw new Error('CONTRACT_ADDRESS not configured in .env');
  return new ethers.Contract(CONTRACT_ADDRESS, abi, signerOrProvider);
}

function ensureState(jobIdHex) {
  if (!onchainState[jobIdHex]) {
    onchainState[jobIdHex] = {
      client: null,
      worker: null,
      funded: false,
      resultHash: null,
      released: false,
      lastTxs: []
    };
  }
}

/* -----------------------
   Diagnostics endpoints
   ----------------------- */
app.get('/health', async (req, res) => {
  try {
    const hasAbi = ABI_PATH && fs.existsSync(ABI_PATH);
    const code = CONTRACT_ADDRESS ? await provider.getCode(CONTRACT_ADDRESS) : null;
    res.json({ ok: true, contractAddress: CONTRACT_ADDRESS, abiPath: ABI_PATH, hasAbi, codeSample: code ? code.slice(0,60) : code });
  } catch (e) {
    res.status(500).json({ ok:false, error: e.toString() });
  }
});

app.get('/accounts', async (req, res) => {
  try {
    const accounts = await provider.listAccounts();
    return res.json({ accounts });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: e.toString() });
  }
});

app.get('/serverAccount', async (req, res) => {
  try {
    if (!wallet) return res.json({ account: null });
    return res.json({ account: await wallet.getAddress() });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: e.toString() });
  }
});

/* -----------------------
   Robust getJob:
   - try contract.getJob()
   - if it throws / returns bad data, fall back to:
     1) our persisted onchainState (if exists)
     2) best-effort read from backend DB (GET /jobs/open) to find the job UUID and map DB fields
   ----------------------- */
app.post('/getJob', async (req, res) => {
  try {
    const { jobIdHex } = req.body;
    if (!jobIdHex) return res.status(400).json({ error: 'jobIdHex required' });

    // 1) Try calling the contract
    try {
      const contract = await loadContract(provider);
      const job = await contract.getJob(jobIdHex);
      // normalize to a plain JS object (BigInt -> string)
      return res.json({
        client: job.client,
        worker: job.worker,
        reward: job.reward ? job.reward.toString() : null,
        resultHash: job.resultHash,
        funded: job.funded,
        released: job.released
      });
    } catch (err) {
      // decoding failed or other RPC error — fallthrough to fallback mechanism
      console.warn('contract.getJob failed, falling back to persisted state or DB. err=', err.toString());
    }

    // 2) Fallback - check persisted in-memory map
    if (onchainState[jobIdHex]) {
      return res.json(onchainState[jobIdHex]);
    }

    // 3) Fallback - try reading backend DB open jobs and map to jobIdHex via sha256(jobId)
    // Note: backend provides /jobs/open (list), so we can try to match.
    try {
      const backendJobs = await (await fetch('http://localhost:4000/jobs/open')).json();
      // backendJobs is array of job objects with id (uuid)
      for (const j of backendJobs) {
        const crypto = require('crypto');
        const hash = '0x' + crypto.createHash('sha256').update(j.id).digest('hex');
        if (hash.toLowerCase() === jobIdHex.toLowerCase()) {
          // map DB job fields to on-chain-like object
          return res.json({
            client: j.client_addr || null,
            worker: j.worker_addr || null,
            reward: String(j.reward || 0),
            resultHash: j.result_hash || null,
            funded: false, // unknown for sure, assume not funded unless we have persisted state
            released: false
          });
        }
      }
    } catch (dbErr) {
      console.warn('fallback DB read failed:', dbErr.toString());
    }

    // nothing known
    return res.json({ client: null, worker: null, reward: null, resultHash: null, funded: false, released: false });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: e.toString() });
  }
});

/* -----------------------
   Fund / Claim / Submit / Release endpoints
   - After successful tx, update persisted onchainState and persist to disk
   ----------------------- */

app.post('/fundJob', async (req, res) => {
  const { jobIdHex, amountWei } = req.body;
  try {
    if (!wallet) return res.status(500).json({ error: "server wallet not configured" });
    const contract = await loadContract(wallet);

    // use native BigInt to convert wei
    const value = BigInt(amountWei);

    // send tx calling fundJob(jobId) with value
    const tx = await wallet.sendTransaction({
      to: CONTRACT_ADDRESS,
      data: contract.interface.encodeFunctionData("fundJob", [jobIdHex]),
      value: value
    });
    const receipt = await tx.wait();

    // update persisted state
    ensureState(jobIdHex);
    onchainState[jobIdHex].client = await wallet.getAddress();
    onchainState[jobIdHex].funded = true;
    onchainState[jobIdHex].lastTxs.push({ action: 'fund', txHash: receipt.transactionHash });
    persistState();

    return res.json({ txHash: receipt.transactionHash, receipt, funder: await wallet.getAddress() });
  } catch (e) {
    console.error('fundJob error:', e.toString());
    return res.status(500).json({ error: e.toString() });
  }
});

app.post('/claimJob', async (req, res) => {
  try {
    if (!wallet) return res.status(500).json({ error: "server wallet not configured" });
    const { jobIdHex } = req.body;
    const contract = await loadContract(wallet);
    const tx = await contract.claimJob(jobIdHex);
    const receipt = await tx.wait();

    ensureState(jobIdHex);
    onchainState[jobIdHex].worker = await wallet.getAddress();
    onchainState[jobIdHex].lastTxs.push({ action: 'claim', txHash: receipt.transactionHash });
    persistState();

    return res.json({ txHash: receipt.transactionHash, receipt, actor: await wallet.getAddress() });
  } catch (e) {
    console.error('claimJob error:', e.toString());
    return res.status(500).json({ error: e.toString() });
  }
});

app.post('/submitResult', async (req, res) => {
  try {
    if (!wallet) return res.status(500).json({ error: "server wallet not configured" });
    const { jobIdHex, resultHashHex } = req.body;
    const contract = await loadContract(wallet);
    const tx = await contract.submitResult(jobIdHex, resultHashHex);
    const receipt = await tx.wait();

    ensureState(jobIdHex);
    onchainState[jobIdHex].resultHash = resultHashHex;
    onchainState[jobIdHex].lastTxs.push({ action: 'submitResult', txHash: receipt.transactionHash });
    persistState();

    return res.json({ txHash: receipt.transactionHash, receipt, actor: await wallet.getAddress() });
  } catch (e) {
    console.error('submitResult error:', e.toString());
    return res.status(500).json({ error: e.toString() });
  }
});

app.post('/releasePayment', async (req, res) => {
  try {
    if (!wallet) return res.status(500).json({ error: "server wallet not configured" });
    const { jobIdHex } = req.body;
    const contract = await loadContract(wallet);
    const tx = await contract.releasePayment(jobIdHex);
    const receipt = await tx.wait();

    ensureState(jobIdHex);
    onchainState[jobIdHex].released = true;
    onchainState[jobIdHex].lastTxs.push({ action: 'release', txHash: receipt.transactionHash });
    persistState();

    return res.json({ txHash: receipt.transactionHash, receipt, actor: await wallet.getAddress() });
  } catch (e) {
    console.error('releasePayment error:', e.toString());
    return res.status(500).json({ error: e.toString() });
  }
});

/* -----------------------
   Start server
   ----------------------- */
const port = process.env.PORT || 4001;
app.listen(port, ()=> console.log(`chain-service listening ${port}`));
