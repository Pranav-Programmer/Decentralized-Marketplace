defmodule BackendElixir.Repo.Migrations.CreateJobs do
  use Ecto.Migration
  def change do
    create table(:jobs, primary_key: false) do
      add :id, :uuid, primary_key: true, default: fragment("gen_random_uuid()")
      add :client_addr, :string
      add :worker_addr, :string
      add :reward, :bigint
      add :payload_ref, :string
      add :status, :string
      add :result_hash, :string
      add :onchain_txns, :map
      timestamps()
    end
  end
end
