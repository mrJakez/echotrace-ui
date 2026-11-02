#!/bin/sh
set -u

/opt/echotrace-mcp/bin/uvicorn mcp_service.server:app --host 127.0.0.1 --port 8090 &
mcp_pid=$!

# Docker injects HOSTNAME with the container ID. Next.js standalone uses that
# value as its bind address, which makes it unreachable through 127.0.0.1 from
# the co-located MCP process. Bind the application to every container interface.
env HOSTNAME=0.0.0.0 PORT="${PORT:-3000}" "$@" &
app_pid=$!

shutdown() {
  kill -TERM "$app_pid" "$mcp_pid" 2>/dev/null || true
  wait "$app_pid" 2>/dev/null || true
  wait "$mcp_pid" 2>/dev/null || true
}

trap shutdown TERM INT

while kill -0 "$app_pid" 2>/dev/null && kill -0 "$mcp_pid" 2>/dev/null; do
  sleep 1
done

status=0
if ! kill -0 "$app_pid" 2>/dev/null; then
  wait "$app_pid" || status=$?
else
  wait "$mcp_pid" || status=$?
fi

shutdown
exit "$status"
