defmodule BackendElixir.Dispatcher do
  use GenServer
  alias BackendElixir.{JobStore, WorkerSupervisor, PaymentCoordinator}

  def start_link(_) do
    GenServer.start_link(__MODULE__, %{}, name: __MODULE__)
  end

  def init(state), do: {:ok, state}

  def handle_cast({:dispatch, job_id}, state) do
    job = JobStore.get_job(job_id)
    case PaymentCoordinator.is_funded?(job_id) do
      true ->
        WorkerSupervisor.start_worker(job_id)
        {:noreply, state}
      false ->
        Process.send_after(self(), {:dispatch, job_id}, 5_000)
        {:noreply, state}
    end
  end

  def handle_info({:dispatch, job_id}, state), do: handle_cast({:dispatch, job_id}, state)
end
