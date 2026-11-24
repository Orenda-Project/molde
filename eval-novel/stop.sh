#!/bin/bash
# stops ONLY the llama-server this harness started (PID file), never anything else
P=$(cat /tmp/molde-eval-llama.pid 2>/dev/null) && [ -n "$P" ] && ps -p $P -o args= | grep -q "port ${PORT:-8241}" && kill $P && echo "stopped $P"
rm -f /tmp/molde-eval-llama.pid
