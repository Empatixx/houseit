#!/usr/bin/env bash
# Opens the editor in a Chrome the MCP server can attach to.
#
# The bridge reaches the page over CDP, which needs a debugging port. A separate
# user-data-dir is used so this never touches your everyday Chrome profile.
set -euo pipefail

PORT="${HOUSEIT_CDP_PORT:-9222}"
URL="${1:-http://localhost:5173}"
PROFILE="${HOUSEIT_CHROME_PROFILE:-${TMPDIR:-/tmp}/houseit-chrome}"

case "$(uname -s)" in
  Darwin) CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" ;;
  *)      CHROME="$(command -v google-chrome || command -v chromium)" ;;
esac

exec "$CHROME" \
  --remote-debugging-port="$PORT" \
  "--remote-allow-origins=*" \
  --user-data-dir="$PROFILE" \
  --no-first-run \
  --no-default-browser-check \
  "$URL"
