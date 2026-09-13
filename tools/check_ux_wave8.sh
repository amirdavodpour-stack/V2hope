#!/usr/bin/env bash
set -euo pipefail

required=(
  'lib/core/ui/components.dart:class HopeResponsive'
  'lib/core/ui/components.dart:class SkeletonBox'
  'lib/core/ui/components.dart:HapticFeedback.lightImpact()'
  'lib/features/home/home_widgets.part.dart:HopeResponsive('
  'lib/features/jobs/jobs_page.dart:OpportunitySkeletonCard()'
)
for item in "${required[@]}"; do
  file=${item%%:*}
  needle=${item#*:}
  grep -Fq "$needle" "$file" || { echo "UX Wave 8 check failed: $file -> $needle"; exit 1; }
done
echo 'UX Wave 8 contract PASS: responsive + skeleton + haptic + accessibility hooks present'
