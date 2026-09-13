# HOPE V2 — Premium Max Design System

V2 treats V1 as a frozen foundation. The objective is not a cosmetic reskin: the interface is rebuilt around a coherent design language, responsive information architecture, and deliberate interaction states.

## Non-negotiables

- Token-first spacing, typography, radii, surfaces and breakpoints.
- Every major screen must support loading, empty, error, success and disabled states.
- Mobile-first, then tablet/desktop composition; no stretched mobile layouts.
- Dark mode is a designed theme, not an inversion filter.
- Motion is purposeful and respects reduced-motion preferences.
- Accessibility is part of the component contract.
- Premium means hierarchy, restraint, consistency and interaction quality—not decorative gradients.

## Current V2 foundation

- `lib/core/theme/hope_v2_design.dart`: V2 tokens.
- `lib/core/ui/premium_components.dart`: reusable premium primitives.
- `lib/features/home/premium_home_feed.dart`: first V2 flagship screen.
- Existing V1 `components.dart` remains available as a compatibility layer while screens migrate.

## Screen migration order

1. Home / dashboard
2. Explore / search
3. Job detail
4. Application + offer flows
5. Transactions + payment status
6. Profile
7. Notifications
8. Admin command center

No screen is considered V2-complete until it consumes the shared design system and has responsive + accessibility states covered.
