defmodule BackendElixir.JobStore do
  use GenServer
  alias BackendElixir.{Repo, Job}
  import Ecto.Query

  def start_link(_) do
    GenServer.start_link(__MODULE__, %{}, name: __MODULE__)
  end
  def init(state) do
    :ets.new(:jobs_cache, [:named_table, :public, :set])
    {:ok, state}
  end

  def create_job(attrs) do
    %Job{}
    |> Job.changeset(attrs)
    |> Repo.insert()
  end

  def list_open_jobs do
    Repo.all(from j in Job, where: j.status == "open")
  end

  def get_job(id), do: Repo.get(Job, id)

  def mark_claimed(id, worker_addr, txns) do
    job = get_job(id)
    job
    |> Job.changeset(%{status: "claimed", worker_addr: worker_addr, onchain_txns: txns})
    |> Repo.update()
  end

  def mark_completed(id, result_hash, txns) do
    job = get_job(id)
    job
    |> Job.changeset(%{status: "completed", result_hash: result_hash, onchain_txns: txns})
    |> Repo.update()
  end

  def finalize(id, txns) do
    job = get_job(id)
    job
    |> Job.changeset(%{status: "finalized", onchain_txns: txns})
    |> Repo.update()
  end
end
