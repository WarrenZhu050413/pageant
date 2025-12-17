# Dark Mode Implementation Plan

## Summary
Add dark mode support with inverted warm colors, keeping brass accents. Users can follow system preference by default with manual override in Settings.

## Approach

Use CSS custom property overrides with Tailwind's `dark:` variant. When `.dark` class is on `<html>`, the CSS variables are redefined to dark values. No changes to component classes needed - they already use semantic color tokens.

## Implementation Steps

### 1. Update `src/index.css` - Add dark mode color definitions

Add after the `@theme` block:

```css
/* Dark mode overrides */
.dark {
  --color-canvas: #1a1918;
  --color-canvas-subtle: #242322;
  --color-canvas-muted: #2e2d2b;
  --color-surface: #1f1e1d;
  --color-surface-raised: #282726;

  --color-ink: #f5f3f0;
  --color-ink-secondary: #c5c2be;
  --color-ink-tertiary: #9a9793;
  --color-ink-muted: #706d69;

  --color-brass: #c4a86e;
  --color-brass-light: #d8c494;
  --color-brass-dark: #a08a5c;
  --color-brass-muted: rgba(196, 168, 110, 0.2);

  --color-border: rgba(255, 255, 255, 0.1);
  --color-border-strong: rgba(255, 255, 255, 0.18);
  --color-overlay: rgba(0, 0, 0, 0.7);

  /* Shadows need to be stronger in dark mode */
  --shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.2);
  --shadow-md: 0 4px 12px rgba(0, 0, 0, 0.3);
  --shadow-lg: 0 8px 24px rgba(0, 0, 0, 0.4);
  --shadow-xl: 0 16px 48px rgba(0, 0, 0, 0.5);
}
```

Also update shimmer animation for dark mode:
```css
.dark .shimmer {
  background: linear-gradient(
    90deg,
    var(--color-canvas-muted) 25%,
    var(--color-canvas-subtle) 50%,
    var(--color-canvas-muted) 75%
  );
}
```

### 2. Update `tailwind.config.js` - Enable class-based dark mode

```js
export default {
  darkMode: 'class',
  // ... rest of config
}
```

### 3. Add theme state to store

In `src/store/index.ts`, add:
- `theme: 'system' | 'light' | 'dark'` state (default: 'system')
- `setTheme(theme)` action
- Initialize from localStorage on load
- Apply `.dark` class to `<html>` based on preference

### 4. Add theme toggle in `SettingsTab.tsx`

Add a new section at the top for theme selection with three options:
- System (follows OS preference)
- Light
- Dark

### 5. Create theme initialization hook

`src/hooks/useTheme.ts`:
- Reads theme preference from store
- Listens to `prefers-color-scheme` media query when theme is 'system'
- Adds/removes `.dark` class on `<html>` element

### 6. Initialize theme in `App.tsx`

Call `useTheme()` at app root to apply theme on mount.

## Files to Modify

1. `src/index.css` - Add dark mode color definitions
2. `tailwind.config.js` - Enable class-based dark mode (if exists) or create
3. `src/store/index.ts` - Add theme state and actions
4. `src/components/panel/SettingsTab.tsx` - Add theme toggle UI
5. `src/hooks/useTheme.ts` - Create theme management hook (new file)
6. `src/App.tsx` - Initialize theme hook

## Notes

- All components already use semantic color tokens (bg-canvas, text-ink, etc.), so no component changes needed
- The warm brass accent is preserved but slightly brightened for dark mode contrast
- System preference is respected by default with manual override option
- Theme preference persists in localStorage
