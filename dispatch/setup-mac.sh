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

say "1/5  Checking for Node.js"
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

say "2/5  Downloading Dispatch to $DIR"
if [ -d "$DIR/.git" ]; then
  git -C "$DIR" fetch -q origin "$BRANCH"
  git -C "$DIR" checkout -q "$BRANCH"
  git -C "$DIR" pull -q origin "$BRANCH"
else
  git clone -q -b "$BRANCH" "$REPO" "$DIR"
fi
cd "$DIR"
npm install --silent --no-audit --no-fund

say "3/5  Settings"
[ -f .env ] || cp .env.example .env

set_env() {  # set_env NAME VALUE — replaces the line in .env
  local tmp; tmp=$(mktemp)
  grep -v "^$1=" .env > "$tmp" || true
  printf '%s=%s\n' "$1" "$2" >> "$tmp"
  mv "$tmp" .env
}
has_env() { grep -q "^$1=..*" .env; }

if has_env ANTHROPIC_API_KEY; then
  echo "API key: already set"
else
  key=$(ask "Paste your Anthropic API key (starts with sk-ant-): ")
  set_env ANTHROPIC_API_KEY "$key"
fi
if has_env DISPATCH_IMESSAGE_TO; then
  echo "Phone: already set"
else
  phone=$(ask "Your iPhone number, like +15551234567: ")
  set_env DISPATCH_IMESSAGE_TO "$phone"
fi
chmod 600 .env

say "4/5  Permission to read Messages"
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

say "5/5  Starting Dispatch"
echo "If macOS asks whether Terminal may control Messages, click OK."
echo "You'll get '🤖 Dispatch is online' on your iPhone. Keep this window open and the lid up."
echo "To stop it: Ctrl+C."
exec caffeinate -is npm run dispatch
