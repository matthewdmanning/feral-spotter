# Icons: lucide-react-native → phosphor-react-native

**Scope:** refactor (bundle size, start-up)
**Issues/spec:** #406
**Date:** 2026-10-22
**Branch/PR:** `issue-406-phosphor-icons`

## Scope

**In scope:**

- [x] Replace `lucide-react-native` 1.23.0 with `phosphor-react-native` 3.0.6.
- [x] Import each icon from its own file, never from the package root.
- [x] A lint rule that enforces this.
- [x] The Map picker's center pin uses the `fill` weight.

**Out of scope / not addressed:**

- Icon sizes and colors. They still come from theme tokens.
- Tree shaking. That is on branch `ccr-aa3fa582-dzrsj5`, see
  `2026-10-22-app-startup-speed.md` there.

## Intent

**Purpose:** the Lucide barrel put all 1,752 of its icon modules in the bundle
and ran them at start-up. The app uses 21 icons.

## Design decisions and reasoning

### Per-icon imports

- **Decision:** `import { CameraIcon } from 'phosphor-react-native/src/icons/Camera'`.
- **Reason:** the package `exports` map publishes `./src/icons/*`, so the path
  resolves under Metro and TypeScript. Each icon file pulls in only its own
  weight definitions plus the shared `IconBase`. Its type import from the
  package root is erased at build time, and the export confirms the root
  barrel is not bundled.
- **Names:** the `*Icon` exports. The bare names (`Camera`) are deprecated in
  3.x.

### Lint rule

- **Decision:** `@typescript-eslint/no-restricted-imports` blocks value imports
  from `phosphor-react-native` and any import from `lucide-react-native`.
  `allowTypeImports` keeps `import type { Icon } from 'phosphor-react-native'`
  legal, because a type import adds no module.
- **Reason:** one root import would bring every icon back, and no other check
  would notice.

### Real icons in Jest

- **Decision:** `jest.config.js` adds `phosphor-react-native` to
  `transformIgnorePatterns`. The icons ship as TypeScript source, so Jest must
  transform them. The 15 per-suite Lucide mocks were deleted, and the icons
  now render through `react-native-svg`'s Jest output.
- **Reason:** one config line replaces 15 hand-kept stub lists. A stub list
  goes stale whenever a screen adds an icon.

### Icon mapping

| Lucide                  | Phosphor                           |
| ----------------------- | ---------------------------------- |
| AlertCircle             | WarningCircleIcon                  |
| Calendar                | CalendarIcon                       |
| Camera                  | CameraIcon                         |
| Check                   | CheckIcon                          |
| CheckCircle             | CheckCircleIcon                    |
| ChevronDown / ChevronUp | CaretDownIcon / CaretUpIcon        |
| ClipboardList           | ClipboardTextIcon                  |
| Clock                   | ClockIcon                          |
| FileText                | FileTextIcon                       |
| ImagePlus               | ImageSquareIcon                    |
| Key                     | KeyIcon                            |
| MapPin (with `fill`)    | MapPinIcon `weight="fill"`         |
| Send                    | PaperPlaneRightIcon                |
| Settings                | GearIcon                           |
| SwitchCamera            | CameraRotateIcon                   |
| Trash2                  | TrashIcon                          |
| X / XCircle             | XIcon / XCircleIcon                |
| Zap / ZapOff            | LightningIcon / LightningSlashIcon |

The `LucideIcon` type in the tab layout became Phosphor's `Icon` type.

## What shipped

- 13 source files under `src/` switched imports and JSX names.
- `eslint.config.js`: the import rule.
- `jest.config.js`: transform Phosphor.
- `package.json` / `package-lock.json`: Phosphor added, Lucide removed.

## Measurements

Android release export (`npx expo export --platform android --source-maps`),
no tree shaking on this branch:

| Bundle | Hermes bytecode | Modules | Icon modules |
| ------ | --------------- | ------- | ------------ |
| main   | 6.2 MB          | 4,293   | 1,752 Lucide |
| branch | 4.9 MB          | 2,585   | 44 Phosphor  |

The 44 Phosphor modules are the 21 icons, their 21 definitions, and 2 shared
files. These are size and module counts, not time.

## Tests

| Test file                                        | What it verifies                                                                                                                           |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `__tests__/components/atoms/StatusIcon.test.tsx` | Each submission status draws its own icon. Now asserts on the real icon's testID (`phosphor-react-native-<name>-…`) rather than on a stub. |

**Not tested:**

- No new test. The other suites changed only by losing their Lucide mocks.

## Verification status

**Run and passing:**

- [x] Type checking: `npm run typecheck`
- [x] Unit/model tests: `npx jest` (76 suites, 352 tests)
- [x] Lint: `npm run lint` (0 errors; 40 warnings, down from 43 on main)
- [x] Formatting: prettier on changed files
- [x] Bundle: `npx expo export --platform android`

**Unverified:**

- No device pass. Each screen needs a look: the icons are a different set, and
  stroke weight and optical size differ from Lucide.

## Follow-ups and known limitations

- [ ] Device check of every icon, light and dark theme.
- The camera flip control is removed on `ccr-aa3fa582-dzrsj5`. If that branch
  merges first, the `CameraRotateIcon` import goes with it.

## 2026-10-26 — fix

**Purpose:** restore type checking for the per-icon source imports, which expose
Phosphor 3.0.6's `className` prop missing from `react-native-svg` 15.15.4's
shared `SvgProps` declaration.
**Change:** add `src/types/react-native-svg.d.ts` to augment `SvgProps` with
`className?: string`. This declaration changes no runtime code and preserves
the other SVG prop checks. Remove it when upstream declares the prop.

**Verification:** application and server type checks pass (`npm run typecheck`).
