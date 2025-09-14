// frontend/public/app.js
// Uses window.ethers (UMD) loaded in index.html
const ethersLib = window.ethers;
if (!ethersLib) console.error("ethers not found on window — check index.html includes the UMD script");

async function loadAbi() {
  const res = await fetch('/SimpleEscrow.json');
  if (!res.ok) throw new Error('Failed to load ABI: ' + res.status);
  return await res.json(); // returns the ABI array
}

async function loadAddress() {
  try {
    const res = await fetch('/contract-address.json');
    if (!res.ok) throw new Error('No contract-address.json found');
    const j = await res.json();
    return j.address;
  } catch (err) {
    console.warn('contract-address.json not found, falling back to hard-coded address if provided');
    // fallback: return hard-coded address or null
    return "0x5FbDB2315678afecb367f032d93F642f64180aa3";
  }
}

async function connect() {
  if (!window.ethereum) return alert("Install MetaMask or enable an injected provider");

  // load ABI + address first
  const [abi, address] = await Promise.all([loadAbi(), loadAddress()]);

  // Ethers v6 BrowserProvider
  const provider = new ethersLib.BrowserProvider(window.ethereum);
  await window.ethereum.request({ method: 'eth_requestAccounts' });
  const signer = await provider.getSigner();
  const contract = new ethersLib.Contract(address, abi, signer);

  return { provider, signer, contract, ethers: ethersLib };
}

window.app = {
  async connectAndFund(){
    const { signer } = await connect();
    const clientAddr = await signer.getAddress();

    // create job on backend
    const resp = await fetch("http://localhost:4000/jobs", {
      method: "POST", headers: {"Content-Type":"application/json"},
      body: JSON.stringify({client_addr: clientAddr, reward: 10000000000000000, payload_ref: "payload://1"})
    });
    const data = await resp.json();
    const jobId = data.job_id;
    alert("Job created: " + jobId + ". Now fund via MetaMask or the chain-service.");

    // Compute jobIdHex client-side (keccak256)
    const jobIdHex = ethersLib.id(jobId);
    console.log("jobIdHex", jobIdHex);
  }
};

document.getElementById('root').innerHTML = `
  <h2>Decentralized Job Marketplace — MVP</h2>
  <button id="connect">Create & Fund Job</button>
  <p>Ensure chain-service and backend are running.</p>
`;
document.getElementById('connect').onclick = ()=> window.app.connectAndFund();
