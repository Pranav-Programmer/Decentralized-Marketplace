defmodule BackendElixir.Router do
  use Plug.Router

  # MUST be before :match so preflight is handled and headers are registered
  plug BackendElixir.CORSPlug

  plug :match
  plug Plug.Parsers, parsers: [:json], json_decoder: Jason
  plug :dispatch

  options _ do
    send_resp(conn, 204, "")
  end

  post "/jobs" do
    %{"client_addr" => client_addr, "reward" => reward, "payload_ref" => payload_ref} = conn.body_params
    {:ok, job} = BackendElixir.JobStore.create_job(%{client_addr: client_addr, reward: reward, payload_ref: payload_ref})
    send_resp(conn, 201, Jason.encode!(%{job_id: job.id}))
  end

  get "/jobs/open" do
  # show active jobs (open, claimed, completed) — exclude only released/finalized
  jobs = BackendElixir.JobStore.list_active_jobs()
  send_resp(conn, 200, Jason.encode!(jobs))
end


  post "/jobs/:id/claim" do
    id = conn.params["id"]
    BackendElixir.JobStore.mark_claimed(id, "0xworkeraddr", %{})
    send_resp(conn, 200, Jason.encode!(%{status: "claimed"}))
  end

  # NEW: dispatch endpoint — triggers the Dispatcher to attempt to spawn a worker
  post "/jobs/:id/dispatch" do
    id = conn.params["id"]
    # cast to dispatcher; dispatcher will check PaymentCoordinator.is_funded? and spawn worker
    GenServer.cast(BackendElixir.Dispatcher, {:dispatch, id})
    send_resp(conn, 200, Jason.encode!(%{status: "dispatch_triggered", job_id: id}))
  end

  post "/jobs/:id/update_client" do
    id = conn.params["id"]
    %{"client_addr" => client_addr} = conn.body_params
    case BackendElixir.JobStore.update_client(id, client_addr) do
      {:ok, job} -> send_resp(conn, 200, Jason.encode!(%{status: "updated", job_id: job.id}))
      {:error, changeset} -> send_resp(conn, 500, Jason.encode!(%{error: "update_failed"}))
    end
  end


  match _ do
    send_resp(conn, 404, "not found")
  end
end
