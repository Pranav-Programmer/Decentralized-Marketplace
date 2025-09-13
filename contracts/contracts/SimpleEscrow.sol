 // SPDX-License-Identifier: MIT
 pragma solidity ^0.8.19;

 contract SimpleEscrow {
     struct Job {
         address client;
         address worker;
         uint256 reward;
         bytes32 resultHash;
         bool funded;
         bool released;
     }

     mapping(bytes32 => Job) public jobs;

     event JobFunded(bytes32 indexed jobId, address indexed client, uint256 reward);
     event JobClaimed(bytes32 indexed jobId, address indexed worker);
     event ResultSubmitted(bytes32 indexed jobId, bytes32 resultHash);
     event PaymentReleased(bytes32 indexed jobId, address indexed to);
     event ChallengeRaised(bytes32 indexed jobId, address by);

     function fundJob(bytes32 jobId) external payable {
         require(!jobs[jobId].funded, "already funded");
         jobs[jobId] = Job(msg.sender, address(0), msg.value, 0x0, true, false);
         emit JobFunded(jobId, msg.sender, msg.value);
     }

     function claimJob(bytes32 jobId) external {
         require(jobs[jobId].funded, "not funded");
         require(jobs[jobId].worker == address(0), "already claimed");
         jobs[jobId].worker = msg.sender;
         emit JobClaimed(jobId, msg.sender);
     }

     function submitResult(bytes32 jobId, bytes32 resultHash) external {
         require(msg.sender == jobs[jobId].worker, "not worker");
         jobs[jobId].resultHash = resultHash;
         emit ResultSubmitted(jobId, resultHash);
     }

     function releasePayment(bytes32 jobId) external {
         require(msg.sender == jobs[jobId].client, "only client");
         require(!jobs[jobId].released, "released");
         jobs[jobId].released = true;
         uint256 amount = jobs[jobId].reward;
         address to = jobs[jobId].worker;
         payable(to).transfer(amount);
         emit PaymentReleased(jobId, to);
     }

     function challenge(bytes32 jobId) external {
         require(msg.sender == jobs[jobId].client, "only client");
         emit ChallengeRaised(jobId, msg.sender);
     }

     function getJob(bytes32 jobId) external view returns (Job memory) {
         return jobs[jobId];
     }
 }
