name: HOPE-V7 Bootstrap

on:
  workflow_dispatch:

permissions:
  contents: write

jobs:
  bootstrap:
    runs-on: ubuntu-latest
    timeout-minutes: 30

    steps:
      - name: Checkout
        uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Prepare
        run: |
          set -e
          mkdir -p /tmp/hope
          unzip -o "HOPE-V7-4.0.20-SESSION-20260913T141130Z-final.zip" -d /tmp/hope

      - name: Find project root
        run: |
          set -e

          ROOT="$(find /tmp/hope -name package.json -o -name pubspec.yaml | head -n 1)"

          if [ -z "$ROOT" ]; then
            echo "Project root not found"
            exit 1
          fi

          ROOT="$(dirname "$ROOT")"
          echo "PROJECT_ROOT=$ROOT" >> "$GITHUB_ENV"
          echo "Project root: $ROOT"

      - name: Copy project
        run: |
          set -e

          rsync -a \
            "$PROJECT_ROOT/" \
            ./ \
            --exclude ".git/" \
            --exclude ".github/workflows/bootstrap.yml"

      - name: Install backend dependencies
        run: |
          set -e

          if [ -f backend/package.json ]; then
            cd backend
            npm ci --ignore-scripts
          fi

      - name: Validate Node scripts
        run: |
          set -e

          if [ -f tools/staging-operational-gate.mjs ]; then
            node --check tools/staging-operational-gate.mjs
          fi

      - name: Run project bootstrap/check scripts
        run: |
          set -e

          if [ -f package.json ]; then
            npm run bootstrap --if-present
            npm run setup --if-present
            npm run verify --if-present
            npm test --if-present
          fi

          if [ -f backend/package.json ]; then
            cd backend
            npm run bootstrap --if-present
            npm run setup --if-present
            npm run verify --if-present
            npm test --if-present
          fi

      - name: Commit project
        run: |
          set -e

          git config user.name "github-actions[bot]"
          git config user.email "41898282+github-actions[bot]@users.noreply.github.com"

          git add -A

          if git diff --cached --quiet; then
            echo "Nothing to commit."
          else
            git commit -m "chore: bootstrap HOPE-V7 from session archive"
            git push origin HEAD:main
          fi
