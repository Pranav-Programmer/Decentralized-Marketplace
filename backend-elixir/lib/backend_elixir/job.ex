# backend-elixir/lib/backend_elixir/job.ex
defmodule BackendElixir.Job do
  use Ecto.Schema
  import Ecto.Changeset

  # Derive Jason.Encoder so we can `Jason.encode!(%Job{})` directly for JSON responses.
  # List only the fields we want to expose (omit __meta__).
  @derive {Jason.Encoder,
           only: [
             :id,
             :client_addr,
             :worker_addr,
             :reward,
             :payload_ref,
             :status,
             :result_hash,
             :onchain_txns,
             :inserted_at,
             :updated_at
           ]}
  @primary_key {:id, :binary_id, autogenerate: true}
  schema "jobs" do
    field :client_addr, :string
    field :worker_addr, :string
    field :reward, :integer
    field :payload_ref, :string
    field :status, :string, default: "open"
    field :result_hash, :string
    field :onchain_txns, :map
    timestamps()
  end

  def changeset(job, attrs) do
    job
    |> cast(attrs, [:client_addr, :worker_addr, :reward, :payload_ref, :status, :result_hash, :onchain_txns])
    |> validate_required([:client_addr, :reward, :payload_ref])
  end
end
