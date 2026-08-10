---
name: testing-seatmark
description: How to end-to-end test SeatMark in production (www.seatmark.cn) via CDP — response-header/security checks, Excel import, PNG/ZIP export, print capture, analytics timeline, Lighthouse, and the PWA service-worker caching pitfall.
---

# Testing SeatMark online (www.seatmark.cn)

## Environment
- Chromium: `/opt/.devin/playwright_browsers/chromium-1097/chrome-linux/chrome`, CDP on `9222`.
- Helpers on box: `/home/ubuntu/cdp51.py` (`get_ws/send/js/nav/click`), `/home/ubuntu/r99.py` (`shot/viewport/CLEAN`).
- `CLEAN` clears localStorage/sessionStorage/caches and unregisters service workers — run it after a page load, then reload, for a true clean state.
- Viewports: desktop 1280×900, mobile 390×844 (`Emulation.setDeviceMetricsOverride`).

## Verifying a deploy
- EdgeOne auto-deploys `main`; a code change is confirmed by a new `/assets/index-*.js` hash in the HTML.
- **A change that only touches `edgeone.json` (platform config) does NOT change the bundle hash.** Confirm such deploys by polling response headers instead, e.g. `curl -sSD - -o /dev/null https://www.seatmark.cn/ | grep -i strict-transport` every 30 s (took ~1 min in practice).

## Response-header / security checks
- `curl -sSD - -o /dev/null https://www.seatmark.cn/<path>` for `/`, `/studio`, `/templates`, `/assets/<js>`, `/api/quota`.
- EdgeOne **merges** the `/*` and `/assets/*` `headers` blocks (only same-key entries are overridden, e.g. Cache-Control). Do not expect a more specific `source` to replace the whole header set.
- `/api/*` is served by edge functions (`edge-functions/api/[[default]].js` `json()` builds its own `Response`), so `edgeone.json` headers never apply there. Report as platform behaviour, not a bug.
- Cache buster (`?cb=$RANDOM`) forces `eo-cache-status: Cache Miss`; plain requests can serve `Cache Hit` copies with pre-deploy headers for a few minutes.

## PWA service-worker pitfall (very important for header/security testing)
The site registers a workbox service worker whose precache contains `index.html` (`caches.keys()` → `workbox-precache-v2-https://www.seatmark.cn/`). Any SPA navigation (including a cross-origin `<iframe src=...>`) in a profile that has visited the site before can be answered by the SW with the **precached response captured before the deploy** (`Network.responseReceived` shows `fromServiceWorker: true`, stale `age`), so **new response headers (X-Frame-Options / CSP) are not enforced**. `CLEAN` in one tab is not enough — the SW re-registers on the next site load.
→ For any header/security assertion, test in a **brand-new browser profile**:
```
rm -rf /tmp/prof && chrome --headless=new --no-sandbox --remote-debugging-port=9223 --user-data-dir=/tmp/prof about:blank
```
Then connect to 9223 and enable `Network`+`Log` to read the real headers and security errors (e.g. `Refused to frame ... frame-ancestors 'self'`).
Also worth reporting: because precache entries are revision-pinned to file content, a headers-only deploy never invalidates the cached `index.html`.

