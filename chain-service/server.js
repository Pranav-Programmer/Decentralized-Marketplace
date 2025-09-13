require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const { ethers } = require('ethers');
const fs = require('fs-extra');

const app = express();
app.use(bodyParser.json());

const rpc = process.env.RPC_URL || "http://127.0.0.1:8545";
const provider = new ethers.JsonRpcProvider(rpc);
const wallet = new ethers.Wallet(process.env.PRIVATE_KEY || "", provider);

async function loadContract(){
  const abiPath = process.env.CONTRACT_ABI_PATH;
  if(!abiPath || !fs.existsSync(abiPath)){
    console.error("ABI path missing or not found:", abiPath);
    return null;
  }
  const json = await fs.readJson(abiPath);
  return new ethers.Contract(process.env.CONTRACT_ADDRESS, json.abi, wallet);
}

app.post('/fundJob', async (req, res) => {
  const { jobIdHex, amountWei } = req.body;
  try {
    const contract = await loadContract();
    if(!contract) return res.status(500).json({error:"contract not loaded"});
    const tx = await wallet.sendTransaction({
      to: process.env.CONTRACT_ADDRESS,
      data: contract.interface.encodeFunctionData("fundJob", [jobIdHex]),
      value: ethers.BigInt(amountWei)
    });
    const receipt = await tx.wait();
    res.json({ txHash: receipt.transactionHash, receipt });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.toString() });
  }
});

app.post('/claimJob', async (req,res)=>{
  const { jobIdHex } = req.body;
  try {
    const contract = await loadContract();
    const tx = await contract.claimJob(jobIdHex);
    const receipt = await tx.wait();
    res.json({ txHash: receipt.transactionHash, receipt });
  } catch(e){ console.error(e); res.status(500).json({error: e.toString()}); }
});

app.post('/submitResult', async (req,res)=>{
  const { jobIdHex, resultHashHex } = req.body;
  try {
    const contract = await loadContract();
    const tx = await contract.submitResult(jobIdHex, resultHashHex);
    const receipt = await tx.wait();
    res.json({ txHash: receipt.transactionHash, receipt });
  } catch(e){ console.error(e); res.status(500).json({error: e.toString()}); }
});

app.post('/releasePayment', async (req,res)=>{
  const { jobIdHex } = req.body;
  try {
    const contract = await loadContract();
    const tx = await contract.releasePayment(jobIdHex);
    const receipt = await tx.wait();
    res.json({ txHash: receipt.transactionHash, receipt });
  } catch(e){ console.error(e); res.status(500).json({error: e.toString()}); }
});

const port = process.env.PORT || 4001;
app.listen(port, ()=> console.log(`chain-service listening ${port}`));
