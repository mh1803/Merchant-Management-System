#!/usr/bin/env bash
set -euo pipefail

API_URL="${API_URL:-http://localhost:3000}"

usage() {
  cat <<'USAGE'
Usage:
  npm run ops -- <command> [args]

Commands:
  help
      Show this help message.

  health
      Check API health endpoint.

  login <email> <password>
      Login operator and return access/refresh tokens.

  refresh <refreshToken>
      Rotate refresh token and return new tokens.

  set-operator <email> <password> [role]
      Create or update an operator in data/operators.json.
      Requirements: valid email, password >= 8 chars, role in [admin, operator].
      Restart the server after this command so changes are loaded.

Examples:
  npm run ops -- health
  npm run ops -- set-operator admin@example.com StrongPass123 admin
  npm run ops -- login admin@example.com StrongPass123
  npm run ops -- refresh <refreshToken>
USAGE
}

cmd="${1:-help}"

case "$cmd" in
  help|-h|--help)
    usage
    ;;

  health)
    curl -sS -i "$API_URL/health"
    ;;

  login)
    email="${2:-}"
    password="${3:-}"

    if [[ -z "$email" || -z "$password" ]]; then
      echo "Missing arguments. Usage: npm run ops -- login <email> <password>" >&2
      exit 1
    fi

    curl -sS -i -X POST "$API_URL/auth/login" \
      -H "Content-Type: application/json" \
      -d "{\"email\":\"$email\",\"password\":\"$password\"}"
    ;;

  refresh)
    refresh_token="${2:-}"

    if [[ -z "$refresh_token" ]]; then
      echo "Missing token. Usage: npm run ops -- refresh <refreshToken>" >&2
      exit 1
    fi

    curl -sS -i -X POST "$API_URL/auth/refresh" \
      -H "Content-Type: application/json" \
      -d "{\"refreshToken\":\"$refresh_token\"}"
    ;;

  set-operator)
    email="${2:-}"
    password="${3:-}"
    role="${4:-operator}"

    if [[ -z "$email" || -z "$password" ]]; then
      echo "Missing arguments. Usage: npm run ops -- set-operator <email> <password> [role]" >&2
      exit 1
    fi

    npm run operator:set -- --email "$email" --password "$password" --role "$role"
    ;;

  *)
    echo "Unknown command: $cmd" >&2
    usage
    exit 1
    ;;
esac
