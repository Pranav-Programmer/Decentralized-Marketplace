defmodule BackendElixir.Worker do
  use GenServer
  alias BackendElixir.{JobStore, Notarizer}

  def start_link(job_id), do: GenServer.start_link(__MODULE__, job_id, name: via_tuple(job_id))
  defp via_tuple(job_id), do: {:via, Registry, {BackendElixir.WorkerRegistry, job_id}}

  def init(job_id) do
    send(self(), :run)
    {:ok, job_id}
  end

  def handle_info(:run, job_id) do
    job = JobStore.get_job(job_id)
    result = "result_of_#{job.id}_#{:os.system_time(:millisecond)}"
    hash = :crypto.hash(:sha256, result) |> Base.encode16(case: :lower)
    Notarizer.notarize_result(job_id, hash)
    {:stop, :normal, job_id}
  end
end
