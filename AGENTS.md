This is an Expo/React Native mobile application. Prioritize mobile-first patterns, performance, and cross-platform compatibility.

## Expo has changed — do not trust your training data

Expo ships breaking changes every SDK release. APIs you remember are likely renamed, moved, or removed. Before writing any code that touches an Expo, EAS, or React Native API:

1. Read the major version of the `expo` package in `package.json`.
2. Fetch the matching versioned docs: `https://docs.expo.dev/versions/v<major>.0.0/`
3. For anything else, fetch https://docs.expo.dev/llms.txt — an index of all Expo docs with corrections to common LLM misconceptions. Follow its links to the specific page you need; never answer from memory.

## Commands

Use `bunx` instead of `npx` if the project uses bun (`bun.lock` present).

```bash
npx expo install <package>  # ALWAYS use instead of npm/yarn/pnpm/bun add — resolves SDK-compatible versions
npx expo start              # start the dev server
npx expo lint               # lint
npx tsc --noEmit            # typecheck
npx expo-doctor             # diagnose dependency and config issues
npx expo install --fix      # fix incompatible package versions
```

Run lint and typecheck before declaring any task done.

## Navigation & Routing

- Use **Expo Router** for all navigation. Routes live in `src/app/` — every file there is a screen, `_layout.tsx` files define navigators. Keep non-route code (components, hooks, utils) outside `src/app/`.
- Import `Link`, `router`, and `useLocalSearchParams` from `expo-router`.
- Route files are one-line re-exports (`export { default } from '@/features/<feature>/screens/<Screen>'`). `_layout.tsx` files stay in `src/app/`.

## Project structure

- `src/features/<feature>/` owns everything for one feature: `model.ts` (Drizzle tables + row types), `repo.ts` (all writes), `domain.ts` (pure logic), `views.ts` (derived read hooks), stores, `components/`, `screens/`, `__tests__/`.
- `src/shared/` holds code used across features: `components/` (ui, charts, toast), `db/` (client, migrations, seed; `schema.ts` only re-exports each feature's `model.ts`), `lib/dates.ts`, `store/data.ts` (the snapshot), `theme/`.
- New tables go in the owning feature's `model.ts` and must be re-exported from `src/shared/db/schema.ts`.

## Styling

- Style with NativeWind (v4, Tailwind v3) `className`. Tokens live in `tailwind.config.js`; themed colors (`bg-card`, `text-ink`, `text-muted`, `border-field-border`, …) are CSS variables in `global.css`, switched by `colorScheme.set()` from the Appearance setting.
- Keep the light/dark values in `global.css` in sync with the `Palette` in `src/shared/theme/index.ts` (still used for icon colors, charts and other runtime values).
- Use inline `style` only for runtime values: safe-area insets, identity accent colors, chart geometry, shadows (`elevation.*`), and Reanimated `Animated.*` views.
- Use React Native's `Text` / `TextInput` directly with type-scale classes: a font (`font-heading`, `font-body`, `font-body-semibold`, `font-body-bold`), a size (`text-display-sm`, `text-label`, `text-caption`, …) and a color (`text-ink`, `text-muted`, …). Don't combine two classes for the same property (e.g. `text-label text-[15px]`); NativeWind picks by stylesheet order, not written order.
- Use `cx()` for conditional classes and `withDefaults()` when a component's default classes can be overridden.
- Third-party components need `cssInterop` registration in `src/shared/lib/nativewind.ts` before `className` works on them.
- Docs: https://docs.expo.dev/router/introduction.md

## Building with EAS

Use EAS to build, sign, and submit the app in the cloud (`eas build`, `eas submit`) and to ship over-the-air updates (`eas update`) — no local Xcode or Android Studio required. Run EAS CLI as `bunx eas-cli <command>` in Bun projects, or `npx eas-cli@latest <command>` otherwise; substitute that for bare `eas` in docs examples.
Docs: https://docs.expo.dev/eas/index.md

## Rules

- If `ios/` and `android/` directories do not exist, they are generated (Continuous Native Generation). Never create or edit them by hand — configure native behavior in `app.json` and config plugins.
- Expo Go only includes its bundled native modules. After adding a library with native code, the app needs a development build: `npx expo run:ios|android` locally, or `eas build --profile development`.
- Prefer recommended Expo modules over third-party libraries, and check your available skills before adding dependencies. Docs: https://docs.expo.dev/versions/latest/index.md
