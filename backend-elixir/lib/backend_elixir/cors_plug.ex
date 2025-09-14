defmodule BackendElixir.CORSPlug do
  @moduledoc "Tiny dev-only CORS plug: handles OPTIONS preflight and adds headers."

  import Plug.Conn

  @allowed_origin "http://localhost:3000"

  def init(opts), do: opts

  # Handle preflight OPTIONS
  def call(%Plug.Conn{method: "OPTIONS"} = conn, _opts) do
    conn
    |> put_resp_header("access-control-allow-origin", @allowed_origin)
    |> put_resp_header("access-control-allow-methods", "GET,POST,PUT,DELETE,OPTIONS")
    |> put_resp_header("access-control-allow-headers", "content-type,authorization")
    |> put_resp_header("access-control-max-age", "1728000")
    |> send_resp(204, "")
  end

  # For normal requests, just add the Allow-Origin header (and others if desired)
  def call(conn, _opts) do
    conn
    |> put_resp_header("access-control-allow-origin", @allowed_origin)
    |> put_resp_header("access-control-allow-methods", "GET,POST,PUT,DELETE,OPTIONS")
    |> put_resp_header("access-control-allow-headers", "content-type,authorization")
  end
end
