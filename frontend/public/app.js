import { ethers } from "https://cdn.jsdelivr.net/npm/ethers@6.6.0/dist/ethers.esm.min.js";

const CONTRACT_ADDRESS = "<PUT_CONTRACT_ADDRESS_HERE>";
const CONTRACT_ABI = []; // paste ABI from contracts/artifacts

async function connect() {
  if (!window.ethereum) return alert("Install MetaMask");
  const provider = new ethers.BrowserProvider(window.ethereum);
  await window.ethereum.request({ method: 'eth_requestAccounts' });
  const signer = await provider.getSigner();
  return { provider, signer };
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
    alert("Job created: " + jobId + ". Now fund via MetaMask.");
    // compute bytes32
    const jobIdHex = ethers.Hashed.keccak256(ethers.ParamType.from("string").format(jobId)).slice(0,66);
    // NOTE: the simplest approach in demo is to let user fund manually via UI - skipping direct contract call here.
    console.log("jobIdHex", jobIdHex);
  }
};

document.getElementById('root').innerHTML = `
  <h2>Decentralized Job Marketplace — MVP</h2>
  <button id="connect">Create & Fund Job</button>
  <p>Ensure chain-service and backend are running.</p>
`;
document.getElementById('connect').onclick = ()=> window.app.connectAndFund();
