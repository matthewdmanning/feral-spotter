# Project Structure

## Directory Layout

```
src/
├── app/          # Expo Router routes (thin re-exports only)
├── screens/      # Screen-level components and state
├── components/   # Atomic Design: atoms → molecules → organisms
├── hooks/        # Zustand stores and feature hooks
├── lib/          # Auth, cache, analytics
├── utils/        # Pure functions
└── config/       # Constants and feature flags
```

Dependency direction is strictly one-way: `app/` → `screens/` → `hooks/components/lib/` → `utils/config/`. No upward imports.s