### SW takeover in old profiles: log state, never assume
Historically (before PR #126) `injectRegister: false` + a bare `navigator.serviceWorker.register('/sw.js')` in `app/src/main.ts` meant a new `sw.js` stayed `waiting: true` no matter how many reloads, and only closing **all** origin tabs / restarting with the same `--user-data-dir` handed over control. Since PR #126 added `skipWaiting: true` + `clientsClaim: true` to the workbox config, **one top-level reload is enough** (measured: new SW `activating` ~6s after a single reload, `waiting` never true, tab stayed open).
**Critical**: `navigator.serviceWorker.controller` being truthy does NOT tell you *which* SW is in control — the old one is a controller too. Use a cache fingerprint as the discriminator, e.g. precache entry count and whether `index.html` is present (#125: 51 entries / 0 html; #126: 52 entries / 1 html). Always log `registration.active.state` + `!!registration.waiting` + per-cache `keys().length` and html count, sampled over ~12s, before concluding anything.
Also beware: the deployed precache manifest count can differ from what a PR description claims (PR #126 said 55→56, production showed 51→52) — report the production numbers. Note: closing the last tab via `Target.closeTarget` kills the whole browser — that is fine (relaunch with the same user-data-dir), but re-launch on a fresh debugging port.

### Offline testing: page-level offline does NOT apply to the service worker
`Network.emulateNetworkConditions {offline:true}` only affects the **page** target; the SW's own `fetch` still hits the real network (symptom of a false pass: an un-cached route still loads fresh content offline, and the runtime cache gains new entries). headless chromium 121 does not even expose a `service_worker` target via `Target.getTargets`, so you cannot scope offline to it.
→ Cut the network at the browser level instead: relaunch Chrome with the same `--user-data-dir` plus `--host-resolver-rules="MAP www.seatmark.cn 127.0.0.1"` (nothing listens on local :443 → connections refused for page *and* SW). Always add a control proving the disconnect is real (see next paragraph for which control is valid under the current SW config).
Current expected offline behaviour (after PR #126): `pages` NetworkFirst cache serves previously visited routes offline, and **never-visited SPA routes also work** via `precacheFallback: {fallbackURL: '/index.html'}` (shell + client-side routing). So the old "uncached route must show ERR_FAILED" control no longer proves the network is really cut — instead prove it with (a) an in-page `fetch('https://www.seatmark.cn/api/quota')` that must reject with `Failed to fetch`, and (b) the `pages` cache gaining **no** new entries during the offline run.
Good offline assertions: `/guides` must render 「教程中心」/「共 N 篇教程」, `/pricing` must render 「定价方案」/「定价常见问题」, `/` must render hero 「上传 Excel，批量生成」. Note `/tutorials` is **not** a router route (`app/src/router/index.ts`) — offline it renders the app's own 「404 NOT FOUND」 view, which is still a pass for shell fallback.

### Root path `/` and the precache `directoryIndex` trap
workbox's precache route maps `/` to the precached `index.html` via `directoryIndex` (default `'index.html'`) and is registered **before** `runtimeCaching`, so while that default was in effect (PR #126) navigations to `/` never entered the `pages` cache even though `/studio`, `/templates` did. PR #127 set `directoryIndex: ''`, after which `/` goes through the navigate NetworkFirst rule and **does** appear in `pages`.
Useful assertions: navigate `/studio` → `/` → `/templates` in order and diff `caches.open('pages').keys()` after each step — `https://www.seatmark.cn/` must be added by the `/` step. Also check the stored entry's `date` header is the current run time (proves a network fetch, not an old copy).
Reading response headers: in headless chromium 121 the **main-frame Document** `Network.responseReceived` event is not delivered to the page session, so read what the SW would actually serve via `caches.open(k).match(req)` → `res.headers.get('x-frame-options'/'content-security-policy'/'strict-transport-security')`, and use a cross-origin iframe navigation as the second source.

### SW update semantics: the triggering navigation is still served by the OLD worker
Even with `skipWaiting`+`clientsClaim`, the reload that discovers a new `sw.js` is answered by the **old** worker; the new one activates during/after it (`active: 'activating'` shows up ~4-6s later) and handles the **next** navigation. So any cache-write fingerprint (e.g. `pages` `/` entry `date` refreshing) must be checked on a **second** navigation — checking only the triggering reload looks like a failure when behaviour is actually correct. When #N and #N+1 builds have identical precache fingerprints, use these behavioural fingerprints instead: presence of a new `active: 'activating'` transition, and cache entries being rewritten with fresh `date`s.

## Clickjacking test harness
Local attacker page at `/tmp/r103web/frame.html` + `frame2.html`, served by `python3 -m http.server 8099` in that dir; it embeds `https://www.seatmark.cn/studio` in an iframe. Pass = blank iframe + security console error; always add a control (top-level navigation to the same URL must render).

## Studio flows via CDP
- Import: pick the `input[type=file]` whose `accept` contains `xlsx` (index it from `document.querySelectorAll`), then `DOM.setFileInputFiles`. Success signals in page text: `共 N 条数据`, `N 个标签` (the transient toast is often gone by the time you screenshot).
- PNG export: click the `图片 PNG` toolbar button → dialog. **There is no separate "confirm/export" button**: clicking the export-mode card (`无水印导出（今日剩余 N 次）` or `带水印导出（不限次数）`) starts the export immediately. Unauthenticated quota is 1 watermark-free export/day, so use `带水印导出` for repeatable tests. Set `Page.setDownloadBehavior` first; multi-label exports arrive as a `.zip` (verify with `zipfile`, extract a PNG and eyeball it).
- Print: the print host mounts only briefly. Stub `window.print = () => { window.__printed = 1 }`, click `打印 / 矢量 PDF`, then click an export-mode card in the resulting dialog (the button alone does not print), poll `window.__printed`, and call `Page.printToPDF({preferCSSPageSize: true})` the moment it flips to 1. Inspect with `pdfinfo` / `pdftoppm`.

## Stress / weak-network testing (round 109 learnings)
- Scale: 签到桌牌版 lays out 10 labels/page, so N rows → N/10 pages; 640 rows = 64 pages. Full image-PDF export of 64 pages ≈ 68 s, 320-label PNG zip ≈ 33 s. During export the loading overlay shows `正在渲染第 N/M 页...` and a `取消导出` button; cancel fires toast `已取消导出` and must leave zero files in the download dir. UI responsiveness can be proven by timing `Runtime.evaluate` heartbeats (expect < 1 s each) while the export runs.
- Long-text pitfall: the Studio preview truncates overlong names/cells with a single-line ellipsis, but exported PNG/PDF may render them as two overlapping lines (WYSIWYG divergence) — always compare preview pixels vs export pixels for 20+ char inputs.
- Weak-net first visit: use a fresh `--user-data-dir` + `Network.emulateNetworkConditions` (Chrome Slow 3G = latency 2000 ms, throughput 500*1024/8*0.8). The page is prerendered: static HTML is visible ~2.5 s, then hydration may blank `<main>` for ~2–3 s while the lazy-loaded route chunk (e.g. HomeView) downloads. Sample `document.querySelector('main').innerText.length` every ~0.5 s to catch the blank window; a single late screenshot will miss it. (Fixed in #131: mount now waits for `router.isReady()`, so no blank window should appear.)
- To prove *absence* of a transient blank window, CDP round-trip sampling (~0.8 s) has gaps — inject an in-page `Page.addScriptToEvaluateOnNewDocument` with `setInterval(200ms)` recording `main.innerText.length` from document start, then read `window.__samples` at the end for gap-free evidence.
- Headless Chrome on this box can take ~10+ s to open its debug port; retry `curl /json/version` a few times before assuming failure.
- Toasts are short-lived — poll the toast container every ≤0.3s from the moment of the triggering action (draining events first, then reading, misses them). When asserting glyph/font behavior, first probe the test browser's own font coverage with the same canvas method as the product; beware that one astral char in a text run can make the entire line render as tofu on font-poor Linux/headless environments.
- Export-dialog dropdowns (e.g. `#png-unit`) are custom SelectField components (button + option list), not native `<select>` — setting `.value` via JS is a silent no-op; click the trigger then the option text. Transient loading-overlay phases can last <0.5s; sample/screenshot at ≤50ms intervals to capture the final phase pixels.

- Lighthouse audits: the first `npx lighthouse` run in a session can be a cold-start outlier (Perf 15+ points low) — always take ≥3 runs of key pages and use medians. `/studio` mobile LCP jitters ±40% between runs. Current baselines (r118): home mobile Perf≈91/LCP≈1.9s, studio mobile Perf 71/LCP 4.79s/TBT 356ms, CLS 0 everywhere, SEO 100; raw JSONs in `/home/ubuntu/r117_lighthouse/` and `/home/ubuntu/r118_lighthouse/`.

## Analytics & console checks
Analytics are injected after `load` via `requestIdleCallback`. Collect `Network.requestWillBeSent` for ≥12 s and assert hits for `gtag/js`, `hm.baidu.com/hm.js`, `zz.bdstatic.com`, `clarity.ms`. Ignore Chrome's `Blocked third-party cookie` warnings — they are pre-existing noise.

## Lighthouse
`npx -y lighthouse@13.4.1 <url> --only-categories=performance,best-practices --form-factor=mobile --screenEmulation.mobile --throttling-method=simulate --output=json --output=html --output-path=<dir>/<name> --chrome-flags="--headless=new --no-sandbox"`.
Baselines (`/` mobile): Perf 92–95, CLS 0, Best Practices **58** — BP is capped by third-party cookies from Clarity/Baidu plus an `unload` deprecation, and security headers do not raise it. Root-document response time fluctuates (60 ms – 3.2 s); re-sample before calling it a regression.

## Known production limitations
`x-seatmark-storage: memory` (KV unbound) → rate limits ineffective, short share codes unreadable, and `/api/auth/code` returns 502 (SES unconfigured) so **login-gated flows cannot be tested online**. Report them as untested rather than guessing.

## Devin Secrets Needed
None for production read-only/UI testing.

## Excel import fidelity testing
Craft workbooks with openpyxl using real cell types + number formats (openpyxl can't cache formula values — inject `<v>` into `xl/worksheets/sheet1.xml` and add `t="str"` on the `<c>`, removing any empty `<v/>`), then pre-read with the product's own `app/node_modules/xlsx` (`sheet_to_json({header:1, raw:false})` gives the Excel-visible text) to establish exact expectations before UI testing. Studio field-mapping dropdowns are custom SelectFields: click the trigger button next to the field label, then click the option text. When reusing prior-round scripts, change output paths to the current round number first to avoid overwriting old screenshot evidence.

## A11y audits
axe-core 4.10.2 lives in `/home/ubuntu/a11y/node_modules/axe-core/axe.min.js` — inject via CDP Runtime.evaluate then `axe.run(document,{resultTypes:['violations']})` with awaitPromise. Dedupe by rule id + root component. Historical a11y baselines (rounds 35–37) are not in the repo; classify new-vs-preexisting via `git log -S`. Keyboard checks: use Input.dispatchKeyEvent rawKeyDown/keyUp (modifiers=8 for Shift+Tab); the designer only opens after clicking 打开可视化设计器 which may need scrollIntoView + retry.

## Designer (390 viewport) specifics
Layer-list rows are small buttons that JS text-matching can mis-target after renames — screenshot the open 字段列表 panel and click by pixel coordinates instead. The 示例内容 input only renders for text fields whose 内容来源 is an Excel column (v-else-if branch), so select e.g. 姓名 rather than the fixed-text 提示语 before asserting it. Always exit the designer via 取消 to discard draft edits made during testing.
