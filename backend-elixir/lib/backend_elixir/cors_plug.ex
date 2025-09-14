# backend-elixir/lib/backend_elixir/cors_plug.ex
defmodule BackendElixir.CORSPlug do
  @moduledoc """
  Robust dev CORS plug:
  - Answers OPTIONS preflight (204)
  - Ensures Access-Control-Allow-Origin header is present on every response (via register_before_send)
  """

  import Plug.Conn

  @allowed_origin "http://localhost:3000"

  def init(opts), do: opts

  def call(%Plug.Conn{method: "OPTIONS"} = conn, _opts) do
    conn
    |> put_resp_header("access-control-allow-origin", @allowed_origin)
    |> put_resp_header("access-control-allow-methods", "GET,POST,PUT,DELETE,OPTIONS")
    |> put_resp_header("access-control-allow-headers", "content-type,authorization")
    |> put_resp_header("access-control-max-age", "1728000")
    |> send_resp(204, "")
  end

  def call(conn, _opts) do
    # ensure headers are present on eventual response
    register_before_send(conn, fn conn ->
      conn
      |> put_resp_header("access-control-allow-origin", @allowed_origin)
      |> put_resp_header("access-control-allow-methods", "GET,POST,PUT,DELETE,OPTIONS")
      |> put_resp_header("access-control-allow-headers", "content-type,authorization")
    end)
  end
end
