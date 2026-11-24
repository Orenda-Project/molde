#!/bin/bash
# stops ONLY the llama-server this harness started (PID file), never anything else; waits until it has exited
P=$(cat /tmp/molde-eval-llama.pid 2>/dev/null)
if [ -n "$P" ] && ps -p $P -o args= | grep -q "port ${PORT:-8241}"; then
  kill $P; for i in $(seq 20); do kill -0 $P 2>/dev/null || break; sleep 0.5; done
  kill -0 $P 2>/dev/null && kill -9 $P; echo "stopped $P"
fi
rm -f /tmp/molde-eval-llama.pid
