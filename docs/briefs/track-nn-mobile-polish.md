# Track NN — Mobile polish pass (375px audit)

## Goal

Every dashboard route works flawlessly on a 375×667 viewport (iPhone SE).
No horizontal scroll, all tap targets ≥44px, all modals usable, sidebar
collapses to a hamburger drawer.

## Non-goals

- Not redesigning anything desktop.
- Not adding mobile-only features.
- Not building a native app.
- Not optimizing for tablets (768–1024px is already fine).

## Architecture

This is primarily a CSS/markup audit. No new tables, no new routes. The
deliverables are page-by-page commits so the diff is reviewable.

| Page | Known issues to fix |
|---|---|
| `/dashboard` (home) | Greeting card stacks, deadline grid wraps, Pro insight card overflows |
| `/dashboard/documents` | Filter bar overflows, sort dropdown anchors off-screen, grid → 1col |
| `/dashboard/documents/[id]` | Tabs scrollable horizontally, PDF viewer fills width, AskPanel full-width |
| `/dashboard/reminders` | Status filter tabs scroll, action buttons stack, search input full-width |
| `/dashboard/insights` | Grid → 1col, PortfolioAsk full-width, weekly card readable |
| `/dashboard/settings` | Forms stack, action buttons full-width, delete dialog usable |
| Dashboard shell | Sidebar → drawer on `<lg`, hamburger button visible, focus-trap drawer |

## Commit cadence (CRITICAL)

**Commit and push after EACH page below.** One page = one commit. Each
commit must build + lint clean. Take a screenshot for the PR body where
practical.

## Deliverables

### 1. Shell + sidebar drawer
- Convert `src/components/dashboard/sidebar.tsx` to a sheet/drawer on `<lg`
- Add hamburger button to top bar (top-left), only visible on `<lg`
- Focus-trap drawer when open, dismiss on overlay click + Esc
- Commit: `feat(mobile): collapse dashboard sidebar to drawer below lg`

### 2. Dashboard home (`/dashboard`)
- Stack greeting + Pro insight cards on `<md`
- Deadline cards → single column on `<sm`
- Inline metric numbers don't wrap awkwardly
- Commit: `feat(mobile): tighten dashboard home layout at 375px`

### 3. Documents list (`/dashboard/documents`)
- Filter bar wraps cleanly; sort dropdown anchors right-of-viewport not off-screen
- Grid → 1col on `<sm`; preserve risk chip + end date
- Empty state CTA tap target ≥44px
- Commit: `feat(mobile): documents list responsive at 375px`

### 4. Document detail (`/dashboard/documents/[id]`)
- Tabs horizontally scrollable, sticky on scroll preserved
- PDF viewer fills width, page nav buttons usable
- AskPanel + PortfolioAsk fill width below `lg`
- Reminder cards stack
- Commit: `feat(mobile): document detail responsive at 375px`

### 5. Reminders (`/dashboard/reminders`)
- Status filter tabs horizontally scrollable
- Reminder cards stack action buttons on `<sm`
- Search input full-width
- Commit: `feat(mobile): reminders page responsive at 375px`

### 6. Insights + Settings
- Insights: 1col layout below `md`, PortfolioAsk full-width
- Settings: forms stack, action buttons full-width on `<sm`, delete confirm
  dialog fits viewport
- Commit: `feat(mobile): insights + settings responsive at 375px`

## Tests required

- Add `src/components/dashboard/__tests__/sidebar-drawer.test.tsx`:
  - opens on hamburger click
  - closes on overlay click
  - closes on Escape key
  - focus trapped inside drawer
- Other pages: snapshot tests OK, no need for visual regression.

## Definition of done

- `npm test` ✅ all passing (currently 249)
- `npm run lint` ✅ clean
- `npx tsc --noEmit` ✅ clean
- `npx next build` ✅ clean
- All 6 commits pushed to `track-nn-mobile-polish`
- PR body includes screenshots OR a Chrome DevTools device-mode test
  protocol (one per page) confirming no horizontal scroll at 375px
- No regressions on `≥lg` (1024px+) — desktop layout unchanged

## Tailwind breakpoint reminder

```
sm  640
md  768
lg  1024
xl  1280
```

The current code uses `md:` and `lg:` heavily. The audit at 375px means
**below `sm`**, so unprefixed classes apply. Most fixes are removing
implicit horizontal layouts in the base classes, not adding new
breakpoints.
