import Config

config :backend_elixir, BackendElixir.Repo,
  database: "marketplace_dev",
  username: "Admin",
  password: "Pranav@2001",
  hostname: "localhost"

config :backend_elixir, ecto_repos: [BackendElixir.Repo]

config :backend_elixir, :chain_service_url, "http://localhost:4001"
