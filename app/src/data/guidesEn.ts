/**
 * /en/guides 下的英文原生教程：面向英文搜索词撰写（非中文教程的逐条翻译），
 * 数据结构与中文教程一致（Guide），由 GuidesView/GuideArticleView 按 locale 取用。
 */

import type { Guide } from './guides'

export const enGuides: Guide[] = [
  {
    slug: 'wedding-seating-chart-from-excel',
    title: 'How to make a wedding seating chart from Excel',
    description:
      'Turn an Excel or CSV guest list into a printable wedding seating chart and matching place cards in your browser — nothing is uploaded.',
    keywords: [
      'wedding seating chart',
      'seating chart from excel',
      'wedding place cards',
      'printable seating chart',
      'guest list to seating chart',
    ],
    category: 'Weddings',
    audiences: ['Couples', 'Wedding planners', 'Venue staff'],
    datePublished: '2026-11-06',
    dateModified: '2026-11-06',
    readingMinutes: 6,
    howTo: {
      name: 'Make a wedding seating chart from an Excel guest list',
      steps: [
        {
          name: 'Prepare the guest list',
          text: 'Put one guest per row in Excel or CSV with at least a name column; add a table or group column if you already have assignments.',
        },
        {
          name: 'Open SeatMark and import',
          text: 'Open the studio, pick a wedding place-card template, and import the file. Headers map to fields automatically.',
        },
        {
          name: 'Lay out tables and seats',
          text: 'In the banquet seating view, create round or long tables, then drag guests from the list onto seats. Unseated guests stay in a side list.',
        },
        {
          name: 'Generate matching place cards',
          text: 'The same roster drives the place cards — names and table numbers fill in automatically on the print layout.',
        },
        {
          name: 'Export and print',
          text: 'Export the seating chart and cards as PDF on A4/A3, print at 100% scale, and cut along the guides.',
        },
      ],
    },
    faqs: [
      {
        q: 'Do I have to upload my guest list?',
        a: 'No. The file is parsed locally in your browser — names, groups and photos never leave your device. After the first load, the tool also works offline as a PWA.',
      },
      {
        q: 'What if my guest list changes at the last minute?',
        a: 'Edit the roster or move guests between tables and the chart and place cards re-render instantly — no need to redo a merge or reformat anything.',
      },
      {
        q: 'Can I print per-table guest lists for the welcome desk?',
        a: 'Yes. The seating chart exports as PNG or PDF, and the per-table roster can be printed or exported to CSV for check-in.',
      },
      {
        q: 'Does it handle non-English or accented names?',
        a: 'Yes. Names render in the fonts available on your system, and SeatMark ships an extended CJK font so rare characters in Chinese, Japanese and Korean names do not come out blank.',
      },
    ],
    related: ['print-place-cards-from-excel', 'escort-cards-vs-place-cards', 'wedding-table-numbers-printable'],
    quickStart: {
      label: 'Try it with a sample guest list',
      to: '/studio?demo=1&scene=wedding',
      note: 'Opens the studio with demo data — replace it with your own list in one paste.',
    },
    body: `
<h2>Why start from a spreadsheet</h2>
<p>Most couples already have their guest list in Excel, Numbers or Google Sheets — RSVPs, meal choices, plus-ones. Re-typing two hundred names into a seating tool is exactly the kind of work a spreadsheet should spare you. SeatMark reads that list directly and turns it into two things you actually need on the day: a <strong>seating chart</strong> for the entrance, and a set of <strong>place cards</strong> for the tables.</p>
<p>Everything runs in your browser. The file is parsed locally, so a guest list with contact details or dietary notes never touches a server — useful when you are handling family data.</p>

<h2>Step 1 — Shape the list</h2>
<p>One guest per row, first row as headers. A <code>name</code> column is the only requirement; a <code>table</code> or <code>group</code> column lets you pre-assign seats. Extra columns (meal choice, RSVP status) ride along harmlessly.</p>
<ol>
  <li>Save or export the sheet as <code>.xlsx</code> or <code>.csv</code>.</li>
  <li>If names sit in several sheets, keep them — multi-sheet workbooks import sheet by sheet.</li>
  <li>Watch for trailing spaces in names; they can split one guest into two rows visually.</li>
</ol>

<h2>Step 2 — Import and pick a template</h2>
<p>In <a href="/en/studio">the studio</a>, choose a wedding place-card template, then import the file. Column headers are matched to card fields automatically — check the mapping once, adjust if a header was not recognised, and every card previews with real names immediately.</p>
<figure>
  <img src="/guides/seating-chart-start.png" alt="Banquet seating maker with guest list input, group colours and venue layout steps" width="932" height="863" loading="lazy" />
  <figcaption>The banquet seating workspace: paste or upload the list, then build the venue layout.</figcaption>
</figure>

<h2>Step 3 — Seat the guests</h2>
<p>Open the banquet seating view and create your tables — round, long, U-shape. Drag guests from the list onto seats; anyone unassigned waits in the side list so nobody gets lost. Changing your mind costs a drag, not a redo.</p>
<figure>
  <img src="/guides/seating-chart-tables.png" alt="Seating floor plan with eight round tables and colour-coded guest names seated" width="932" height="863" loading="lazy" />
  <figcaption>Groups are colour-coded, so a party split across two tables is visible at a glance.</figcaption>
</figure>

<h2>Step 4 — Print the chart and the cards</h2>
<p>Export the seating chart as PDF at A4 or A3 for the welcome board, then export the place cards — names and table numbers already filled. Print at <strong>100% scale</strong> (never "fit to page") and cut along the printed guides. If your printer shifts the output a fraction of a millimetre, run the built-in calibration wizard once and the offset is compensated.</p>

<h2>Common pitfalls</h2>
<ul>
  <li><strong>Scaled printing.</strong> "Fit to printable area" shrinks every card by a few percent and misaligns cuts — always print at 100%.</li>
  <li><strong>Duplicate names.</strong> Two guests with the same name are flagged by the data check; disambiguate before seating.</li>
  <li><strong>Last-minute changes.</strong> Keep the browser tab open on a laptop at the venue — edits re-render instantly and the PWA keeps working even if the Wi-Fi does not.</li>
</ul>`,
  },
  {
    slug: 'print-place-cards-from-excel',
    title: 'Batch print place cards from Excel onto A4',
    description:
      'Batch place cards and table tents from an Excel or CSV list: import the roster, export a print-ready PDF with cut lines on A4 — free, no sign-up, local processing.',
    keywords: [
      'print place cards',
      'place cards from excel',
      'name cards printable',
      'table tent cards',
      'batch place card maker',
    ],
    category: 'Events',
    audiences: ['Event planners', 'Office admins', 'Teachers'],
    datePublished: '2026-11-06',
    dateModified: '2026-11-06',
    readingMinutes: 5,
    howTo: {
      name: 'Print place cards from an Excel list',
      steps: [
        {
          name: 'Prepare the list',
          text: 'One person per row in Excel or CSV with a name column; add title, company or table columns as needed.',
        },
        {
          name: 'Choose a card template',
          text: 'Open the studio and pick a place card or table-tent template — flat cards and fold-over tents are both available.',
        },
        {
          name: 'Import and check the mapping',
          text: 'Upload the file; headers auto-map to fields. Preview shows real names on real cards instantly.',
        },
        {
          name: 'Export the print page',
          text: 'Export as PDF: cards are imposed many-up on A4/A5/A3 with cut lines and, for tents, a fold line.',
        },
        {
          name: 'Print and cut',
          text: 'Print at 100% scale on card stock and cut along the guides. Use the calibration wizard if the print is offset.',
        },
      ],
    },
    faqs: [
      {
        q: 'Is it really free?',
        a: 'Watermarked export is free and unlimited without an account — the mark is a small corner label, not a full-page overlay. Watermark-free export has a free daily quota as well.',
      },
      {
        q: 'Flat cards or fold-over tents?',
        a: 'Both. Flat cards print many-up with cut lines; table tents print upright on both halves with a centre fold line so names read correctly from either side of the table.',
      },
      {
        q: 'My printed cards are slightly off the cut lines — why?',
        a: 'Printers mechanically shift paper by fractions of a millimetre. Print the built-in calibration sheet once, measure two lines, and SeatMark compensates the offset globally — measured error stays within 0.35 mm.',
      },
      {
        q: 'Does my roster get uploaded?',
        a: 'No. Parsing, layout and PDF generation all happen in your browser. Nothing is sent to a server, and the PWA works offline after the first load.',
      },
    ],
    related: ['place-cards-from-google-sheets', 'double-sided-name-tents', 'wedding-seating-chart-from-excel'],
    quickStart: {
      label: 'Make place cards now',
      to: '/studio?template=meetingTent&demo=1',
      note: 'Demo roster included — paste your own list to go live in seconds.',
    },
    body: `
<h2>The job, in one sentence</h2>
<p>You have a list of names in a spreadsheet and you need a printed card in front of every seat — a wedding, a conference, a dinner, a classroom. Editing a Word document two hundred times is how people used to do it. The faster route: feed the list to <a href="/en/studio">SeatMark</a>, get a print-ready PDF.</p>

<h2>Step 1 — The spreadsheet</h2>
<p>First row headers, one person per row. Only the name column is mandatory — anything else (title, company, table number) becomes optional fields you can show or hide on the card.</p>

<h2>Step 2 — Pick the card type</h2>
<p><strong>Flat place cards</strong> tile many-up on a page with cut lines. <strong>Table tents</strong> print the name upright on both halves with a centre fold line — right-reading from both directions, the detail most DIY templates get wrong. Templates cover formal, minimal and decorative styles; a visual designer lets you adjust fonts, size and alignment once for the whole batch.</p>
<figure>
  <img src="/guides/tent-cards-preview.png" alt="Half-page fold-over name tents in the print preview, names upright on both halves" width="932" height="863" loading="lazy" />
  <figcaption>A half-page tent: the name prints upright on both halves and the fold line is marked for scoring.</figcaption>
</figure>

<h2>Step 3 — Import and preview</h2>
<p>Upload the file. Headers map to card fields automatically — <code>name</code>, <code>title</code>, <code>company</code>, <code>table</code> are recognised out of the box. The preview fills with your real names, so layout problems surface before you print, not after.</p>
<figure>
  <img src="/guides/studio-field-mapping.png" alt="Field mapping panel binding spreadsheet columns to card fields" width="932" height="863" loading="lazy" />
  <figcaption>Field mapping: matched columns bind to card fields, unused columns are listed explicitly.</figcaption>
</figure>

<h2>Step 4 — Export, print, cut</h2>
<p>Export the PDF at A4, A5 or A3. Cards are imposed automatically for the sheet size. Print at <strong>100% scale</strong> — "fit to page" is the single most common cause of misaligned cuts. On heavier stock (160–250 gsm) cards stand and cut cleanly.</p>

<h2>If the cut lines are slightly off</h2>
<p>Every printer feeds paper with a small mechanical offset. Run the calibration wizard once — print the ruler page, measure two lines — and the offset is compensated globally. After calibration, measured error stays within 0.35 mm, accurate enough for adhesive label sheets with pre-defined grids.</p>

<h2>Compared with the alternatives</h2>
<p>Mail merge works but makes you build the template by hand and rerun a wizard for every roster change — see our <a href="/en/vs/wps-mail-merge">mail merge comparison</a>. Design tools like <a href="/en/vs/canva">Canva</a> edit one card at a time and have no many-up imposition concept. If your input is a list, a batch tool is simply the right shape of tool.</p>`,
  },
  {
    slug: 'name-badges-from-spreadsheet',
    title: 'Batch name badges and ID cards from a spreadsheet',
    description:
      'Batch event badges, student IDs and photo check-in cards from Excel or CSV — photos match names by file name. mm-accurate A4 layouts, processed locally.',
    keywords: [
      'name badges printable',
      'id cards from excel',
      'event badges batch',
      'photo id cards',
      'student id card maker',
    ],
    category: 'Events',
    audiences: ['Event staff', 'Teachers', 'HR and admins'],
    datePublished: '2026-11-06',
    dateModified: '2026-11-06',
    readingMinutes: 5,
    howTo: {
      name: 'Batch-print name badges from a spreadsheet',
      steps: [
        {
          name: 'Prepare roster and photos',
          text: 'One person per row in Excel/CSV; name the photo files after the person (e.g. surname-name.jpg) for automatic matching.',
        },
        {
          name: 'Pick a badge template',
          text: 'Choose an ID card or badge template in the studio — photo and no-photo variants are available.',
        },
        {
          name: 'Import roster and photos',
          text: 'Upload the spreadsheet, then the photo folder. Photos bind to rows by file name automatically.',
        },
        {
          name: 'Check and export',
          text: 'Data check flags missing photos and duplicate fields; export the imposed PDF on A4 with cut lines.',
        },
        {
          name: 'Print and laminate',
          text: 'Print at 100% scale, cut along the guides, and slot into badge holders or laminate.',
        },
      ],
    },
    faqs: [
      {
        q: 'How do photos match to the right person?',
        a: 'By file name: name each photo after the roster value (for example the student ID or full name) and they bind automatically on import. Mismatches are listed so nothing pairs silently wrong.',
      },
      {
        q: 'Are the photos uploaded anywhere?',
        a: 'No. Photos are read and laid out locally in your browser — critical for student and staff data. They never reach a server.',
      },
      {
        q: 'What card sizes are supported?',
        a: 'Badges impose onto A4/A5/A3 sheets with cut lines for trimming, sized to common badge-holder dimensions. Custom sizes are adjustable in the template designer.',
      },
      {
        q: 'Can I add QR codes or barcodes?',
        a: 'Fields like student ID or ticket number can be rendered on the card; check the template designer for code field support in the current version.',
      },
    ],
    related: ['print-place-cards-from-excel', 'desk-name-tags-from-class-list'],
    quickStart: {
      label: 'Try a badge with demo data',
      to: '/studio?template=withPhoto&demo=1',
      note: 'Photo badge template preloaded — swap in your roster and photo folder.',
    },
    body: `
<h2>Badges are a batch problem</h2>
<p>A conference needs two hundred badges. A school needs three thousand student IDs. A venue needs photo check-in cards for every contractor. Nobody should be pasting photos into a document one card at a time — this is exactly what a roster-driven batch tool is for.</p>

<h2>Step 1 — Roster and photos</h2>
<p>Spreadsheet: one row per person, headers in row one — name, ID number, class or company, role. Photos: name each file after a roster value (the ID number works best — it is unique by definition). <code>20260134.jpg</code> binds to the row where the ID column reads 20260134.</p>

<h2>Step 2 — Choose the template</h2>
<p>Pick a badge or ID-card template in <a href="/en/studio">the studio</a>. Photo templates show portrait, name, ID and organisation; no-photo variants drop the portrait cleanly. Fonts, colours and layout are adjustable once in the designer — every badge in the batch updates together.</p>

<h2>Step 3 — Import and verify</h2>
<p>Upload the spreadsheet, then the photo folder. Photos pair to rows by file name; the data check then flags anything suspicious — a missing photo, a duplicate ID, an empty name cell — before a single page is printed.</p>

<h2>Step 4 — Export and finish</h2>
<p>Export the PDF: badges are imposed many-up on A4 with cut lines. Print at 100% scale on card stock, cut along the guides, and finish in badge holders or laminate. For large runs, the calibration wizard keeps the cut accurate to within 0.35 mm.</p>
<figure>
  <img src="/guides/photo-badges.png" alt="Photo verification badges in the print preview, ten per page with photo areas" width="932" height="863" loading="lazy" />
  <figcaption>Photo badges imposed ten per page — portraits bind to rows by file name on import.</figcaption>
</figure>

<h2>Why local processing matters here</h2>
<p>Student photos and staff IDs are sensitive data by any standard. SeatMark parses the roster and renders every photo locally in the browser — nothing is uploaded, which also means the tool keeps working on flaky venue Wi-Fi once loaded.</p>`,
  },
  {
    slug: 'place-cards-from-google-sheets',
    title: 'Place cards from a Google Sheets guest list',
    description:
      'Export your Google Sheets guest list, import it into SeatMark, and print place cards or table tents in minutes — fields map automatically and nothing is uploaded.',
    keywords: [
      'place cards from google sheets',
      'google sheets place cards',
      'print place cards google sheets',
      'guest list to place cards',
      'place card template',
    ],
    category: 'Events',
    audiences: ['Event planners', 'Couples', 'Office admins', 'Teachers'],
    datePublished: '2026-11-08',
    dateModified: '2026-11-08',
    readingMinutes: 5,
    howTo: {
      name: 'Turn a Google Sheets list into printed place cards',
      steps: [
        {
          name: 'Export from Google Sheets',
          text: 'File → Download → Microsoft Excel (.xlsx). One guest per row, headers in row one — name plus optional table, meal choice or party columns.',
        },
        {
          name: 'Open SeatMark and pick a template',
          text: 'Open the studio and choose a place card or table tent template — the demo roster lets you preview before touching your own data.',
        },
        {
          name: 'Import the file',
          text: 'Upload the .xlsx in the Import step. The file is parsed locally in your browser; headers map to card fields automatically.',
        },
        {
          name: 'Check the field mapping',
          text: 'Confirm each template field is bound to the right column — name to name, table number to table number. Adjust the dropdowns if a header was unusual.',
        },
        {
          name: 'Export and print',
          text: 'Export the PDF (cards are imposed many-up with cut lines) and print at 100% scale on card stock.',
        },
      ],
    },
    faqs: [
      {
        q: 'Does SeatMark connect to Google Sheets directly?',
        a: 'Not yet — you export once (File → Download → .xlsx) and upload the file. Because parsing happens locally in the browser, the round trip is seconds and your guest data never leaves your device.',
      },
      {
        q: 'My sheet has meal choice and RSVP columns — what happens to them?',
        a: 'Extra columns import harmlessly. They show up as unused columns in the field mapping step; bind them to a card field if you want them printed, or leave them unmapped.',
      },
      {
        q: 'Can I paste instead of uploading?',
        a: 'Yes. Copy the cells in Sheets and paste them straight into the import box — tabs and commas are detected automatically, so a quick paste works for short lists.',
      },
      {
        q: 'Will long names break the layout?',
        a: 'Names auto-shrink to fit the card. Preview with your real list and you will see exactly how the longest name renders before you print.',
      },
    ],
    related: ['print-place-cards-from-excel', 'wedding-seating-chart-from-excel', 'escort-cards-vs-place-cards'],
    quickStart: {
      label: 'Open the studio with a sample list',
      to: '/studio?template=deluxeWedBotanic&demo=1',
      note: 'Demo roster included — replace it with your exported sheet in one step.',
    },
    body: `
<h2>From spreadsheet to printed cards</h2>
<p>Your guest list already lives in Google Sheets — RSVPs, plus-ones, meal choices. The last thing you want is to retype every name into a card template. The short path: download the sheet once, import it into <a href="/en/studio">SeatMark</a>, and get a print-ready page of cards back.</p>

<h2>Step 1 — Export the sheet</h2>
<p>In Google Sheets: <strong>File → Download → Microsoft Excel (.xlsx)</strong>. CSV also works. Keep the structure simple — first row headers, one guest per row. A <code>name</code> column is required; <code>table</code>, <code>meal</code> or <code>side</code> columns are optional extras you can map or ignore.</p>
<figure>
  <img src="/guides/studio-import-data.png" alt="SeatMark import panel showing an 18-row guest roster with Name, Table No. and Table columns" width="932" height="863" loading="lazy" />
  <figcaption>Imported rosters show their sheet name, row count and the first few rows so you can sanity-check at a glance.</figcaption>
</figure>

<h2>Step 2 — Import and map fields</h2>
<p>Open the studio, pick a place card template, and upload the file. Column headers are matched to card fields automatically — <code>name</code>, <code>table number</code>, <code>title</code> and similar headers are recognised out of the box. Anything unmapped is listed as an unused column rather than silently dropped.</p>
<figure>
  <img src="/guides/studio-field-mapping.png" alt="Field mapping panel auto-matching guest name and table number columns to card fields" width="932" height="863" loading="lazy" />
  <figcaption>Auto-mapping binds headers to card fields; each binding can be overridden from a dropdown.</figcaption>
</figure>

<h2>Step 3 — Preview, export, print</h2>
<p>The preview fills with real names immediately, so spacing and length issues surface before you print. Export the PDF and print at <strong>100% scale</strong> — "fit to page" shrinks every card and ruins the cut alignment. On 200–250 gsm card stock, the cards stand on their own after a single cut.</p>
<figure>
  <img src="/guides/studio-place-cards-preview.png" alt="Print preview of botanical place cards filled with guest names, ten per page on A4" width="932" height="863" loading="lazy" />
  <figcaption>Ten place cards per A4 sheet — this botanical design is one of several wedding-ready styles.</figcaption>
</figure>

<h2>Faster than Word mail merge</h2>
<p>If you have tried the Word + Avery route, you know the pain: merge fields, label definitions, and a template that misbehaves the moment a name is two characters too long. A roster-driven tool skips the whole merge — see the <a href="/en/vs/wps-mail-merge">mail merge comparison</a> for where each approach fits.</p>`,
  },
  {
    slug: 'double-sided-name-tents',
    title: 'How to print double-sided name tent cards',
    description:
      'Print fold-over name tents where both halves read upright — the detail Word and Avery templates get wrong. Batch from a spreadsheet, fold line included.',
    keywords: [
      'name tent cards',
      'double sided name tent',
      'table tent printing',
      'fold over place cards',
      'tent card template',
    ],
    category: 'Events',
    audiences: ['Event planners', 'Office admins', 'Teachers'],
    datePublished: '2026-11-08',
    dateModified: '2026-11-08',
    readingMinutes: 5,
    howTo: {
      name: 'Print double-sided name tents from a list',
      steps: [
        {
          name: 'Prepare the name list',
          text: 'One person per row in Excel, CSV or a pasted list — name plus optional title, company or table columns.',
        },
        {
          name: 'Pick a tent card template',
          text: 'In the studio, choose a tent (fold-over) template. These print each name upright on both halves of the card with a centre fold line.',
        },
        {
          name: 'Import and preview',
          text: 'Upload the list; headers auto-map. The preview shows both halves so you can confirm orientation before printing.',
        },
        {
          name: 'Print at 100%',
          text: 'Export or print directly at 100% scale on card stock — any scaling shifts the fold line.',
        },
        {
          name: 'Fold along the centre line',
          text: 'Score or crease along the printed fold line and stand the tent up — readable from both directions across the table.',
        },
      ],
    },
    faqs: [
      {
        q: 'Should the back of a tent card be upside down?',
        a: 'No — that is the most common DIY mistake. For a tent to be readable from both sides of the table, both halves must print right-side-up when folded: the top half of the sheet is mirrored onto the bottom half after folding. Tent templates handle this automatically.',
      },
      {
        q: 'How does this differ from running Avery 5305 or 5302 in Word?',
        a: 'Word mail merge onto Avery tent stock requires manually building rotated text boxes and praying the sheet aligns — the most complained-about part of the workflow. Here the imposition, rotation and fold line are already done; you just feed card stock.',
      },
      {
        q: 'What paper should I use?',
        a: '160–250 gsm card stock stands and folds cleanly. Plain copy paper works for a test run but sags on the table.',
      },
      {
        q: 'Can I put a table number or meal icon on the tent too?',
        a: 'Yes — map a second column (table number, role, dietary code) to the secondary field and it prints on both faces together with the name.',
      },
    ],
    related: ['print-place-cards-from-excel', 'place-cards-from-google-sheets', 'desk-name-tags-from-class-list'],
    quickStart: {
      label: 'Try a tent card with demo data',
      to: '/studio?template=meetingTent&demo=1',
      note: 'Large half-page tent template preloaded — swap in your own list in one paste.',
    },
    body: `
<h2>The tent card trap</h2>
<p>A name tent (or table tent) is the folded card that stands on a table so the name is readable from both sides. Sounds trivial — until you try it in Word. The classic mistake: printing one side upside down, so half the room sees a mirrored name. Avery's own templates get the orientation right only if you follow the feed direction exactly, which is why forum threads about tent cards run to dozens of frustrated replies.</p>
<figure>
  <img src="/guides/tent-cards-preview.png" alt="Print preview of large fold-over name tents showing names upright on both halves" width="932" height="863" loading="lazy" />
  <figcaption>A tent card laid out correctly: each name prints upright on both halves with a centre fold line.</figcaption>
</figure>

<h2>The correct geometry</h2>
<p>For a folded tent, the sheet is divided in half. The name must appear <strong>upright on both halves</strong> — when you fold along the centre line, the two printed faces end up back-to-back and both read correctly to people facing either side of the table. Some designs also print a smaller duplicate name on the reverse for the card-holder's own reference.</p>

<h2>Step by step</h2>
<ol>
  <li><strong>List first.</strong> Names in a spreadsheet or pasted directly — one per row.</li>
  <li><strong>Pick a tent template.</strong> In <a href="/en/studio">the studio</a>, tent templates are the fold-over layouts with a centre fold line; flat cards are a different category.</li>
  <li><strong>Import.</strong> Upload or paste — headers map automatically, unused columns are listed, not lost.</li>
  <li><strong>Print at 100%.</strong> "Fit to page" moves the fold line off centre; print actual-size on card stock.</li>
  <li><strong>Score, fold, stand.</strong> Crease along the printed line — a ruler edge or bone folder gives a crisp fold.</li>
</ol>
<figure>
  <img src="/guides/studio-display-options.png" alt="Display options showing cut lines toggle, print calibration and PDF export controls" width="932" height="863" loading="lazy" />
  <figcaption>Cut lines and print calibration live under Display options — calibration compensates printer feed offset.</figcaption>
</figure>

<h2>When the fold line is slightly off</h2>
<p>If every card folds a millimetre off centre, that is printer feed offset, not the template. Run the calibration wizard once — it prints a ruler sheet, you measure two offsets, and every subsequent page is compensated. Measured error after calibration stays under 0.35 mm.</p>

<h2>What about Avery tent stock?</h2>
<p>Pre-scored Avery tent sheets (5305, 5302 and compatible formats) work well if the layout matches the stock's two-up or four-up geometry — check the per-page count in the preview against your pack before committing cardstock. Plain A4 or Letter card stock with printed fold and cut lines is the cheaper, more flexible route for most runs.</p>`,
  },
  {
    slug: 'desk-name-tags-from-class-list',
    title: 'Desk name tags for the whole class, from one roster',
    description:
      'Turn a class roster into printed desk name tags in minutes — import the list, pick a template, print at 100%. No more typing 30 names into a Word template.',
    keywords: [
      'desk name tags printable',
      'classroom name tags',
      'student desk name tags',
      'name tags for desks',
      'class list name tags',
    ],
    category: 'Teaching',
    audiences: ['Teachers', 'Substitute teachers', 'School admins'],
    datePublished: '2026-11-08',
    dateModified: '2026-11-08',
    readingMinutes: 5,
    howTo: {
      name: 'Print desk name tags from a class roster',
      steps: [
        {
          name: 'Get the roster into a sheet',
          text: 'Export the class list from your SIS or type it in a spreadsheet — one student per row with a name column.',
        },
        {
          name: 'Choose a desk tag template',
          text: 'In the studio, pick a name tag layout sized for desks — wide, low cards work best taped to desk corners.',
        },
        {
          name: 'Import and check',
          text: 'Upload or paste the roster. Headers map automatically; preview shows every student on their own tag.',
        },
        {
          name: 'Print at 100%',
          text: 'Print on card stock or laminate paper at actual size. 16–24 tags fit per A4/Letter sheet depending on the template.',
        },
        {
          name: 'Cut and stick',
          text: 'Cut along the guides, tape to desk corners or laminate for the term.',
        },
      ],
    },
    faqs: [
      {
        q: 'I bought editable desk tag templates on TPT and still typed every name — is this different?',
        a: 'Yes. Editable PDF/Word templates make you type each name one tag at a time. A roster-driven tool fills every tag from the list at once — add a new student, re-print one page.',
      },
      {
        q: 'Can I include student ID numbers or reading groups?',
        a: 'Yes — any roster column can be bound to a second field on the tag, or left unmapped entirely.',
      },
      {
        q: 'What size tags should I print for desks?',
        a: 'Wide, low tags (around 90×32 mm) tape neatly to a desk corner. Bigger tags suit cubbies and lockers. Several layouts per page are imposed automatically with cut lines.',
      },
      {
        q: 'Is the roster safe? It has student names.',
        a: 'The file is parsed locally in your browser and never uploaded — a practical fit for student-data privacy rules like FERPA, since nothing is transmitted to a third-party server.',
      },
    ],
    related: ['place-cards-from-google-sheets', 'double-sided-name-tents', 'name-badges-from-spreadsheet'],
    quickStart: {
      label: 'Try it with a demo class list',
      to: '/studio?template=deskName&demo=1',
      note: 'Demo roster included — paste your class list over it in seconds.',
    },
    body: `
<h2>Back-to-school week, thirty tags deep</h2>
<p>Every teacher knows the ritual: buy a cute editable desk-tag set, open it in Word or Acrobat, and type thirty names one tag at a time — then do it again for the mid-year move, the new student, the damaged tag. If your class list already exists as a spreadsheet (and it always does), the whole job is an import, not a typing session.</p>
<figure>
  <img src="/guides/desk-name-tags.png" alt="Print preview of desk name tags for a class roster, many-up on one A4 sheet" width="932" height="863" loading="lazy" />
  <figcaption>A full class of name tags imposed on one sheet — each tag filled from the roster automatically.</figcaption>
</figure>

<h2>Step 1 — The roster</h2>
<p>Export the class list from your student information system, or keep it in Sheets/Excel. One row per student; only the name column is essential. Extra columns — reading group, student ID, table colour — can ride along and map to a secondary field or stay unused.</p>
<h2>Step 2 — Pick the layout</h2>
<p>In <a href="/en/studio">the studio</a>, choose a name-tag template sized for desks. Wide, low tags (roughly 90×32 mm, 16–24 per page) sit neatly on a desk corner; larger formats work for cubbies, lockers and coat hooks. Fonts and colours are set once and apply to every tag in the batch.</p>
<h2>Step 3 — Import, preview, print</h2>
<p>Upload or paste the roster — headers map automatically, and the preview fills with real names. Print at <strong>100% scale</strong> (never "fit to page"), cut along the guides, and tape or laminate. Reprinting one page for a new student takes seconds.</p>
<figure>
  <img src="/guides/studio-field-mapping.png" alt="Field mapping showing the roster name column bound to the tag name field" width="932" height="863" loading="lazy" />
  <figcaption>Field mapping is automatic for common headers; anything unusual can be remapped from a dropdown.</figcaption>
</figure>

<h2>Why not the editable-template route</h2>
<p>Editable PDFs and PowerPoint templates are fine for a one-off, but they scale badly: every name is manual, every edit is manual, and long names overflow text boxes sized for "Ava". A roster-driven batch tool handles the whole class at once, shrinks long names to fit, and re-renders the moment the list changes.</p>

<h2>Privacy</h2>
<p>Student rosters are exactly the kind of data schools should not be pasting into random web tools. SeatMark parses the file locally in the browser — names never leave the device, and the tool keeps working offline once loaded.</p>`,
  },
  {
    slug: 'wedding-table-numbers-printable',
    title: 'Printable wedding table numbers',
    description:
      'Print elegant wedding table numbers from a template — no guest data needed, just choose a style and print. Sizes, card stock and how to stand them on tables.',
    keywords: [
      'wedding table numbers printable',
      'printable table numbers',
      'table number cards wedding',
      'diy table numbers',
      'wedding table number template',
    ],
    category: 'Weddings',
    audiences: ['Couples', 'Wedding planners', 'Venue staff'],
    datePublished: '2026-11-08',
    dateModified: '2026-11-08',
    readingMinutes: 4,
    howTo: {
      name: 'Print wedding table numbers',
      steps: [
        {
          name: 'Pick a table number template',
          text: 'Choose a design in the studio — flat cards for frames and holders, or fold-over tents that stand on their own.',
        },
        {
          name: 'Set the table list',
          text: 'Type or paste the table numbers — 1 through 20, named tables, or a mix. No guest data needed.',
        },
        {
          name: 'Preview the sheet',
          text: 'Numbers lay out several per page with cut lines; check the count matches your tables plus spares.',
        },
        {
          name: 'Print on card stock',
          text: 'Print at 100% scale on 200+ gsm card stock, cut along the guides, and place in holders or stand folded tents.',
        },
      ],
    },
    faqs: [
      {
        q: 'Flat cards or folding tents for table numbers?',
        a: 'Flat cards need a holder, frame or clip — sturdier look, one more purchase. Fold-over tents stand alone and survive transport better. Both print several per sheet.',
      },
      {
        q: 'Can the numbers match my place cards?',
        a: 'Yes — pick a design from the same style family (for example a botanical place card with a matching botanical number) and the tables and cards read as one set.',
      },
      {
        q: 'What about named tables instead of numbers?',
        a: 'Paste names — cities, trees, inside jokes — instead of numbers. Each table gets its own card from the same list.',
      },
      {
        q: 'How big should a table number be?',
        a: 'For a banquet hall, guests spot numbers from 3–5 metres away: aim for at least a half-page or 10 cm square card with a large numeral. Smaller cards work for intimate dinners.',
      },
    ],
    related: ['wedding-seating-chart-from-excel', 'escort-cards-vs-place-cards', 'place-cards-from-google-sheets'],
    quickStart: {
      label: 'Print table numbers now',
      to: '/studio?template=deluxeWedRing&demo=1',
      note: 'Twin-rings table number template preloaded — type your table list and print.',
    },
    body: `
<h2>The last piece of the table</h2>
<p>Place cards tell guests <em>where to sit</em>; table numbers tell them <em>which table is theirs</em>. They do different jobs and they should look like they belong together — same fonts, same motif, same paper. Printing them from the same tool is the easiest way to guarantee that.</p>
<figure>
  <img src="/guides/wedding-table-numbers.png" alt="Print preview of gold twin-ring wedding table numbers, four per page" width="932" height="863" loading="lazy" />
  <figcaption>Twin-rings table numbers, four per A4 sheet — sized to be readable across a banquet table.</figcaption>
</figure>

<h2>Choose flat or fold-over</h2>
<p><strong>Flat number cards</strong> slide into holders, frames or floral clips — a sturdier, more formal look, and the holder adds height so the number clears the centrepiece. <strong>Fold-over tents</strong> stand on their own, travel flat, and survive being set up by a venue team that has never seen your decor plan.</p>

<h2>Numbers or names</h2>
<p>Plain numerals are the default, but named tables (cities you have visited, favourite books, shared jokes) are a classic personalisation — just paste the names as the list. Whatever you choose, print <strong>two spares</strong>: a table number always goes missing between the venue walkthrough and the reception.</p>

<h2>Sizing for real rooms</h2>
<p>In a banquet hall the number must be findable from several metres away — a half-page card or a roughly 10 cm square with a large numeral is the practical minimum. For a dinner at home, a place-card-sized number is plenty. The preview shows exactly how many cards fit per sheet.</p>

<h2>Print it right</h2>
<p>Print at <strong>100% scale</strong> on 200 gsm or heavier card stock — lighter paper curls at the edges once cut. If the printed cut lines are a fraction off, run the one-time print calibration before doing the real run. And do not forget the <a href="/en/guides/wedding-seating-chart-from-excel">matching seating chart</a> for the entrance — the same guest list produces both.</p>`,
  },
  {
    slug: 'escort-cards-vs-place-cards',
    title: 'Escort cards vs place cards: how to print each',
    description:
      'Escort cards send guests to a table; place cards mark the exact seat. What each one needs, common formats, and how to print both from one guest list.',
    keywords: [
      'escort cards vs place cards',
      'escort cards wedding',
      'difference escort card place card',
      'seating cards wedding',
      'escort card printing',
    ],
    category: 'Weddings',
    audiences: ['Couples', 'Wedding planners'],
    datePublished: '2026-11-08',
    dateModified: '2026-11-08',
    readingMinutes: 5,
    howTo: {
      name: 'Print escort cards and place cards from one list',
      steps: [
        {
          name: 'Decide the format',
          text: 'Escort cards (guest finds their table at the entrance), place cards (exact seat marked), or both. Escort cards need name + table number; place cards need only the name.',
        },
        {
          name: 'Prepare the guest list',
          text: 'One guest per row with name and table number columns. The same list drives both card types.',
        },
        {
          name: 'Print escort cards',
          text: 'Pick a template that shows name and table number; sort or filter the list alphabetically so the display is easy to scan.',
        },
        {
          name: 'Print place cards if used',
          text: 'Pick a matching place card template — name only, or name plus meal indicator — and print from the same list.',
        },
        {
          name: 'Print and arrange',
          text: 'Print at 100% scale, cut along the guides; arrange escort cards alphabetically at the entrance.',
        },
      ],
    },
    faqs: [
      {
        q: 'Do I need both?',
        a: 'Escort cards alone work when seats within a table are free choice — the common option for most weddings. Place cards are added when the exact seat matters: plated dinners with meal-choice tracking, head tables, or formal protocol.',
      },
      {
        q: 'What goes on an escort card?',
        a: 'Name and table number — that is all. Alphabetical order at the entrance matters more than decoration; guests scan for their own name.',
      },
      {
        q: 'Is a seating chart the same thing?',
        a: 'A seating chart replaces escort cards entirely — one large board lists every guest by table. Many couples do both: chart for browsing, escort cards to carry to the table. The same roster generates each.',
      },
      {
        q: 'How do I show meal choices?',
        a: 'A small icon or code on the place card (or escort card) is the standard trick — caterers read it as they serve. Add a meal column to the list and map it to a secondary field.',
      },
    ],
    related: ['wedding-seating-chart-from-excel', 'wedding-table-numbers-printable', 'place-cards-from-google-sheets'],
    quickStart: {
      label: 'Try it with a sample guest list',
      to: '/studio?demo=1&scene=wedding',
      note: 'Wedding demo roster included — preview escort and place cards with real layout.',
    },
    body: `
<h2>Two cards, two different jobs</h2>
<p>Wedding stationery vocabulary trips everyone up once. The distinction is simple:</p>
<ul>
  <li><strong>Escort card</strong> — picked up at the entrance, tells the guest <em>which table</em> to go to. Name + table number. Displayed alphabetically so a hundred guests can scan it fast.</li>
  <li><strong>Place card</strong> — already waiting at the table, marks the <em>exact seat</em>. Usually just the name; a meal-code icon goes here if the caterer needs it.</li>
</ul>
<p>An escort card answers "where am I going?"; a place card answers "which seat is mine?". One lives at the door, the other lives at the plate.</p>
<figure>
  <img src="/guides/studio-place-cards-preview.png" alt="Botanical place cards printed with guest names and table numbers" width="932" height="863" loading="lazy" />
  <figcaption>Cards carrying name + table number work as escort cards; the same layout without the number line is a place card.</figcaption>
</figure>

<h2>Which combination do you need?</h2>
<p><strong>Escort cards only</strong> covers most weddings — guests find their table and pick any seat at it. <strong>Escort + place cards</strong> when seats are assigned individually (plated dinner, head table, strict protocol). <strong>Seating chart + place cards</strong> replaces the card wall with a board — increasingly popular because it prints as one sheet and looks striking.</p>
<figure>
  <img src="/guides/seating-chart-tables.png" alt="Seating chart floor plan showing round tables with colour-coded guest names assigned to seats" width="932" height="863" loading="lazy" />
  <figcaption>A seating chart does the escort card's job on one board — groups colour-coded so split tables are obvious.</figcaption>
</figure>

<h2>Printing both from one list</h2>
<p>The practical win: both card types run off the same spreadsheet. One roster with <code>name</code> and <code>table</code> columns produces escort cards (name + number), place cards (name only), the seating chart, and even matching <a href="/en/guides/wedding-table-numbers-printable">table numbers</a> — four outputs, one source of truth. When the RSVP list shifts the night before, you re-print the changed pages, not a wall of stationery.</p>

<h2>Escort card logistics</h2>
<ul>
  <li><strong>Alphabetical, not by table.</strong> Guests look themselves up by name — grouping cards by table number at the entrance makes everyone hunt twice.</li>
  <li><strong>Plus-ones and couples.</strong> One card per person is the formal standard; "Mr &amp; Mrs" joint cards are acceptable and halve the print run.</li>
  <li><strong>Last-minute adds.</strong> Keep blank cards and the same template handy — a hand-lettered spare on matching card stock passes unnoticed.</li>
</ul>`,
  },
  {
    slug: 'holiday-dinner-place-cards',
    title: 'Holiday dinner place cards you can print tonight',
    description:
      'Thanksgiving, Christmas and holiday dinner place cards from a typed list — pick a template, print on card stock, cut along the guides.',
    keywords: [
      'thanksgiving place cards',
      'christmas place cards printable',
      'holiday place cards',
      'dinner party place cards',
      'printable place cards holiday',
    ],
    category: 'Events',
    audiences: ['Hosts', 'Families', 'Office admins'],
    datePublished: '2026-11-08',
    dateModified: '2026-11-08',
    readingMinutes: 4,
    howTo: {
      name: 'Print holiday dinner place cards',
      steps: [
        {
          name: 'Type the guest list',
          text: 'Names in a spreadsheet or pasted straight into the import box — one per line is enough for a dinner party.',
        },
        {
          name: 'Pick a card style',
          text: 'Choose a flat place card or a fold-over tent template; decorative and minimal styles both work for holiday tables.',
        },
        {
          name: 'Preview the page',
          text: 'The cards fill with your names immediately — check the count, fix typos on the spot.',
        },
        {
          name: 'Print and cut',
          text: 'Print at 100% on card stock, cut along the guides. Even plain paper works folded as tents for a casual table.',
        },
      ],
    },
    faqs: [
      {
        q: 'I am hosting 12 people — is a spreadsheet overkill?',
        a: 'Not at all — paste the names directly, no file needed. The batch step is what saves you handwriting or typing into a template thirty times; for a dozen guests it is the difference between two minutes and twenty.',
      },
      {
        q: 'Which card style suits a holiday table?',
        a: 'Fold-over tents stand on their own between centrepieces and candles — the practical default. Flat cards work tucked into napkins or clipped to favours.',
      },
      {
        q: 'Can I mix in place cards for kids or dietary notes?',
        a: 'Yes — add a column with a note or icon code and map it to a second field, or keep a couple of blank spares for handwriting at the table.',
      },
      {
        q: 'What if more guests confirm tomorrow?',
        a: 'Add the names and re-print just the extra cards — the layout reflows automatically. No template re-editing.',
      },
    ],
    related: ['double-sided-name-tents', 'place-cards-from-google-sheets', 'escort-cards-vs-place-cards'],
    quickStart: {
      label: 'Make dinner place cards',
      to: '/studio?template=deluxeWedBotanic&demo=1',
      note: 'Botanical template preloaded with demo names — paste your guest list over it.',
    },
    body: `
<h2>The ten-minute table upgrade</h2>
<p>Place cards are the cheapest way to make a holiday dinner feel considered — and the most skipped, because handwriting twenty cards or wrestling a Word template at 9pm is nobody's idea of festive. With a typed list and a template, the whole job is under ten minutes.</p>
<figure>
  <img src="/guides/studio-place-cards-preview.png" alt="Botanical place cards with guest names laid out ten per page" width="932" height="863" loading="lazy" />
  <figcaption>Ten place cards per sheet — botanical and minimal styles both read well against a holiday table.</figcaption>
</figure>

<h2>Thanksgiving, Christmas, New Year</h2>
<p>Holiday dinners have their own quirks: a fluid guest list (someone always confirms on the day), dietary requirements to flag discreetly, and a table layout you arranged physically before anyone arrived. A list-driven tool handles all three — add the late guest, reprint one page, done.</p>

<h2>The workflow</h2>
<ol>
  <li><strong>Names in.</strong> Type or paste the guest list — for a dinner party, pasting one name per line straight into the import box is faster than making a file.</li>
  <li><strong>Style on.</strong> Pick a flat card or a fold-over tent in <a href="/en/studio">the studio</a>. Greenery and botanical motifs suit Thanksgiving and Christmas equally; minimal serif styles read "formal dinner" instantly.</li>
  <li><strong>Print at 100%.</strong> Card stock if you have it — even folded copy paper works as a tent for one evening.</li>
  <li><strong>Cut and place.</strong> The printed cut lines make the cards uniform; mismatched hand-cut edges are what give DIY away.</li>
</ol>

<h2>Bigger gatherings</h2>
<p>Hosting a banquet-style holiday meal or an office party? The same list also produces <a href="/en/guides/double-sided-name-tents">name tents</a> readable across the table, and a <a href="/en/guides/escort-cards-vs-place-cards">seating chart or escort cards</a> at the door — one roster, every output.</p>`,
  },
  {
    slug: 'eventbrite-attendee-badges',
    title: 'Eventbrite attendee list to printed name badges',
    description:
      'Export the Eventbrite attendee report, drop the Excel file into the badge generator, map name and ticket type, and print on Avery 5390/5392/5395 stock or plain card.',
    keywords: [
      'eventbrite name badges',
      'eventbrite attendee list badges',
      'print badges from eventbrite',
      'conference badge printing',
      'avery 5390 template',
    ],
    category: 'Events',
    audiences: ['Event organizers', 'Conference staff', 'Community managers'],
    datePublished: '2026-11-09',
    dateModified: '2026-11-09',
    readingMinutes: 5,
    howTo: {
      name: 'Print Eventbrite attendee badges',
      steps: [
        {
          name: 'Export the attendee report',
          text: 'In Eventbrite open your event, go to Reports → Attendee report, and export to Excel — First name, Last name, Email and Ticket type columns come standard.',
        },
        {
          name: 'Upload to the badge generator',
          text: 'Drop the .xlsx into the studio — the report columns land in field mapping automatically, no reformatting needed.',
        },
        {
          name: 'Map fields to the badge',
          text: 'Map First name + Last name to the name field, Company or Ticket type to a second line, and preview every badge.',
        },
        {
          name: 'Print on badge stock',
          text: 'Choose the Avery 5390/5392/5395 layout or a plain-card cut layout, print at actual size, and slot badges into holders.',
        },
      ],
    },
    faqs: [
      {
        q: 'Which Eventbrite export do I need?',
        a: 'Reports → Attendee report → Excel. It contains one row per attendee with name, email and ticket type — everything a badge needs. The "Orders" report works too if you only have that.',
      },
      {
        q: 'My report has "First name" and "Surname" columns — will they map?',
        a: 'Yes. Header matching recognizes first name / surname / last name / company / ticket type variants; anything unmatched can be assigned manually in one click.',
      },
      {
        q: 'Can I print different badges for VIPs and staff?',
        a: 'Yes — keep the Ticket type column on the badge, or filter the spreadsheet into per-role sheets and run a batch per badge design.',
      },
      {
        q: 'How many badges fit per sheet?',
        a: 'Avery 5390 gives 8 badges (2¼×3½ in) per Letter sheet, 5392 gives 6 (3×4 in), 5395 gives 8 (2⅓×3⅜ in). A 300-attendee event on 5390 is about 38 sheets.',
      },
    ],
    related: ['name-badges-from-spreadsheet', 'place-cards-from-google-sheets', 'desk-name-tags-from-class-list'],
    quickStart: {
      label: 'Make event badges',
      to: '/en/studio?demo=1',
      note: 'Open the studio with demo attendees — replace them with your Eventbrite export.',
    },
    body: `
<h2>Why the Eventbrite export is half the job</h2>
<p>On-site badge printing at the door is where small events bleed time — typing names into a Word mail merge the night before, or paying a registration vendor $500+ for badge stock. The Eventbrite attendee report already has every field a badge needs. If you can export it and drop it into a batch tool, the badges are a ten-minute job.</p>
<figure>
  <img src="/guides/photo-badges.png" alt="Name badges generated from an attendee list with names and roles filled" width="932" height="863" loading="lazy" />
  <figcaption>Badges generated straight from the attendee export — names, roles and ticket types all mapped.</figcaption>
</figure>

<h2>Step 1 — export from Eventbrite</h2>
<p>In Eventbrite, open the event and go to <strong>Reports → Attendee report</strong>. Choose <strong>Excel</strong> and include at least the name fields, email and ticket type. The file arrives as one row per attendee — exactly the shape a batch tool wants. Google Sheets or Excel can also clean it (dedupe test orders, drop cancelled tickets) before you print.</p>

<h2>Step 2 — upload and map</h2>
<p>Drop the .xlsx into <a href="/en/studio">the studio</a> and pick a badge template. The import step reads the header row: <code>First name</code>, <code>Surname</code>/<code>Last name</code>, <code>Email</code>, <code>Ticket type</code> are recognized automatically — drag anything unmatched onto a badge field. Keep Ticket type visible if you want at-a-glance role colors at check-in.</p>

<h2>Step 3 — print on real badge stock</h2>
<p>Set the paper layout to match what is in the printer: <strong>Avery 5390</strong> (8 per sheet, the classic clip-in badge), <strong>5392</strong> (6 per sheet, bigger type), or <strong>5395</strong> (8 per sheet name-tag inserts). Print at actual size — never "fit to page" — and the names land inside the die-cut, not across the perf. Plain card with cut guides works for budget events; a guillotine or craft knife does the rest.</p>

<h2>Door-day tips</h2>
<ul>
  <li><strong>Re-export the morning of.</strong> Last-minute registrations are the normal case — export again, re-upload, print only the new badges.</li>
  <li><strong>Print a blank strip per type.</strong> A few empty VIP and staff badges cover walk-ins.</li>
  <li><strong>Sort, don't search.</strong> Badge holders sorted alphabetically beat any pickup table app.</li>
</ul>

<h2>The same list, further</h2>
<p>The attendee file also drives <a href="/en/guides/name-badges-from-spreadsheet">spreadsheet-driven badges</a> generally, <a href="/en/guides/desk-name-tags-from-class-list">session name tags</a>, and even tent cards for the speaker table — one export, every print run. See the <a href="/en/name-badge-generator">badge generator page</a> for the direct workflow.</p>`,
  },
  {
    slug: 'wedding-table-plan-uk',
    title: 'Wedding table plan and matching place cards (UK guide)',
    description:
      'Arrange guests on a table plan, print the board for the venue entrance, then generate matching place cards and table numbers on A4 — one list, everything consistent.',
    keywords: [
      'wedding table plan',
      'table plan maker uk',
      'wedding table plan printable',
      'place cards wedding uk',
      'top table seating plan',
    ],
    category: 'Weddings',
    audiences: ['Couples', 'Wedding planners', 'Venue coordinators'],
    datePublished: '2026-11-09',
    dateModified: '2026-11-09',
    readingMinutes: 6,
    howTo: {
      name: 'Make a wedding table plan with matching stationery',
      steps: [
        {
          name: 'Build the guest list',
          text: 'Put confirmed guests in a spreadsheet — name, partner, table notes, meal choice; the same list feeds the plan and the cards.',
        },
        {
          name: 'Arrange the tables',
          text: 'Drag guests onto round or long tables, set the top table first, and let auto-assign balance the rest.',
        },
        {
          name: 'Print the table plan board',
          text: 'Export the plan view as a PDF for a poster frame or easel at the venue entrance.',
        },
        {
          name: 'Generate the cards and numbers',
          text: 'From the same list, batch place cards and matching table numbers on A4 — everything consistent by construction.',
        },
      ],
    },
    faqs: [
      {
        q: 'Table plan or seating chart — which term is right?',
        a: 'Both describe the same thing. "Table plan" is the UK term, "seating chart" the US one. Your guests will look for whichever the invitation said.',
      },
      {
        q: 'How far ahead should I print the plan?',
        a: 'RSVP deadlines usually land 3–4 weeks out; print the board about a week before so late changes only need a small reprint, not a rewrite.',
      },
      {
        q: 'Does it handle a long top table plus round guest tables?',
        a: 'Yes — mix table shapes in the plan, drag the wedding party onto the top table first, then fill the rounds.',
      },
      {
        q: 'What paper should the plan board be?',
        a: 'Export the PDF at the size the frame or easel needs — A3 or A2 through any print shop — and match the cards to A4 card stock at home.',
      },
    ],
    related: ['wedding-seating-chart-from-excel', 'wedding-table-numbers-printable', 'escort-cards-vs-place-cards'],
    quickStart: {
      label: 'Start the table plan',
      to: '/en/banquet?demo=1',
      note: 'Demo wedding party preloaded — drag guests between tables, then export the plan.',
    },
    body: `
<h2>The UK version of the same problem</h2>
<p>Search "seating chart" and you get American tooling priced in dollars and sized for US Letter. Search "table plan" and the UK results are mostly Etsy printables and stationery designers. The job is identical — seat the guests, print the board — but the vocabulary and the paper size differ, and a plan plus its matching stationery should come from one list or something always drifts out of sync.</p>
<figure>
  <img src="/guides/seating-chart-tables.png" alt="Wedding table plan view with guests assigned to round tables" width="932" height="863" loading="lazy" />
  <figcaption>The table plan view: guests dragged onto tables, counts per table visible at a glance.</figcaption>
</figure>

<h2>One list drives everything</h2>
<p>Put the confirmed guests in a spreadsheet — name, partner, meal choice, any note for the venue. That single file feeds three outputs:</p>
<ol>
  <li><strong>The table plan board</strong> — the display guests see on arrival, exported as a PDF sized for your frame or easel.</li>
  <li><strong>The place cards</strong> — flat or tent-fold cards on each setting, A4 card stock, cut lines included.</li>
  <li><strong>The table numbers</strong> — matching numbers or named tables in the same style.</li>
</ol>
<p>Because all three read the same roster, a table swap on the morning of the wedding means re-printing a few cards — not rebuilding three documents.</p>

<h2>Arranging the plan</h2>
<p>In <a href="/en/banquet">the seating tool</a>, lay out the room first — top table plus rounds, or one long banquet table. Drag the wedding party onto the top table (parents, witnesses and the couple read the room best from the centre), then place family groups. Auto-assign fills whoever is left so the last twenty names don't become an evening of shuffling.</p>
<figure>
  <img src="/guides/seating-chart-venue.png" alt="Table plan canvas with round tables and assigned guests" width="932" height="863" loading="lazy" />
  <figcaption>Round tables around a top table — the classic UK wedding room layout.</figcaption>
</figure>

<h2>Printing for a UK printer</h2>
<p>Everything outputs on A4 — no Letter-size guesswork. Print the board PDF at a print shop in A3 or A2 for the easel; run the cards and table numbers at home on 250 gsm card at 100% scale. For the cards themselves, see <a href="/en/guides/wedding-table-numbers-printable">printable table numbers</a> and the <a href="/en/guides/escort-cards-vs-place-cards">escort vs place card explainer</a> for what goes at the entrance versus at each setting.</p>

<h2>Last-mile checklist</h2>
<ul>
  <li><strong>Alphabetical or by-table?</strong> UK venues usually list guests alphabetically on the board; by-table order suits small weddings.</li>
  <li><strong>Keep two spares.</strong> A couple of blank place cards cover surprise plus-ones.</li>
  <li><strong>Hand the venue the plan.</strong> Coordinators lay settings faster from a printed plan than from verbal instructions.</li>
</ul>`,
  },
  {
    slug: 'print-avery-tent-cards',
    title: 'How to print Avery tent cards (5302, 5305, 5309)',
    description:
      'Print names onto Avery tent card stock without the mail-merge gymnastics: pick the matching layout, upload your list, print at actual size, and fold along the score.',
    keywords: [
      'avery tent cards',
      'avery 5302 template',
      'avery 5305 tent cards',
      'avery 5309 large tent card',
      'how to print tent cards',
    ],
    category: 'Events',
    audiences: ['Event organizers', 'Office admins', 'Wedding planners'],
    datePublished: '2026-11-09',
    dateModified: '2026-11-09',
    readingMinutes: 5,
    howTo: {
      name: 'Print onto Avery tent card stock',
      steps: [
        {
          name: 'Pick the tent template',
          text: 'Choose a fold-over tent template — it prints each name twice, once rotated 180°, so both faces read correctly after folding.',
        },
        {
          name: 'Upload your list',
          text: 'Excel, CSV or pasted names — one row becomes one tent card.',
        },
        {
          name: 'Select the Avery paper layout',
          text: 'In paper settings choose Avery 5302, 5305 or 5309 to match the stock in your printer — margins and fold positions lock to the real die-cut.',
        },
        {
          name: 'Print and fold',
          text: 'Print at actual size (never fit-to-page), flex the card along the score line, and the tent stands.',
        },
      ],
    },
    faqs: [
      {
        q: 'Why does the Avery Word template print upside down?',
        a: 'Avery templates give you two text boxes per card — you have to rotate the top one yourself, and mail merge cannot rotate per field. Tent templates here rotate the top-half copy automatically.',
      },
      {
        q: '5302, 5305 or 5309 — which size do I buy?',
        a: '5302 is the small classic place-card size (4 per sheet, 3.5×2 in folded). 5305 is the wide medium (2 per sheet, 8.5×2.5 in). 5309 is the large one-per-sheet card (11×3.5 in folded) for head tables and signage.',
      },
      {
        q: 'The names land on the perforation — what went wrong?',
        a: 'Almost always print scaling. Set the print dialog to Actual size / 100% — "Fit" shrinks the page a few percent and pushes content across the score lines.',
      },
      {
        q: 'Can I use generic tent card stock instead of Avery?',
        a: 'Yes — if the card geometry matches (most clone stock copies the Avery die), the same layout fits. Check the folded size printed on the box against 5302/5305/5309 dimensions.',
      },
    ],
    related: ['double-sided-name-tents', 'place-cards-from-google-sheets', 'escort-cards-vs-place-cards'],
    quickStart: {
      label: 'Print tent cards',
      to: '/en/studio?demo=1',
      note: 'Demo roster preloaded — pick a tent template and select your Avery stock in paper settings.',
    },
    body: `
<h2>The tent card problem nobody warns you about</h2>
<p>A tent card is one card folded in half — so the name should appear twice, once upside down, and read correctly on both faces once folded. Word and the official Avery templates make you build that mirrored top half by hand, which is why "avery tent card upside down" is such a common complaint. A list-driven tool does the mirror for you.</p>
<figure>
  <img src="/guides/tent-cards-preview.png" alt="Fold-over tent cards with mirrored names laid out on a sheet" width="932" height="863" loading="lazy" />
  <figcaption>Each card prints the name twice — the top half mirrored so both faces read correctly when folded.</figcaption>
</figure>

<h2>Match the layout to the stock</h2>
<p>Avery sells three US Letter tent formats, and each scores the card differently:</p>
<table>
  <thead><tr><th>Product</th><th>Per sheet</th><th>Folded size</th><th>Best for</th></tr></thead>
  <tbody>
    <tr><td>5302</td><td>4</td><td>3.5 × 2 in</td><td>Place cards, buffet labels, small desk tents</td></tr>
    <tr><td>5305</td><td>2</td><td>8.5 × 2.5 in</td><td>Meeting name tents, long names and titles</td></tr>
    <tr><td>5309</td><td>1</td><td>11 × 3.5 in</td><td>Head-table cards, signage tents, panel desks</td></tr>
  </tbody>
</table>
<p>In paper settings pick the matching layout — the margins and fold positions lock to the actual die-cut (e.g. 5305 scores at 3 in and 8 in from the top, 5302 at 3.25 in and 7.75 in). Generic clone stock usually copies the same geometry, so the layout still fits.</p>

<h2>Upload, preview, print</h2>
<ol>
  <li><strong>Choose a tent template</strong> in <a href="/en/studio">the studio</a> — tent templates carry the mirrored field already.</li>
  <li><strong>Upload the list.</strong> Excel, CSV or pasted names; each row becomes one folded card.</li>
  <li><strong>Select the Avery layout</strong> matching your stock.</li>
  <li><strong>Print at 100%.</strong> The single most common failure is "Fit to printable area" pushing names across the score line — always Actual size.</li>
  <li><strong>Fold.</strong> Flex along the embossed score; 5309 also needs the two side strips torn away first.</li>
</ol>

<h2>When not to use tent stock</h2>
<p>Place-card-size tents are lovely but not always the right shape — flat cards tuck into napkins, and escort cards carry table numbers. For the comparison, see <a href="/en/guides/escort-cards-vs-place-cards">escort cards vs place cards</a>, and for the general double-sided walkthrough see <a href="/en/guides/double-sided-name-tents">double-sided name tents</a>. The <a href="/en/tent-card-generator">tent card generator</a> page covers the direct workflow.</p>`,
  },
]

export function findEnGuide(slug: string): Guide | undefined {
  return enGuides.find((g) => g.slug === slug)
}
