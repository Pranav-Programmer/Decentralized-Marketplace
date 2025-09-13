import Config

config :backend_elixir, BackendElixir.Repo,
  database: "marketplace_dev",
  username: "postgres",
  password: "postgres",
  hostname: "localhost"

config :backend_elixir, ecto_repos: [BackendElixir.Repo]

config :backend_elixir, :chain_service_url, "http://localhost:4001"
