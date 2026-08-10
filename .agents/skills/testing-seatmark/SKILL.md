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

## Rare-CJK font testing
Assert with `CSS.getPlatformFontsForNode` (expected `Plangothic P1` for ext-B chars, template font for common chars) plus pixel screenshots — `document.fonts.check` / computed font-family alone can pass while the element still renders `.notdef`. When counting font-pack network requests, use a cold Playwright browser with a `page.on('request')` listener — a reused 9222 tab's performance entries can contain cache re-fetches from earlier sessions and overcount.

## Print-channel physical accuracy testing
The print host (`.offscreen-host`) unmounts 1.5s after window.print (printing.ts fallback) — to capture output, stub `window.print=()=>{}` and wrap `setTimeout` to stretch the 1500ms delay before clicking, then call CDP `Page.printToPDF` with `preferCSSPageSize:true` and dispatch `afterprint` to release the flow. Firefox can print silently to PDF via prefs `print.always_print_silent` + `print_printer='Mozilla Save to PDF'` + `print.printer_Mozilla_Save_to_PDF.print_to_filename`. Measure grids by rendering with pypdfium2 at 600dpi and taking row/column darkness profiles; expect ~0.1mm pt-quantization on page size (Chromium 594.96pt, Firefox integer pt) — don't flag it as a product bug. The paper-type picker is a custom `[role=combobox]` (text 「不使用纸型」), not a native select.

## A11y audits
axe-core 4.10.2 lives in `/home/ubuntu/a11y/node_modules/axe-core/axe.min.js` — inject via CDP Runtime.evaluate then `axe.run(document,{resultTypes:['violations']})` with awaitPromise. Dedupe by rule id + root component. Historical a11y baselines (rounds 35–37) are not in the repo; classify new-vs-preexisting via `git log -S`. Keyboard checks: use Input.dispatchKeyEvent rawKeyDown/keyUp (modifiers=8 for Shift+Tab); the designer only opens after clicking 打开可视化设计器 which may need scrollIntoView + retry.

## Designer (390 viewport) specifics
Layer-list rows are small buttons that JS text-matching can mis-target after renames — screenshot the open 字段列表 panel and click by pixel coordinates instead. The 示例内容 input only renders for text fields whose 内容来源 is an Excel column (v-else-if branch), so select e.g. 姓名 rather than the fixed-text 提示语 before asserting it. Always exit the designer via 取消 to discard draft edits made during testing.

## Paper picker DOM & release-lock behavior (since #150)
As of the #150 build the paper-type picker is a `button[aria-haspopup=listbox]` (no longer `[role=combobox]`) — update CDP selectors accordingly. 「不使用纸型（自由排版）」 now releases an active paper lock (toast 「已取消纸型锁定」, restores design-template page/label and scales fields back); it is a guarded no-op when nothing is locked. CAUTION: never run `git checkout origin/main -- .` in the repo — it clobbers the accumulated test-report.md; if that happens, the history may be recoverable from `git stash` entries.

## eink/PNG-export & designer automation notes
Open the PNG panel via the 「图片 PNG」 button first — the 分辨率预设 select only exists inside it; export downloads may land in `~/Downloads` even after `Page.setDownloadBehavior` (also set `Browser.setDownloadBehavior` at the browser WS, and diff-glob Downloads before/after). `DOM.setFileInputFiles` needs a nodeId from `DOM.getDocument`+`DOM.querySelectorAll` — a nodeId via `DOM.requestNode` from a Runtime objectId may silently not fire the change handler. Designer HEX text inputs ignore synthetic input events; set the sibling `input[type=color]` instead. For share-link restore tests use `Target.createBrowserContext` for a truly clean localStorage — but the new tab has the same /studio URL, so match tabs by exact URL/query. Verify glyph correctness without a display by rendering PNG ink regions to ASCII art with PIL/numpy.

## PNG panel exact-width input & naming (since #151)
In the PNG panel the exact-pixel custom width input is `#png-exact-width` — do NOT set "the first visible input[type=number]", that is the template label width (mm) and mutating it silently changes the template aspect ratio and all derived export sizes. The PNG panel closes after each export; re-click 「图片 PNG」 before the next one. Since #151, exact-pixel zip/png names carry a `-{w}x{h}-` suffix reflecting the actual derived output size; standard-clarity names have no suffix.

