#!/usr/bin/env bash
set -euo pipefail

API_URL="${API_URL:-http://localhost:3000}"
TOKEN_DIR="${TOKEN_DIR:-.auth}"
TOKEN_FILE="${TOKEN_FILE:-$TOKEN_DIR/tokens.json}"

ensure_token_storage() {
  mkdir -p "$TOKEN_DIR"
  chmod 700 "$TOKEN_DIR"
}

save_tokens() {
  local payload="$1"
  ensure_token_storage
  printf '%s\n' "$payload" > "$TOKEN_FILE"
  chmod 600 "$TOKEN_FILE"
}

read_saved_token() {
  local token_name="$1"

  if [[ ! -f "$TOKEN_FILE" ]]; then
    echo "No saved tokens found. Run: npm run ops -- login <email> <password>" >&2
    exit 1
  fi

  node -e '
    const fs = require("fs");
    const tokenName = process.argv[1];
    const file = process.argv[2];
    const data = JSON.parse(fs.readFileSync(file, "utf8"));
    const value = data[tokenName];
    if (!value) {
      process.exit(1);
    }
    process.stdout.write(value);
  ' "$token_name" "$TOKEN_FILE" || {
    echo "Saved token file is missing '$token_name'. Log in again." >&2
    exit 1
  }
}

print_json() {
  local payload="$1"
  printf '%s\n' "$payload" | node -e '
    let input = "";
    process.stdin.on("data", (chunk) => {
      input += chunk;
    });
    process.stdin.on("end", () => {
      try {
        const parsed = JSON.parse(input);
        process.stdout.write(`${JSON.stringify(parsed, null, 2)}\n`);
      } catch {
        process.stdout.write(input);
      }
    });
  '
}

post_json() {
  local endpoint="$1"
  local payload="$2"
  local body
  local status
  body="$(mktemp)"
  status="$(curl -sS -o "$body" -w "%{http_code}" -X POST "$API_URL/$endpoint" \
    -H "Content-Type: application/json" \
    -d "$payload")"
  printf '%s\n' "$status"
  cat "$body"
  rm -f "$body"
}

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
      Login operator, print tokens, and save them to local secure storage.

  refresh [refreshToken]
      Rotate refresh token and save the replacement automatically.
      If omitted, the saved refresh token is used.

  token <access|refresh>
      Print the currently saved token value.

  auth-header
      Print the Authorization header using the saved access token.

  set-operator <email> <password> [role]
      Create or update an operator in auth storage.
      Requirements: valid email, password >= 8 chars, role in [admin, operator].
      Uses AUTH_STORAGE backend (postgres by default).

Examples:
  npm run ops -- health
  npm run ops -- set-operator admin@example.com StrongPass123 admin
  npm run ops -- login admin@example.com StrongPass123
  npm run ops -- refresh
  npm run ops -- token access
  npm run ops -- auth-header
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

    mapfile -t response < <(post_json "auth/login" "{\"email\":\"$email\",\"password\":\"$password\"}")
    status="${response[0]}"
    body="$(printf '%s\n' "${response[@]:1}")"

    if [[ "$status" == "200" ]]; then
      save_tokens "$body"
      echo "HTTP $status"
      print_json "$body"
      echo "Saved tokens to $TOKEN_FILE"
    else
      echo "HTTP $status" >&2
      print_json "$body" >&2
      exit 1
    fi
    ;;

  refresh)
    refresh_token="${2:-}"

    if [[ -z "$refresh_token" ]]; then
      refresh_token="$(read_saved_token "refreshToken")"
    fi

    mapfile -t response < <(post_json "auth/refresh" "{\"refreshToken\":\"$refresh_token\"}")
    status="${response[0]}"
    body="$(printf '%s\n' "${response[@]:1}")"

    if [[ "$status" == "200" ]]; then
      save_tokens "$body"
      echo "HTTP $status"
      print_json "$body"
      echo "Replaced saved tokens in $TOKEN_FILE"
    else
      echo "HTTP $status" >&2
      print_json "$body" >&2
      exit 1
    fi
    ;;

  token)
    token_kind="${2:-}"

    if [[ "$token_kind" != "access" && "$token_kind" != "refresh" ]]; then
      echo "Usage: npm run ops -- token <access|refresh>" >&2
      exit 1
    fi

    if [[ "$token_kind" == "access" ]]; then
      read_saved_token "accessToken"
      printf '\n'
    else
      read_saved_token "refreshToken"
      printf '\n'
    fi
    ;;

  auth-header)
    access_token="$(read_saved_token "accessToken")"
    printf 'Authorization: Bearer %s\n' "$access_token"
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
