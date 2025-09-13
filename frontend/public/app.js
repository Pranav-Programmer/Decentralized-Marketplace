// frontend/public/app.js

// Use the global `ethers` provided by the UMD script we included in index.html
const ethersLib = window.ethers;

if (!ethersLib) {
  console.error("ethers not found on window — check that the UMD script was loaded");
}

// Paste your contract address and ABI (or update later)
const CONTRACT_ADDRESS = "<PUT_CONTRACT_ADDRESS_HERE>";
const CONTRACT_ABI = []; // paste the ABI JSON array here (from Hardhat artifacts)

// helper connect function
async function connect() {
  if (!window.ethereum) return alert("Install MetaMask or enable an injected provider");
  // Ethers v6: BrowserProvider wraps window.ethereum
  const provider = new ethersLib.BrowserProvider(window.ethereum);
  await window.ethereum.request({ method: 'eth_requestAccounts' });
  const signer = await provider.getSigner();
  const contract = new ethersLib.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);
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
    // Compute jobIdHex client-side if you need to call contract from frontend
    // Use keccak256: ethers.utils.id(jobId) -> returns bytes32 hex
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
