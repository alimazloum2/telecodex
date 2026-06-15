#!/bin/bash
set -euo pipefail
export HOME="/Users/metigerinc"
export VOLTA_HOME="/Users/metigerinc/.volta"
export PATH="$VOLTA_HOME/bin:/opt/homebrew/bin:/opt/homebrew/sbin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin"
cd /Users/metigerinc/telecodex
exec /Users/metigerinc/.volta/bin/node dist/index.js