## Designer HEX input & template panel pinning (since #152)
Designer HEX text inputs DO accept real keyboard input — send CDP `Input.dispatchKeyEvent` char events (put `text` only on the `char` event, not on `keyDown`, or characters double) then Enter; the invisible sibling is an `input[type=color]` overlay with the same `#value`, so select the hex field with `input[type=text]` + `/^#/` filter. Since #152, custom (non-builtin) templates are pinned first in the collapsed 3-card template area; the delete confirm modal's confirm button is a second visible 「删除」 next to 「取消」.

## Multi-tab storage testing & quota-full toasts (since #153)
Layout-panel number inputs need BOTH `input` and `change` events dispatched (or real keyboard + blur) for the Vue model to update — an `input`-only synthetic event leaves the model stale and fakes a "silent revert". When testing quota-full workspace persistence, note localStorage same-size overwrites of an existing key succeed even when full; delete `seatmark.workspace-template.v1` first so the debounced write genuinely throws. Since #153 the custom-template store syncs from storage before each mutation and listens to `storage` events, so multi-tab panels update live. On the 29229 headless Chromium, `Page.captureScreenshot` on a background tab hangs — `Page.bringToFront` first. Since #154, quota-full saves show only the danger toast (no success toast).

## Toast-absence assertions (since #154)
Save-success toasts (designer save, shared-template save, JSON import, cloud restore) are gated on `templateLibrary.lastPersistOk` — quota-full saves show only the danger toast. When asserting "toast X absent", match the full `document.body.innerText` against all toast strings AND pixel-verify the fixed toast area (crop right-3/bottom-20, max-w-80 ≈ x 1040-1440 of a 1440-wide full-page shot); expect a concurrent workspace warning toast in quota-full states, which is intended #153 behavior.

## Photo re-upload reminder & photo-match controls (since #155)
The roster sessionStorage payload carries hadPhotos/photoColumn; reload with hadPhotos=true fires an info toast 「照片需重新上传」 ~0.5s after load that auto-dismisses in a few seconds — poll for it immediately after Page.reload (0.4-0.5s intervals), don't wait for full page settle or you'll miss it; grab the toast element's getBoundingClientRect at detection time to crop pixel evidence. The photo-match column is a `button[aria-haspopup=listbox]` labeled 「请选择 Excel 中的一列」 next to the 「照片匹配」 label; photo upload is the `input[type=file][accept="image/*"]`; photo filenames must equal/contain the selected column's cell values to match.

## Large-roster export testing (round 141)
For large-roster export tests always use 「带水印导出」 (free & unlimited) — the watermark-free path burns the anon 1/day quota (`seatmark.clean-export-usage.v1`). The PNG zip naming mode is a `button[aria-haspopup=listbox]` labeled 「序号命名（前缀-001.png）」 (not radios); switching to 按名单字段命名 auto-fills `{姓名}`. Field-mapping selects are the `button[aria-haspopup=listbox]` elements reading 「未映射」. Export progress lives in `document.body.innerText` as 「正在渲染第 i/N 页...」 with a visible 「取消导出」 button; downloads may land in ~/Downloads despite Browser.setDownloadBehavior — always diff both dirs. 1000 rows ≈ 47KB roster payload, far below sessionStorage quota, so the over-quota skip branch can't be triggered naturally.

