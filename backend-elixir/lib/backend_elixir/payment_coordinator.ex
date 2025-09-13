defmodule BackendElixir.PaymentCoordinator do
  @chain_service_url Application.get_env(:backend_elixir, :chain_service_url, "http://localhost:4001")

  def is_funded?(_job_id), do: true

  def fund_job(job_id, amount_wei) do
    job = BackendElixir.JobStore.get_job(job_id)
    body = %{jobIdHex: to_job_hex(job.id), amountWei: Integer.to_string(amount_wei)}
    HTTPoison.post("#{@chain_service_url}/fundJob", Jason.encode!(body), [{"Content-Type","application/json"}])
  end

  defp to_job_hex(id) do
    "0x" <> Base.encode16(:crypto.hash(:sha256, to_string(id)), case: :lower)
  end
end
