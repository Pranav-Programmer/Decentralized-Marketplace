defmodule BackendElixir.WorkerSupervisor do
  use DynamicSupervisor
  def start_link(_), do: DynamicSupervisor.start_link(__MODULE__, :ok, name: __MODULE__)
  def init(:ok), do: DynamicSupervisor.init(strategy: :one_for_one)
  def start_worker(job_id) do
    spec = {BackendElixir.Worker, job_id}
    DynamicSupervisor.start_child(__MODULE__, spec)
  end
end
