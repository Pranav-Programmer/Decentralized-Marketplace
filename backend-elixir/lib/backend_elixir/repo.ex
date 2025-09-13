defmodule BackendElixir.Repo do
  use Ecto.Repo, otp_app: :backend_elixir, adapter: Ecto.Adapters.Postgres
end
