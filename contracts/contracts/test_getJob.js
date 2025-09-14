// contracts/test_getJob.js
const fs = require('fs');
const { JsonRpcProvider, Contract } = require('ethers');

(async ()=>{
  try {
    const provider = new JsonRpcProvider('http://127.0.0.1:8545');
    const artifactPath = 'artifacts/contracts/SimpleEscrow.sol/SimpleEscrow.json';
    if (!fs.existsSync(artifactPath)) {
      console.error('artifact not found at', artifactPath);
      process.exit(1);
    }
    const artifact = JSON.parse(fs.readFileSync(artifactPath,'utf8'));
    const abi = artifact.abi;
    const contractAddress = process.argv[2] || '<PASTE_CONTRACT_ADDRESS>';
    console.log('Using contract address:', contractAddress);
    const code = await provider.getCode(contractAddress);
    console.log('getCode:', code.slice(0,100), '...');

    const c = new Contract(contractAddress, abi, provider);
    const jobId = process.argv[3] || '0x' + require('crypto').createHash('sha256').update('replace-with-your-job-uuid').digest('hex');
    console.log('Calling getJob with jobId:', jobId);

    const job = await c.getJob(jobId);
    console.log('getJob ->', job);
  } catch (e) {
    console.error('ERROR:', e.toString());
    if (e.stack) console.error(e.stack);
  }
})();
