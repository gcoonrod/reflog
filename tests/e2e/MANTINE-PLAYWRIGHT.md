# Mantine PasswordInput + Playwright: Known Issues

## Problem

Playwright's `fill()` and `pressSequentially()` methods do not work reliably
with Mantine v8's `PasswordInput` component when used with React 19 controlled
inputs. After calling these methods, the DOM value appears set (readable via
`inputValue()`), but React's internal state does not update. This means
`onChange` never fires, controlled state stays empty, and any derived state
(like `isValid` for form validation) remains incorrect.

### Symptoms

- Button controlled by `disabled={!isValid}` stays disabled after `fill()`
- `inputValue()` returns the typed text, but `evaluate(el => el.value)` returns `""`
- `pressSequentially()` appears to type into the element but React state is empty

## Root Cause

Mantine v8's `PasswordInput` renders the `<input>` inside nested wrapper divs.
While Playwright's `getByLabel()` correctly resolves to the `<input>` element
(confirmed: `tagName === "INPUT"`, `type === "password"`), the interaction
methods don't reliably trigger React 19's synthetic event system.

Specifically:

- **`fill()`** sets the input value via Chrome DevTools Protocol, which bypasses
  React 19's input value tracking (property descriptor overrides). React doesn't
  detect the change, so `onChange` never fires.

- **`pressSequentially()`** sends individual key events to the locator target,
  but in practice the keystrokes don't reach the input's value property (possibly
  due to Mantine's internal wrapper structure intercepting events).

## Working Solution

Use `click()` on the label-associated element to focus the real `<input>`, then
`keyboard.type()` to send keystrokes to the focused element:

```typescript
// DON'T do this — React state won't update:
await page.getByLabel("Passphrase", { exact: true }).fill("my-passphrase");

// DON'T do this — element.value stays empty:
await page.getByLabel("Passphrase", { exact: true }).pressSequentially("my-passphrase");

// DO this — works reliably:
await page.getByLabel("Passphrase", { exact: true }).click();
await page.keyboard.type("my-passphrase");
```

### Why This Works

`click()` on the wrapper element causes the browser to focus the inner
`<input>`. `keyboard.type()` then sends keystrokes to whatever element has
focus (the real `<input>`), going through the normal DOM event pipeline that
React intercepts correctly.

## Concurrency Note

The `keyboard.type()` approach can be unreliable when running many Playwright
workers in parallel (5+), because keyboard events may be lost under heavy
system load. The CI config uses `workers: 1` for this reason:

```typescript
// playwright.config.ts
workers: process.env.CI ? 1 : undefined,
```

If running tests locally with multiple workers and seeing intermittent failures
in vault setup, try `--workers=1`.

## Scope

This issue affects any Mantine v8 input component used as a React controlled
input (`value` + `onChange` props). Standard `<input>` elements and other UI
libraries may not have this problem.

Non-password inputs (CodeMirror `.cm-editor .cm-content`, Mantine `TextInput`,
search placeholders) appear to work fine with `fill()` — the issue is specific
to `PasswordInput` or possibly other compound input components.

## Additional Context: Migration Redirect

When `VITE_AUTH_DISABLED=true` (E2E builds), the app skips the sync migration
check (`/migrate` route) and goes directly to `/timeline` after vault creation.
Without this, new vaults would always redirect to `/migrate` because there's
no `deviceId` in `sync_meta` when sync infrastructure isn't available.

See: `src/routes/_app/index.tsx` — `AUTH_DISABLED` check in the migration
effect.
