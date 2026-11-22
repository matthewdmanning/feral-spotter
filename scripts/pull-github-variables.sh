#!/usr/bin/env bash
# Writes a GitHub environment's variables to .env.<mode>.local, which Expo
# loads first for that mode (expo run:android: debug = development, release =
# production). Gitignored by .env*.local. Rerun after a variable changes.
# Secrets cannot be fetched (gh has no `secret get`); keep them in .env.local.
#
#   npm run env:pull -- <mode> [github-environment]   # environment defaults to <mode>
set -euo pipefail

cd "$(dirname "$0")/.."

mode="${1:?usage: pull-github-variables.sh <development|production> [github-environment]}"
github_environment="${2:-$mode}"
variables=$(gh variable list --env "$github_environment" --json name,value \
  --jq '.[] | "\(.name)=\(.value | @json)"')
printf '%s\n' "$variables" > ".env.$mode.local"
echo "Wrote $(printf '%s\n' "$variables" | wc -l) variables from $github_environment to .env.$mode.local"
