name: HOPE-V7 Bootstrap

on:
  workflow_dispatch:
    inputs:
      archive_sha256:
        description: "Expected SHA-256 of the session archive"
        required: true
        default: "a627e5de48621e2f2f1f797be7bb29804b445a55d1201305d2da7cf4b4bb7407"
      run_checks:
        description: "Run bootstrap verification checks"
        required: true
        type: boolean
        default: true

permissions:
  contents: write

jobs:
  bootstrap:
    runs-on: ubuntu-latest
    timeout-minutes: 20

    steps:
      - name: Checkout repository
        uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Bootstrap HOPE-V7 from uploaded session archive
        env:
          EXPECTED_SHA256: ${{ inputs.archive_sha256 }}
        run: |
          set -euo pipefail

          ROOT="$(git rev-parse --show-toplevel)"
          cd "$ROOT"

          ARCHIVE="HOPE-V7-4.0.20-SESSION-20260913T141130Z-final.zip"
          URL="https://raw.githubusercontent.com/amirdavodpour-stack/V2hope/main/${ARCHIVE}"
          TMP="/tmp/hope-v7-session.zip"
          EXTRACT_DIR="/tmp/hope-v7-extract"

          echo "============================================"
          echo "HOPE-V7 BOOTSTRAP"
          echo "============================================"

          echo "[1/6] Downloading source archive..."
          curl -fL --retry 3 --retry-delay 2 "$URL" -o "$TMP"

          echo "[2/6] Verifying SHA-256..."
          ACTUAL_SHA256="$(sha256sum "$TMP" | awk '{print $1}')"

          echo "Expected SHA-256: $EXPECTED_SHA256"
          echo "Actual SHA-256:   $ACTUAL_SHA256"

          if [[ "$ACTUAL_SHA256" != "$EXPECTED_SHA256" ]]; then
            echo "FATAL: SHA-256 mismatch."
            exit 1
          fi

          echo "SHA-256 verification PASSED."

          echo "[3/6] Extracting archive..."
          rm -rf "$EXTRACT_DIR"
          mkdir -p "$EXTRACT_DIR"

          unzip -q "$TMP" -d "$EXTRACT_DIR"

          echo "[4/6] Installing project into repository root..."
          rsync -a \
            --exclude ".git/" \
            --exclude ".github/workflows/bootstrap.yml" \
            "$EXTRACT_DIR/" "$ROOT/"

          echo "[5/6] Writing provenance..."
          cat > "$ROOT/BOOTSTRAP-PROVENANCE.md" <<EOF
          # HOPE-V7 GitHub Bootstrap Provenance

          Source archive:
          $ARCHIVE

          Source archive URL:
          $URL

          Expected SHA-256:
          $EXPECTED_SHA256

          Actual SHA-256:
          $ACTUAL_SHA256

          Bootstrap timestamp:
          $(date -u +"%Y-%m-%dT%H:%M:%SZ")

          This file records the provenance of the bootstrap extraction.

          The bootstrap does not weaken tests, thresholds, security controls,
          financial invariants, or certification evidence requirements.
          EOF

          echo "[6/6] Extraction complete."

      - name: Verify HOPE-V7 structure
        if: ${{ inputs.run_checks }}
        run: |
          chmod +x .github/bootstrap/verify-hope-v7.sh
          .github/bootstrap/verify-hope-v7.sh

      - name: Show extracted project summary
        run: |
          echo
          echo "============================================"
          echo "PROJECT SUMMARY"
          echo "============================================"

          echo
          echo "Root:"
          pwd

          echo
          echo "Top-level files/directories:"
          find . -maxdepth 2 \
            -not -path "./.git*" \
            -not -path "./node_modules*" \
            | sort | head -200

      - name: Commit extracted HOPE-V7 project
        run: |
          set -euo pipefail

          git config user.name "github-actions[bot]"
          git config user.email "41898282+github-actions[bot]@users.noreply.github.com"

          git add -A

          if git diff --cached --quiet; then
            echo "No changes detected. Nothing to commit."
            exit 0
          fi

          git commit -m "chore: bootstrap HOPE-V7 project from certified session archive"
          git push

          echo
          echo "HOPE-V7 bootstrap commit pushed successfully."
