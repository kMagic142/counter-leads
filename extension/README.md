# Taxe Leads Tweaks (Chrome Extension)

This is a small Chrome extension that runs on the Leads dashboards and:

- Removes the table columns named: `utm source`, `step`, `last step change`
- Replaces the **fa-eye** icon inside `td.text-center` with an **Open** button:
  - `<button class="btn btn-primary btn-sm" type="button">Open</button>`
  - Clicking the button opens the original `href` from the replaced link.
- Adds a **Dark mode** toggle (bottom-left). The setting is saved in `localStorage`.

## Where it runs

Only on:

- `https://dashboard.taxe.ro/leads*`
- `https://taxe.amdav.ro/leads*`

And only if the page title (normalized whitespace) equals:

- `Taxe Dashboard Leads`

## Install (Load unpacked)

Before loading unpacked (or after editing `content.js`), build the bundled content script:

- From repo root: `npm run build:extension`

1. Open Chrome and go to `chrome://extensions`
2. Enable **Developer mode**
3. Click **Load unpacked**
4. Select this folder:
   - `counter-leads/extension`

## Notes

- The page is likely dynamic, so the content script uses a `MutationObserver` and re-applies changes as the table updates.
- If your title is slightly different, adjust `TARGET_TITLE` in `content.js`.
