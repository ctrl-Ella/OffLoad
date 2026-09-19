#!/usr/bin/env bash
#
# Configures the repository on GitHub: labels, branches and protection rules.
#
# WHEN TO RUN IT
#   Once, against a repository that already exists.
#   It is idempotent: running it twice breaks nothing.
#
# WHAT YOU NEED FIRST
#   - gh installed and signed in:  gh auth login
#   - the repository already created and set as the `origin` remote
#
# WHAT IT DOES
#   1. Configures git so accented characters survive (UTF-8)
#   2. Creates the labels from .github/labels.yml
#   3. Creates the dev branch
#   4. Applies the protection rules from .github/rulesets/
#   5. Turns on automatic branch deletion on merge
#
# WHAT IT DOES NOT DO
#   - Create the repository or the organisation
#   - Create the project board: that is done by hand, and auto-add is switched
#     on from its own Workflows screen. See docs/workflow/issues-and-labels.md

set -euo pipefail

# ---------------------------------------------------------------------------
# Preflight checks: fail early, with a message that makes sense
# ---------------------------------------------------------------------------

if ! command -v gh >/dev/null 2>&1; then
  echo "ERROR: 'gh' (GitHub CLI) is missing."
  echo "       Install it from https://cli.github.com and try again."
  exit 1
fi

if ! gh auth status >/dev/null 2>&1; then
  echo "ERROR: 'gh' is not signed in."
  echo "       Run:  gh auth login"
  exit 1
fi

if ! git remote get-url origin >/dev/null 2>&1; then
  echo "ERROR: this repository has no 'origin' remote."
  echo "       Create it and add the remote:"
  echo "       git remote add origin https://github.com/ctrl-Ella/OffLoad.git"
  exit 1
fi

REPO="$(gh repo view --json nameWithOwner --jq .nameWithOwner)"
echo "Repository: $REPO"
echo

# ---------------------------------------------------------------------------
# 1. UTF-8 in git
# ---------------------------------------------------------------------------
# Without this, on Windows accented characters land in the history as \303\261
# and filenames carrying them look just as broken.

echo "== Configuring git for UTF-8 =="
git config core.quotepath false
git config i18n.commitEncoding utf-8
git config i18n.logOutputEncoding utf-8
echo "   done"
echo

# ---------------------------------------------------------------------------
# 2. Labels
# ---------------------------------------------------------------------------

echo "== Creating labels =="

# Read from .github/labels.yml without depending on a YAML parser: the format is
# fixed and known, because we write it, so reading the fields is enough.
label_name=""
label_color=""
label_description=""

create_label() {
  [ -z "$label_name" ] && return 0
  if gh label create "$label_name" --color "$label_color" --description "$label_description" --force >/dev/null 2>&1; then
    echo "   $label_name"
  else
    echo "   WARNING: could not create '$label_name'"
  fi
}

while IFS= read -r line; do
  case "$line" in
    "- name: "*)
      create_label
      label_name="$(echo "$line" | sed 's/^- name: *//; s/^"//; s/"$//')"
      label_color=""
      label_description=""
      ;;
    *"color: "*)
      label_color="$(echo "$line" | sed 's/^ *color: *//; s/^"//; s/"$//')"
      ;;
    *"description: "*)
      label_description="$(echo "$line" | sed 's/^ *description: *//; s/^"//; s/"$//')"
      ;;
  esac
done < .github/labels.yml
create_label

echo

# ---------------------------------------------------------------------------
# 3. The dev branch
# ---------------------------------------------------------------------------

echo "== Creating the dev branch =="
if git show-ref --verify --quiet refs/heads/dev; then
  echo "   already exists locally"
else
  git branch dev
  echo "   created locally"
fi

if git ls-remote --exit-code --heads origin dev >/dev/null 2>&1; then
  echo "   already exists on the remote"
else
  git push -u origin dev
  echo "   pushed to the remote"
fi
echo

# ---------------------------------------------------------------------------
# 4. Protection rules
# ---------------------------------------------------------------------------
# These only work on public repositories under the free plan. If the repo is
# private, the API answers with a permissions error: warn and carry on.

echo "== Applying protection rules =="
for file in .github/rulesets/*.json; do
  rule_name="$(basename "$file" .json)"
  if gh api "repos/$REPO/rulesets" \
       --method POST \
       --input "$file" >/dev/null 2>&1; then
    echo "   $rule_name applied"
  else
    echo "   WARNING: could not apply '$rule_name'."
    echo "            Usually this means the repository is private (the rules only"
    echo "            work on public ones under the free plan), or the rule already"
    echo "            exists. Check under Settings > Rules."
  fi
done
echo

# ---------------------------------------------------------------------------
# 5. Repository settings
# ---------------------------------------------------------------------------

echo "== Repository settings =="
if gh api "repos/$REPO" --method PATCH \
     -F delete_branch_on_merge=true \
     -F allow_squash_merge=true \
     -F allow_merge_commit=true \
     -F allow_rebase_merge=false >/dev/null 2>&1; then
  echo "   automatic branch deletion on merge: on"
else
  echo "   WARNING: could not change the settings (admin permissions?)"
fi
echo

# ---------------------------------------------------------------------------
# What is left to do by hand
# ---------------------------------------------------------------------------

cat <<'END'
== Done ==

Left to do by hand, because GitHub does not allow it over the API on the free plan:

  1. Create the project board.
     Then: Workflows > Auto-add to project, filtering on  is:issue is:open
     That way issues land on the board as they are created.

  2. Check that secret scanning is on:
     Settings > Code security > Secret scanning > Push protection

  3. Fill in .github/CODEOWNERS with the team's real usernames.

One thing to know about automatic branch deletion: it also deletes the head
branch of a pull request, and on a dev-to-main release that branch is `dev`.
It is safe while `dev` is protected, because the rules forbid deleting it.

Details in docs/workflow/issues-and-labels.md
END
