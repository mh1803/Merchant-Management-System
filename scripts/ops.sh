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

request_json() {
  local method="$1"
  local endpoint="$2"
  local payload="${3:-}"
  local auth_header="${4:-}"
  local body
  local status

  body="$(mktemp)"

  if [[ -n "$payload" ]]; then
    status="$(curl -sS -o "$body" -w "%{http_code}" -X "$method" "$API_URL/$endpoint" \
      -H "Content-Type: application/json" \
      ${auth_header:+-H "$auth_header"} \
      -d "$payload")"
  else
    status="$(curl -sS -o "$body" -w "%{http_code}" -X "$method" "$API_URL/$endpoint" \
      ${auth_header:+-H "$auth_header"})"
  fi

  printf '%s\n' "$status"
  cat "$body"
  rm -f "$body"
}

request_with_saved_access_token() {
  local method="$1"
  local endpoint="$2"
  local payload="${3:-}"
  local access_token

  access_token="$(read_saved_token "accessToken")"
  request_json "$method" "$endpoint" "$payload" "Authorization: Bearer $access_token"
}

print_response() {
  local status="$1"
  local body="$2"

  if [[ "$status" =~ ^2 ]]; then
    echo "HTTP $status"
    print_json "$body"
  else
    echo "HTTP $status" >&2
    print_json "$body" >&2
    exit 1
  fi
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

  merchant:create <name> <category> <city> <contactEmail>
      Create a merchant. You must be logged in.

  merchant:list [status] [city] [category] [q]
      List merchants with optional filters. You must be logged in.

  merchant:get <merchantId>
      Get a single merchant by id. You must be logged in.

  merchant:update <merchantId> [name] [category] [city] [contactEmail] [status]
      Update merchant fields. You must be logged in.
      Pass - to skip a field you do not want to change.
      Transition to Active requires all 3 KYB documents to be present and verified.

  merchant:delete <merchantId>
      Delete a merchant. You must be logged in as an admin.

  merchant:set-pricing-tier <merchantId> <standard|premium|enterprise>
      Change merchant pricing tier. You must be logged in as an admin.

  merchant:history <merchantId>
      View immutable merchant status and pricing-tier history. You must be logged in.

  kyb:add-doc <merchantId> <type> <fileName>
      Record or replace a merchant KYB document. You must be logged in.

  kyb:list-docs <merchantId>
      List merchant KYB documents. You must be logged in.

  kyb:get-doc <merchantId> <type>
      Get one merchant KYB document by type. You must be logged in.

  kyb:verify-doc <merchantId> <type> <true|false>
      Mark a merchant KYB document verified or unverified. You must be logged in.

  webhook:subscribe <url> <secret>
      Register or update a webhook subscription. You must be logged in.

  set-operator <email> <password> [role]
      Create or update an operator in auth storage.
      Requirements: valid email, password >= 8 chars, role in [admin, operator].
      Uses AUTH_STORAGE backend (postgres by default).
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
      print_response "$status" "$body"
      echo "Saved tokens to $TOKEN_FILE"
    else
      print_response "$status" "$body"
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
      print_response "$status" "$body"
      echo "Replaced saved tokens in $TOKEN_FILE"
    else
      print_response "$status" "$body"
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

  merchant:create)
    name="${2:-}"
    category="${3:-}"
    city="${4:-}"
    contact_email="${5:-}"

    if [[ -z "$name" || -z "$category" || -z "$city" || -z "$contact_email" ]]; then
      echo "Usage: npm run ops -- merchant:create <name> <category> <city> <contactEmail>" >&2
      exit 1
    fi

    payload="$(node -e '
      const [name, category, city, contactEmail] = process.argv.slice(1);
      process.stdout.write(JSON.stringify({ name, category, city, contactEmail }));
    ' "$name" "$category" "$city" "$contact_email")"

    mapfile -t response < <(request_with_saved_access_token "POST" "merchants" "$payload")
    status="${response[0]}"
    body="$(printf '%s\n' "${response[@]:1}")"
    print_response "$status" "$body"
    ;;

  merchant:list)
    status_filter="${2:-}"
    city_filter="${3:-}"
    category_filter="${4:-}"
    query_filter="${5:-}"

    endpoint="$(
      node -e '
        const params = new URLSearchParams();
        const [status, city, category, q] = process.argv.slice(1);
        if (status) params.set("status", status);
        if (city) params.set("city", city);
        if (category) params.set("category", category);
        if (q) params.set("q", q);
        const query = params.toString();
        process.stdout.write(query ? `merchants?${query}` : "merchants");
      ' "$status_filter" "$city_filter" "$category_filter" "$query_filter"
    )"

    mapfile -t response < <(request_with_saved_access_token "GET" "$endpoint")
    status="${response[0]}"
    body="$(printf '%s\n' "${response[@]:1}")"
    print_response "$status" "$body"
    ;;

  merchant:get)
    merchant_id="${2:-}"

    if [[ -z "$merchant_id" ]]; then
      echo "Usage: npm run ops -- merchant:get <merchantId>" >&2
      exit 1
    fi

    mapfile -t response < <(request_with_saved_access_token "GET" "merchants/$merchant_id")
    status="${response[0]}"
    body="$(printf '%s\n' "${response[@]:1}")"
    print_response "$status" "$body"
    ;;

  merchant:update)
    merchant_id="${2:-}"
    name="${3:-}"
    category="${4:-}"
    city="${5:-}"
    contact_email="${6:-}"
    status_value="${7:-}"

    if [[ -z "$merchant_id" ]]; then
      echo "Usage: npm run ops -- merchant:update <merchantId> [name] [category] [city] [contactEmail] [status]" >&2
      echo "Use - to skip fields you do not want to change." >&2
      exit 1
    fi

    payload="$(node -e '
      const [name, category, city, contactEmail, status] = process.argv.slice(1);
      const payload = {};
      if (name && name !== "-") payload.name = name;
      if (category && category !== "-") payload.category = category;
      if (city && city !== "-") payload.city = city;
      if (contactEmail && contactEmail !== "-") payload.contactEmail = contactEmail;
      if (status && status !== "-") payload.status = status;
      process.stdout.write(JSON.stringify(payload));
    ' "$name" "$category" "$city" "$contact_email" "$status_value")"

    if [[ "$payload" == "{}" ]]; then
      echo "No update fields provided. Use - to skip individual fields, but provide at least one real change." >&2
      exit 1
    fi

    mapfile -t response < <(request_with_saved_access_token "PATCH" "merchants/$merchant_id" "$payload")
    status="${response[0]}"
    body="$(printf '%s\n' "${response[@]:1}")"
    print_response "$status" "$body"
    ;;

  merchant:history)
    merchant_id="${2:-}"

    if [[ -z "$merchant_id" ]]; then
      echo "Usage: npm run ops -- merchant:history <merchantId>" >&2
      exit 1
    fi

    mapfile -t response < <(request_with_saved_access_token "GET" "merchants/$merchant_id/history")
    status="${response[0]}"
    body="$(printf '%s\n' "${response[@]:1}")"
    print_response "$status" "$body"
    ;;

  merchant:delete)
    merchant_id="${2:-}"

    if [[ -z "$merchant_id" ]]; then
      echo "Usage: npm run ops -- merchant:delete <merchantId>" >&2
      exit 1
    fi

    mapfile -t response < <(request_with_saved_access_token "DELETE" "merchants/$merchant_id")
    status="${response[0]}"
    body="$(printf '%s\n' "${response[@]:1}")"
    print_response "$status" "$body"
    ;;

  merchant:set-pricing-tier)
    merchant_id="${2:-}"
    pricing_tier="${3:-}"

    if [[ -z "$merchant_id" || -z "$pricing_tier" ]]; then
      echo "Usage: npm run ops -- merchant:set-pricing-tier <merchantId> <standard|premium|enterprise>" >&2
      exit 1
    fi

    payload="$(node -e '
      const [pricingTier] = process.argv.slice(1);
      process.stdout.write(JSON.stringify({ pricingTier }));
    ' "$pricing_tier")"

    mapfile -t response < <(request_with_saved_access_token "PATCH" "merchants/$merchant_id/pricing-tier" "$payload")
    status="${response[0]}"
    body="$(printf '%s\n' "${response[@]:1}")"
    print_response "$status" "$body"
    ;;

  kyb:add-doc)
    merchant_id="${2:-}"
    document_type="${3:-}"
    file_name="${4:-}"

    if [[ -z "$merchant_id" || -z "$document_type" || -z "$file_name" ]]; then
      echo "Usage: npm run ops -- kyb:add-doc <merchantId> <type> <fileName>" >&2
      exit 1
    fi

    payload="$(node -e '
      const [type, fileName] = process.argv.slice(1);
      process.stdout.write(JSON.stringify({ type, fileName }));
    ' "$document_type" "$file_name")"

    mapfile -t response < <(request_with_saved_access_token "POST" "merchants/$merchant_id/documents" "$payload")
    status="${response[0]}"
    body="$(printf '%s\n' "${response[@]:1}")"
    print_response "$status" "$body"
    ;;

  kyb:list-docs)
    merchant_id="${2:-}"

    if [[ -z "$merchant_id" ]]; then
      echo "Usage: npm run ops -- kyb:list-docs <merchantId>" >&2
      exit 1
    fi

    mapfile -t response < <(request_with_saved_access_token "GET" "merchants/$merchant_id/documents")
    status="${response[0]}"
    body="$(printf '%s\n' "${response[@]:1}")"
    print_response "$status" "$body"
    ;;

  kyb:get-doc)
    merchant_id="${2:-}"
    document_type="${3:-}"

    if [[ -z "$merchant_id" || -z "$document_type" ]]; then
      echo "Usage: npm run ops -- kyb:get-doc <merchantId> <type>" >&2
      exit 1
    fi

    mapfile -t response < <(request_with_saved_access_token "GET" "merchants/$merchant_id/documents/$document_type")
    status="${response[0]}"
    body="$(printf '%s\n' "${response[@]:1}")"
    print_response "$status" "$body"
    ;;

  kyb:verify-doc)
    merchant_id="${2:-}"
    document_type="${3:-}"
    verified_value="${4:-}"

    if [[ -z "$merchant_id" || -z "$document_type" || -z "$verified_value" ]]; then
      echo "Usage: npm run ops -- kyb:verify-doc <merchantId> <type> <true|false>" >&2
      exit 1
    fi

    payload="$(node -e '
      const [verified] = process.argv.slice(1);
      process.stdout.write(JSON.stringify({ verified: verified === "true" }));
    ' "$verified_value")"

    mapfile -t response < <(request_with_saved_access_token "PATCH" "merchants/$merchant_id/documents/$document_type/verify" "$payload")
    status="${response[0]}"
    body="$(printf '%s\n' "${response[@]:1}")"
    print_response "$status" "$body"
    ;;

  webhook:subscribe)
    webhook_url="${2:-}"
    webhook_secret="${3:-}"

    if [[ -z "$webhook_url" || -z "$webhook_secret" ]]; then
      echo "Usage: npm run ops -- webhook:subscribe <url> <secret>" >&2
      exit 1
    fi

    payload="$(node -e '
      const [url, secret] = process.argv.slice(1);
      process.stdout.write(JSON.stringify({ url, secret }));
    ' "$webhook_url" "$webhook_secret")"

    mapfile -t response < <(request_with_saved_access_token "POST" "webhooks/subscriptions" "$payload")
    status="${response[0]}"
    body="$(printf '%s\n' "${response[@]:1}")"
    print_response "$status" "$body"
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
