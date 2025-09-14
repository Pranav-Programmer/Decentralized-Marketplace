defmodule BackendElixir.Router do
  use Plug.Router

  # Add the CORS plug here (must run before match/parsers)
  plug BackendElixir.CORSPlug

  plug :match
  plug Plug.Parsers, parsers: [:json], json_decoder: Jason
  plug :dispatch

  # ensure preflight handled (the plug already responds, but keep this for safety)
  options _ do
    send_resp(conn, 204, "")
  end

  post "/jobs" do
    %{"client_addr" => client_addr, "reward" => reward, "payload_ref" => payload_ref} = conn.body_params
    {:ok, job} = BackendElixir.JobStore.create_job(%{client_addr: client_addr, reward: reward, payload_ref: payload_ref})
    send_resp(conn, 201, Jason.encode!(%{job_id: job.id}))
  end

  get "/jobs/open" do
    jobs = BackendElixir.JobStore.list_open_jobs()
    send_resp(conn, 200, Jason.encode!(jobs))
  end

  post "/jobs/:id/claim" do
    id = conn.params["id"]
    BackendElixir.JobStore.mark_claimed(id, "0xworkeraddr", %{})
    send_resp(conn, 200, Jason.encode!(%{status: "claimed"}))
  end

  match _ do
    send_resp(conn, 404, "not found")
  end
end
