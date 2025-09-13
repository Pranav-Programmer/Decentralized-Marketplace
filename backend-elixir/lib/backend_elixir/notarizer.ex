defmodule BackendElixir.Notarizer do
  @chain_service_url Application.get_env(:backend_elixir, :chain_service_url, "http://localhost:4001")
  def notarize_result(job_id, result_hash_hex) do
    job = BackendElixir.JobStore.get_job(job_id)
    job_id_hex = "0x" <> Base.encode16(:crypto.hash(:sha256, to_string(job_id)), case: :lower)
    result_hash_hex = if String.starts_with?(result_hash_hex, "0x"), do: result_hash_hex, else: "0x" <> result_hash_hex

    body = %{jobIdHex: job_id_hex, resultHashHex: result_hash_hex}
    url = "#{@chain_service_url}/submitResult"
    {:ok, resp} = HTTPoison.post(url, Jason.encode!(body), [{"Content-Type","application/json"}])
    tx = Jason.decode!(resp.body)
    BackendElixir.JobStore.mark_completed(job_id, result_hash_hex, %{"commit_tx" => tx})
    tx
  end
end
