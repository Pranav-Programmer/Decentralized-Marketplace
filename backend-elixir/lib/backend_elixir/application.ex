defmodule BackendElixir.Application do
  use Application

  def start(_type, _args) do
    children = [
      BackendElixir.Repo,
      {Registry, keys: :unique, name: BackendElixir.WorkerRegistry},
      BackendElixir.JobStore,
      BackendElixir.WorkerSupervisor,
      BackendElixir.Dispatcher,
      {Plug.Cowboy, scheme: :http, plug: BackendElixir.Router, options: [port: 4000]}
    ]

    opts = [strategy: :one_for_one, name: BackendElixir.Supervisor]
    Supervisor.start_link(children, opts)
  end
end
