#!/bin/bash
# ============================================================
# DISPATCH — one-step setup for a Mac
#
# Paste this into Terminal:
#   curl -fsSL https://raw.githubusercontent.com/jaydenadin0711-stack/README/claude/peaceful-knuth-ihlw4k/dispatch/setup-mac.sh | bash
#
# It downloads Dispatch to ~/Dispatch, installs it, asks for your
# API key and phone number, and starts it. Run it again any time
# to update and restart.
# ============================================================
set -e

REPO="https://github.com/jaydenadin0711-stack/README.git"
BRANCH="claude/peaceful-knuth-ihlw4k"
DIR="$HOME/Dispatch"

say() { printf '\n\033[1m%s\033[0m\n' "$1"; }

# Read from the keyboard even when this script itself came in through a pipe.
ask() { local v; read -r -p "$1" v < /dev/tty; printf '%s' "$v"; }

say "1/6  Checking for Node.js"
if ! command -v node >/dev/null 2>&1; then
  if command -v brew >/dev/null 2>&1; then
    brew install node
  else
    echo "Node.js isn't installed. Opening the download page: install the LTS version, then run this again."
    open "https://nodejs.org/en/download"
    exit 1
  fi
fi
node -v

say "2/6  Downloading Dispatch to $DIR"
if [ -d "$DIR/.git" ]; then
  git -C "$DIR" fetch -q origin "$BRANCH"
  git -C "$DIR" checkout -q "$BRANCH"
  git -C "$DIR" pull -q origin "$BRANCH"
else
  git clone -q -b "$BRANCH" "$REPO" "$DIR"
fi
cd "$DIR"
npm install --silent --no-audit --no-fund

say "3/6  Settings"
[ -f .env ] || cp .env.example .env

set_env() {  # set_env NAME VALUE — replaces the line in .env
  local tmp; tmp=$(mktemp)
  grep -v "^$1=" .env > "$tmp" || true
  printf '%s=%s\n' "$1" "$2" >> "$tmp"
  mv "$tmp" .env
}
has_env() { grep -q "^$1=..*" .env; }

# Asks Anthropic whether the key works: 200 = good, 401 = rejected.
key_status() {
  curl -s -o /dev/null -w '%{http_code}' https://api.anthropic.com/v1/models \
    -H "x-api-key: $1" -H "anthropic-version: 2023-06-01"
}
clean_key() { printf '%s' "$1" | tr -d '[:space:]"'"'"; }

key=$(clean_key "$(grep '^ANTHROPIC_API_KEY=' .env | head -1 | cut -d= -f2-)")

# No working key yet? Look for one you already use elsewhere on this Mac
# (e.g. JARVIS's .env) and offer it — nothing to paste, nothing to mistype.
if [ "$(key_status "$key")" != "200" ]; then
  while IFS= read -r f; do
    [ "$f" -ef "$DIR/.env" ] && continue
    k=$(clean_key "$(grep '^ANTHROPIC_API_KEY=' "$f" | head -1 | cut -d= -f2-)")
    [ -n "$k" ] || continue
    if [ "$(key_status "$k")" = "200" ]; then
      echo "Found a working API key in $f (…${k: -4})."
      yn=$(ask "Use it for Dispatch? [Y/n] ")
      case "$yn" in [nN]*) ;; *) key="$k"; break ;; esac
    fi
  done < <(find "$HOME" -maxdepth 4 -name .env -type f \
             -not -path '*/node_modules/*' -not -path "$HOME/Library/*" \
             -exec grep -l '^ANTHROPIC_API_KEY=..' {} + 2>/dev/null)
fi

while :; do
  if [ -n "$key" ]; then
    code=$(key_status "$key")
    if [ "$code" = "200" ]; then echo "API key: works ✓"; break; fi
    if [ "$code" = "401" ] || [ "$code" = "403" ]; then
      echo "That API key was rejected by Anthropic (it's incomplete, deleted, or disabled)."
      echo "Make a NEW key at console.anthropic.com → API Keys → Create Key, and copy it right away —"
      echo "the console only shows the whole key once."
      open "https://console.anthropic.com/settings/keys"
    else
      echo "Couldn't check the key (got '$code' — no internet?). Using it anyway."
      break
    fi
  fi
  key=$(clean_key "$(ask "Paste your Anthropic API key (starts with sk-ant-): ")")
done
set_env ANTHROPIC_API_KEY "$key"
if has_env DISPATCH_IMESSAGE_TO; then
  echo "Phone: already set"
else
  phone=$(ask "Your iPhone number, like +15551234567: ")
  set_env DISPATCH_IMESSAGE_TO "$phone"
fi
chmod 600 .env

say "4/6  Permission to read Messages"
if sqlite3 -readonly "$HOME/Library/Messages/chat.db" 'SELECT 1;' >/dev/null 2>&1; then
  echo "Already allowed."
else
  echo "Opening System Settings → Privacy & Security → Full Disk Access."
  echo "Turn ON the switch for Terminal, then come back here."
  open "x-apple.systempreferences:com.apple.preference.security?Privacy_AllFiles"
  ask "Press Return once it's on… " >/dev/null
  if ! sqlite3 -readonly "$HOME/Library/Messages/chat.db" 'SELECT 1;' >/dev/null 2>&1; then
    echo "Still blocked — macOS only applies it after Terminal restarts."
    echo "Quit Terminal (⌘Q), open it again, and run the same command again."
    exit 1
  fi
fi

say "5/6  Card vault (Claude Code)"
# The vault lives on your Claude account, so Dispatch reaches it through
# Claude Code signed in as you. Skippable: everything else works without it.
if ! has_env DISPATCH_VAULT_URL; then
  url=$(ask "Your card vault link (claude.ai/artifact/…), or press Return to skip: ")
  url=$(printf '%s' "$url" | tr -d '[:space:]')
  [ -n "$url" ] && set_env DISPATCH_VAULT_URL "$url"
fi
if has_env DISPATCH_VAULT_URL; then
  export PATH="$HOME/.local/bin:$PATH"
  if ! command -v claude >/dev/null 2>&1; then
    echo "Installing Claude Code…"
    curl -fsSL https://claude.ai/install.sh | bash
    export PATH="$HOME/.local/bin:$PATH"
  fi
  # Same as Dispatch does: no API key, so it uses your Claude login.
  if env -u ANTHROPIC_API_KEY claude -p "Reply with just: ok" --output-format text 2>/dev/null | grep -qi ok; then
    echo "Claude Code: signed in ✓"
  else
    echo "Claude Code needs you to sign in once. It opens now: sign in with your Claude account,"
    echo "then type /exit to come back here."
    ask "Press Return to start… " >/dev/null
    env -u ANTHROPIC_API_KEY claude < /dev/tty || true
    if env -u ANTHROPIC_API_KEY claude -p "Reply with just: ok" --output-format text 2>/dev/null | grep -qi ok; then
      echo "Claude Code: signed in ✓"
    else
      echo "Still not signed in — the card vault won't work until you run 'claude' and sign in. Everything else will."
    fi
  fi
else
  echo "Skipped — run this setup again any time to add it."
fi

say "6/6  Starting Dispatch"
echo "If macOS asks whether Terminal may control Messages, click OK."
echo "You'll get '🤖 Dispatch is online' on your iPhone. Keep this window open and the lid up."
echo "To stop it: Ctrl+C."
exec caffeinate -is npm run dispatch