## Anon clean-export quota & site search (round 142)
Anon clean-export quota is 1/day in localStorage `seatmark.clean-export-usage.v1`, consumed only AFTER a successful export (cancel/fail don't deduct) — test cancel-not-deducted BEFORE spending the quota. When exhausted, clicking 无水印导出 opens QuotaLimitDialog instead of exporting; the export-button badge switches to 「带水印免费」. Watermark pixel-proof: export clean then watermarked with identical params and diff — the watermark sits in the bottom band (~y 96% of an A4 3509px page). /templates & /guides search accept full pinyin and initials via utils/pinyin.ts; empty states are 「没有匹配“q”的模板…」 and 「该条件下暂无教程…」, both followed by recommendation cards (so count visible cards excluding the fallback section).

## WebKit mobile testing (round 143)
WebKit mobile testing: `sudo apt-get install libgles2 gstreamer1.0-libav` + `python3 -m playwright install webkit`, then launch with `PLAYWRIGHT_SKIP_VALIDATE_HOST_REQUIREMENTS=1` (host validation false-positives after deps are installed). On the 390px mobile layout the export buttons only exist in the 「预览」 tab — tap 预览 first. Single-page PNG exports download a bare .png, not a zip. The rare-CJK Plangothic fallback toast only fires on devices whose fonts lack the glyphs — Linux Noto CJK covers ext-B, so that branch can't be triggered locally; verify rendering (no tofu) instead.

## Full template-library sweeps (round 144)
Full-library sweeps: extract expected values (mappable count, demo dataset via resolveDemoDataset, paper fits via evaluatePaperFit) with `npx vite-node` importing the app's TS data files directly (export is `labelPapers`, not LABEL_PAPERS). Deep-link `/studio?template=<id>&demo=1` applies template + scenario demo data; the preview page element is `.sheet-page`. Don't trust `seatmark.workspace-template.v1` read ~1s after navigation for the template name — the debounced persist can still hold the previous template (false mismatch); recheck individually or read the rendered preview. Run sweeps in ONE sequential tab: parallel CDP tabs starve background tabs and every screenshot times out. New tab endpoint needs `PUT /json/new`, not GET.

## Paper-type testing (round 145)
Paper-type testing: the studio paper SelectField auto-displays a slug when the template's default page/label dims match a spec (matchLabelPaper) — a template can appear "locked" to a new paper with zero clicks, so to exercise the lock toast select 「不使用纸型」 first then re-select. Options are `[role=option]` buttons inside the SelectField dropdown (custom component, no native select); re-read the button's bounding box AFTER scrollIntoView settles or CDP clicks land off-target. `/studio?paper=<slug>` deep link auto-switches to the best-fitting template with toast 「已换用适配该纸型的模板」 when current template doesn't fit. Standard's native paper is a4-24up (not 21up). Export grid geometry can be pixel-verified at 2481px/210mm ≈ 11.81 px/mm using the spec's margins/gaps.

## Malformed-input testing (round 147, hardened in #159)
CDP file injection: pass `objectId` straight to `DOM.setFileInputFiles` — routing through `DOM.requestNode`→nodeId silently fails to fire the change handler. Share-hash (#tpl=) testing MUST use a fresh tab: same-tab navigation from /studio to /studio#tpl=… is a hash-only change that never remounts StudioView, so handleShareHash won't run (false negatives). Since #159, renamed/garbage `.xlsx` without a ZIP `PK` header is rejected with 「不是有效的 .xlsx 工作簿」 (SheetJS CSV/text fallback no longer fires for .xlsx; .xls/.csv unaffected), and photos are magic-byte sniffed (JPEG/PNG/GIF/WebP/BMP/ftyp/SVG) — fake images land in the photo-error list, truncated-but-valid-header JPEGs still pass. Password-protected xlsx gets the generic 文件解析失败 message.

## Cut-line rendering & export forensics (rounds 150–154)
html2canvas-pro 2.0.4 rasterizes solid backgrounds and inline SVG (incl. `<line stroke-dasharray>`), but NOT dashed borders on zero-width elements and NOT repeating-linear-gradient backgrounds — decorations relying on those silently vanish from PNG/图片版 PDF exports while preview looks fine; always verify exports at pixel level, never by preview. Since #162 cut lines are an inline `<svg viewBox="0 0 paperW paperH">` with `line.cut-line` children. To capture REAL browser-print output headlessly: override window.print to delay afterprint ~10s (keeps the print host mounted), then CDP Page.printToPDF with printBackground:true. Export zips are named `模板名-YYYYMMDD-HHMM.zip` — same-minute exports collide and CDP `allow` download mode silently overwrites; whole-page exports stall in backgrounded tabs (rAF throttling), so run exports in ONE foreground tab sequentially. Right after an EdgeOne deploy flip there's a ~20-min edge-propagation window where exports can still show OLD behavior (even mixed JS/CSS layouts) despite the new bundle — wait and re-run before judging a fix failed. The PNG export dialog defaults to 按标签逐张导出; switch the first listbox to 按整页导出 for whole-page tests. Template deep-link ids must be exact (`?template=aurora` silently falls back to standard; the aurora tent is `deluxeConfAurora`).

## Deploy-flip polling addendum (round 168)
sw.js and the entry bundle may flip at DIFFERENT times (observed sw.js ~30s before index-*.js in r168) — require BOTH indicators changed AND a confirming re-sample before testing, never just one. Current /seating seat-no baseline (r168, #177): color #475569 / rgb(71,85,105), contrast 7.58:1 white, ~6.95:1 on blue-50/pink-50 gender-tinted cells.

## Contrast/visual checks on /seating (round 166)
Assert computed styles only AFTER clicking 「用演示名单」 and waiting for `.seating-seat-name` to show real names — the empty pre-roster grid returns inherited styles (16px/oklch) and will false-fail. Demo roster includes gender, so seat cells default to blue-50/pink-50 tinted backgrounds (`seating-seat--boy/--girl`) — compute contrast against the EFFECTIVE ancestor background, not just white; the sheet (`.seating-sheet`) itself is pure white.

## SW takeover (#126 verified r164)
sw.js uses skipWaiting+clientsClaim — after a JS-touching deploy, a tab controlled by the old SW loads the NEW entry bundle after a SINGLE reload (waiting=null). Judge takeover by "loaded entry hash = new + registration.waiting=null"; the workbox precache cleans OLD entries ASYNCHRONOUSLY after activate (you may transiently see old+new entries, e.g. 57→61→57, and hasNew=false right after reload) — poll a few seconds before asserting on precache contents.

## Guides QA & sample Excel (round 162)
Guide content lives in app/src/data/guides*.ts (6 files, currently 76 slugs across 13 categories — recount before sampling, the total grows). quickStart CTAs are `{label,to}` RouterLinks (`一键载入…`/`打开…`); valid template deep-link ids seen in guides: standard, meetingTent, weddingPlace. Sample-Excel download (导入面板「下载样例 Excel」) is client-side XLSX.writeFile named `<sheetName>样例.xlsx`, headers follow the CURRENT template's scenario — capture via Browser.setDownloadBehavior at the browser WS. npm audit highs are all transitive via vite-plugin-pwa→workbox-build/vite (build-time only, not shipped); don't panic-upgrade.

## Perf auditing (round 161)
Use `npx lighthouse 13.x` with default mobile emulation / `--preset=desktop` (same rig as rounds 98/117/118/161); /studio mobile LCP jitters ±40% and cold first runs of any page score low — always take ≥3-run medians and discard cold outliers before judging regressions. Current medians (r161, index-DTLWjJ7n): / mobile Perf 91·CLS 0, desktop 100·CLS 0; /templates mobile 75; /studio mobile 82.5·LCP 3.69s; /vs & /desk-card-generator mobile 98-100. BP is stuck at 58 from analytics third-party cookies (expected, not a regression). /studio has TWO file inputs — the first is JSON import; inject Excel into the one whose accept includes .xlsx or the import silently no-ops.

## /seating testing (round 160)
Seat cells are `[data-seat-no]` with name in `.seating-seat-name` (first innerText line is the seat NUMBER — don't compare by line 0). Drag-swap sets an internal suppressClick that swallows the NEXT Enter/click, so keyboard-swap (#123) tests must run from a clean state (reload first). Persistence key `seatmark.seating-state.v1` (incl. arranged order), handoff key `seatmark.seating-handoff.v1` → /studio?from=seating auto-switches to deskName only when <half the mappable fields match. In headless Chromium `navigator.clipboard.writeText` fails silently WITHOUT the failure toast — shim writeText to capture the share URL before clicking 复制当前模板分享链接.

## Deploy-flip detection (round 159)
Don't poll only the entry bundle hash — manifest-only (or other non-precached asset) changes flip WITHOUT changing `index-*.js` or sw.js (manifest.webmanifest is not in the precache globPatterns). Poll the artifact that actually changed (e.g. `curl manifest.webmanifest | jq .lang`). A new SW version only exists if sw.js content (md5) changes; SW-takeover tests require a deploy that touches js/css/html.

## Multi-sheet & CSV encoding (round 157)
Multi-sheet workbooks import the FIRST sheet immediately (toast「文件含 N 个工作表，可在导入面板切换」); the sheet switcher is a native `<select>` in the import panel listing sheet NAMES (not a dialog/button) — drive it with select.value + change event. CSV encoding after #165: UTF-8 (BOM optional) and GB18030 both work; only `.csv` non-ZIP files take the string-decode path, so the #159 PK-magic rejection for renamed .xlsx still applies.

## PWA / offline testing (round 156)
Precache is `workbox-precache-v2-https://www.seatmark.cn/` (~57 entries; plangothic fonts intentionally excluded); navigations are NetworkFirst(4s) with precacheFallback to index.html, so ANY route opens offline and the SPA renders full content client-side (guides data is in the bundle) — don't expect a bare shell. Whole-page PNG export of a SINGLE page downloads a bare `.png`, not a `.zip` — don't filter downloads by .zip. Anonymous clean-export quota is pure localStorage (`seatmark.clean-export-usage.v1`), so offline doesn't change quota behavior. Rare-glyph fallback warnings may be untestable headlessly: Noto CJK covers most Ext-B/C chars so the extension-font download path never triggers. Since #165, CSV import decodes UTF-8 (strict, BOM stripped) then falls back to GB18030 — plain UTF-8 and GBK CSVs both parse; write test CSVs in any of the three encodings.

## SEO acceptance (round 155)
Production pages are prerendered static HTML, so curl is authoritative for title/canonical/OG/JSON-LD (script tags carry data-route-jsonld attrs). /vs detail pages emit Article+FAQPage+Breadcrumb; topic landing pages emit SoftwareApplication+HowTo+FAQPage+Breadcrumb (seo.ts ~420-465). Factuality source of truth for competitor claims: docs/competitive-round3.md + docs/competitive-analysis.md.

## SEO / link audits (round 146)
SEO/link audits can be pure-curl: every route is prerendered static HTML with title/description/canonical/JSON-LD/OG inline, and unknown routes return a REAL HTTP 404 (noindex, canonical /404) — no SPA-200 fallback, so curl status codes are authoritative for dead-link checks. JSON-LD script tags carry a `data-route-jsonld` attribute (regex needs `[^>]*` after the type attr). llms.txt embeds a bare-domain URL immediately followed by a fullwidth paren — restrict URL regex to legal URL chars or you'll get a fake unreachable URL. CDP websocket connections now require `suppress_origin=True` (Chromium rejects 127.0.0.1 origin with 403 otherwise).

## PNG artifact facts (round 169/170)
Exported PNGs historically carried NO pHYs chunk — since the round-170 fix, standard-mode whole-page and per-label PNGs embed pHYs (A4@300dpi = 11811 px/m; verify with Pillow `img.info['dpi']` or zlib-free chunk scan), while exact-pixel (eink) exports intentionally omit it. Pixel size stays authoritative (A4@300dpi = 2481×3509). Per-label export of a 24-label template downloads a `.zip` even in "each" mode; the export-mode picker is a listbox opened via the button containing 按标签逐张导出. Router scrollBehavior restores savedPosition via double-rAF — back/forward scroll assertions need a short settle wait. /templates thumbs are all aria-hidden decorative; their tiny gray glyphs (~2.6:1) are exempt from WCAG 1.4.3.

## PNG pHYs baseline & CDP download gotcha (round 170, #180)
Standard-mode PNGs (whole-page & per-label) now carry pHYs=11811 px/m (unit=meter, ~300dpi); exact-pixel/eink exports intentionally have NO pHYs and stay pure 2-color. CDP gotcha: `Browser.setDownloadBehavior` dies when its browser-level WS closes — re-connect the browser WS and re-set downloadPath inside EVERY export script, or exports toast success but nothing lands on disk. Deep-links `/studio?template=eink800&demo=1` / `?template=deskName&demo=1` are the fastest way to switch templates; the export dialog's actual trigger is the 「带水印导出」/「无水印导出」 quota buttons, not a generic 导出 button.

## Small-label pHYs baseline (round 171)
Templates narrower than ~84.7mm trigger pngRasterScale upscaling (min output width 1000px, max 8x) — per-label pHYs then equals round(output.width/labelWidthMm×1000), e.g. drinkCup 36mm → 1000px @ 27778 px/m (~706dpi); whole-page export of the SAME template stays at 2481×3509 @ 11811 px/m. Handy small templates: drinkCup/libraryCall/mailboxLabel/spaHook/weddingCandy (36mm), kidsCup (40mm) — deep-link via /studio?template=<id>&demo=1.
