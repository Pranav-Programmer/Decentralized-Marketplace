# Decentralized Job Marketplace — MVP (Runnable)

This repository is a compact end-to-end MVP combining:
- Smart contract (Hardhat) — `contracts/`
- Chain service (Node + ethers) — `chain-service/`
- Backend orchestration (Elixir) — `backend-elixir/`
- Frontend (React + ethers) — `frontend/`

This tarball contains **copy-paste ready** files. Follow the instructions below to run locally.

## Quick start (recommended order)

1. Install prerequisites:
   - Node.js 18+, npm
   - Elixir 1.15+, Erlang/OTP 25+
   - PostgreSQL (for backend)
   - MetaMask for frontend
   - `git` (optional)

2. Start Hardhat local node and deploy contract
```bash
cd contracts
npm install
npx hardhat node
# in a new terminal:
npx hardhat run scripts/deploy.js --network localhost
# copy deployed contract address printed in the terminal
```

3. Start chain-service
```bash
cd chain-service
npm install
cp .env.example .env
# edit .env: set PRIVATE_KEY (use one account from hardhat node), RPC_URL, CONTRACT_ADDRESS, CONTRACT_ABI_PATH
node server.js
```

4. Start Elixir backend (requires Postgres)
```bash
cd backend-elixir
mix deps.get
# ensure Postgres is running and create DB name marketplace_dev with user/password in config/config.exs
mix ecto.create
mix ecto.migrate
mix run --no-halt
```

5. Start frontend
```bash
cd frontend
npm install
# update src/config.js with CONTRACT_ADDRESS from deploy
npm start
# open http://localhost:3000
```

## Notes
- The `chain-service` exposes HTTP endpoints the Elixir backend calls to interact with the contract.
- Keep **jobId → bytes32** conversion consistent across frontend/backend/contract. The projects use `keccak256(jobUUID)` (ethers `utils.id`) as default.
- This bundle is a minimal viable codebase focused on developer ergonomics and easier local testing.

If you'd like, I can now:
- Fill in your contract address into the frontend & chain-service files,
- Generate a script to auto-run all components using `tmux` or Docker Compose.

