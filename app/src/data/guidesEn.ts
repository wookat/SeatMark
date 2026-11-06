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
    related: ['print-place-cards-from-excel', 'name-badges-from-spreadsheet'],
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

<h2>Step 3 — Seat the guests</h2>
<p>Open the banquet seating view and create your tables — round, long, U-shape. Drag guests from the list onto seats; anyone unassigned waits in the side list so nobody gets lost. Changing your mind costs a drag, not a redo.</p>

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
        a: 'Watermarked export is free and unlimited without an account — the mark is a small corner label, not a full-page overlay. Watermark-free export has a daily quota, and Pro (normally CNY 19/mo) is free for a limited time.',
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
    related: ['wedding-seating-chart-from-excel', 'name-badges-from-spreadsheet'],
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

<h2>Step 3 — Import and preview</h2>
<p>Upload the file. Headers map to card fields automatically — <code>name</code>, <code>title</code>, <code>company</code>, <code>table</code> are recognised out of the box. The preview fills with your real names, so layout problems surface before you print, not after.</p>

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
    related: ['print-place-cards-from-excel', 'wedding-seating-chart-from-excel'],
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

<h2>Why local processing matters here</h2>
<p>Student photos and staff IDs are sensitive data by any standard. SeatMark parses the roster and renders every photo locally in the browser — nothing is uploaded, which also means the tool keeps working on flaky venue Wi-Fi once loaded.</p>`,
  },
]

export function findEnGuide(slug: string): Guide | undefined {
  return enGuides.find((g) => g.slug === slug)
}
