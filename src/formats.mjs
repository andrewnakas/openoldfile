// One entry per page. Each page owns one search intent ("open X file") and
// names the engine module in public/js/engines/ that opens the file.
//
// Fields:
//   slug      URL: /open/<slug>/
//   exts      extensions the page accepts (first one is the headline)
//   program   the software that made these files (people search for it)
//   title     <title>, ≤60 characters (Bing truncates past ~65)
//   h1        the head term, not a slogan
//   desc      meta description, ≤155 characters, answers the query
//   engine    public/js/engines/<engine>.js
//   outputs   what the visitor can save afterwards
//   fallback  engine to retry with when the main one cannot read the file
//   needs     what the visitor no longer needs ("No ___ needed"); default program
//   era       one line of history, shown under the H1
//   about     paragraphs explaining the format (plain text, no HTML)
//   faq       [question, answer] pairs phrased as the real queries
//   related   slugs to link to
//   category  groups pages on the home page and in the nav

//   convertTo the "Convert .X to ..." heading when the outputs list reads badly
//   updated   date the page text last changed (sitemap lastmod); default UPDATED

// Bump when a template change alters every page.
export const UPDATED = '2026-10-07';

// Each category also gets a hub page at /formats/<id>/.
export const CATEGORIES = [
  {
    id: 'documents',
    name: 'Documents and help files',
    title: 'Open Old Document Files Online: WordPerfect, Works, Write',
    h1: 'Open old word processor and help files',
    desc: 'Read old documents in your browser: WordPerfect, Microsoft Works, Windows Write, WordStar, Ami Pro, ClarisWorks, MacWrite, WinHelp and CHM. Free, no upload.',
    intro: 'Word processors came and went through the 1980s and 1990s, and most of them saved in their own format. Current versions of Word read only a few of them. Each page below reads one family of files in your browser and saves a copy you can open today, usually as HTML that Word and Google Docs import, as plain text, or as a PDF.'
  },
  {
    id: 'spreadsheets',
    name: 'Spreadsheets and databases',
    title: 'Open Old Spreadsheet Files Online: Lotus, Quattro, dBASE',
    h1: 'Open old spreadsheet and database files',
    desc: 'View Lotus 1-2-3, Quattro Pro, Microsoft Works and dBASE files in your browser and save them as Excel or CSV. Free, nothing uploaded.',
    intro: 'Before Excel took over, spreadsheets lived in Lotus 1-2-3, Quattro Pro and Microsoft Works, and records lived in dBASE and FoxPro tables. Excel now blocks or ignores most of these formats. These pages read the values straight from the file and save a modern .xlsx or .csv copy.'
  },
  {
    id: 'archives',
    name: 'Archives and disk images',
    title: 'Open Old Archives Online: LZH, ARJ, CAB, .Z, D64, ADF',
    h1: 'Open old archives and disk images',
    desc: 'Extract LZH, ARJ, CAB and Unix .Z archives and browse Commodore 64 and Amiga disk images in your browser. Free, no software, no upload.',
    intro: 'Bulletin boards, shareware CDs and early Unix systems packed files with compressors that modern systems no longer recognise, and home computers stored software on floppy disks that survive today as image files. These pages list what is inside and let you save the files one by one or all together as a .zip.'
  },
  {
    id: 'media',
    name: 'Flash, music and graphics',
    title: 'Play Old Media Files Online: SWF, MIDI, MOD, RealMedia',
    h1: 'Play old Flash, music, video and picture files',
    desc: 'Play Flash SWF, MIDI and tracker music, convert RealMedia to MP4 and view PICT, WMF and EMF pictures in your browser. Free, nothing uploaded.',
    intro: 'Flash games, MIDI tunes, Amiga tracker music, RealPlayer videos and the picture formats of classic Mac OS and Windows all lost their players. These pages play or draw them in your browser and, where it helps, save them as MP4, MP3, WAV, PNG or SVG.'
  }
];

export const FORMATS = [
  // ---------------------------------------------------------------- spreadsheets
  {
    slug: 'wk1',
    fallback: 'doc',
    category: 'spreadsheets',
    exts: ['wk1', 'wk3', 'wk4', '123', 'wks', 'wk2'],
    program: 'Lotus 1-2-3',
    title: 'Open Lotus 1-2-3 Files (.wk1, .wk3, .123) Online, Free',
    h1: 'Open Lotus 1-2-3 files online',
    desc: 'View .wk1, .wk3, .wk4 and .123 Lotus spreadsheets in your browser and save them as Excel or CSV. Free, no upload, no Lotus needed.',
    engine: 'sheet',
    outputs: ['Excel (.xlsx)', 'CSV'],
    era: 'Lotus 1-2-3 was the spreadsheet of the DOS era, from 1983 until Excel overtook it in the mid-1990s.',
    about: [
      'Lotus 1-2-3 saved worksheets as .wks (version 1A), .wk1 (release 2), .wk3 (release 3) and .wk4 (release 4 for Windows). The later Lotus SmartSuite versions used .123. Modern Excel refuses most of these: Microsoft blocks the older Lotus formats by default in its File Block settings, and recent versions dropped them entirely.',
      'This page reads the cell values and formula results straight from the file, shows every sheet as a table, and lets you save a modern .xlsx or .csv copy. Formatting such as fonts and column widths is mostly lost, but the numbers and text come through.'
    ],
    faq: [
      ['How do I open a .wk1 file without Lotus 1-2-3?', 'Drop it on this page. It is read in your browser and shown as a table, and you can download it as an Excel .xlsx file or a .csv file. Nothing is uploaded.'],
      ['Can Excel open .wk1 or .wk3 files?', 'Older Excel versions could, but current Microsoft 365 Excel blocks Lotus formats by default (File > Options > Trust Center > File Block Settings) and some releases cannot read them at all. Converting here to .xlsx avoids the problem.'],
      ['What is the difference between .wks, .wk1, .wk3 and .wk4?', 'They are successive Lotus 1-2-3 versions: .wks for release 1A, .wk1 for release 2.x, .wk3 for release 3 (the first with multiple sheets in one file) and .wk4 for release 4 on Windows. This page reads all of them.'],
      ['Are formulas kept?', 'The values the formulas last calculated are kept. Lotus formula syntax differs from Excel, so the formulas themselves are not converted.'],
      ['Is my spreadsheet uploaded anywhere?', 'No. The file is read by JavaScript running in this tab. You can disconnect from the internet after the page loads and it still works.']
    ],
    related: ['wq1', 'dbf', 'xlr']
  },
  {
    slug: 'dbf',
    needs: 'dBASE or FoxPro',
    category: 'spreadsheets',
    exts: ['dbf'],
    program: 'dBASE, FoxPro and Clipper',
    title: 'Open DBF Files Online, Free (dBASE, FoxPro) | No Upload',
    h1: 'Open DBF files online',
    desc: 'View dBASE and FoxPro .dbf database files in your browser and export them to Excel or CSV. Free, no upload, no software to install.',
    engine: 'sheet',
    outputs: ['Excel (.xlsx)', 'CSV'],
    era: 'dBASE II arrived in 1980; its .dbf table format outlived the program and is still used by GIS shapefiles today.',
    about: [
      'A .dbf file is a single database table: a header describing the fields, then one fixed-width row per record. dBASE III and IV, FoxPro, Visual FoxPro, Clipper and many accounting and point-of-sale systems used it, and every ESRI shapefile carries its attributes in a .dbf beside the .shp.',
      'This page reads the table, shows the records, and saves them as .xlsx or .csv. Memo fields stored in a separate .dbt or .fpt file are not read; everything else in the table is.'
    ],
    faq: [
      ['How do I open a DBF file without dBASE or FoxPro?', 'Drop it on this page. The records are shown as a table and you can download them as Excel (.xlsx) or CSV. It runs in your browser and nothing is uploaded.'],
      ['How do I convert DBF to Excel?', 'Open the file here and press "Download .xlsx". Each field becomes a column and each record a row.'],
      ['Can I open the .dbf from a shapefile?', 'Yes. The .dbf beside a .shp holds the attribute table, and it opens here like any other dBASE file.'],
      ['What about the .dbt or .fpt file next to my .dbf?', 'Those hold long memo text. This page reads the main table only, so memo columns appear empty for now.'],
      ['Is the file uploaded?', 'No. It is read entirely in this browser tab.']
    ],
    related: ['wk1', 'wq1', 'xlr']
  },
  {
    slug: 'wq1',
    fallback: 'doc',
    category: 'spreadsheets',
    exts: ['wq1', 'wq2', 'wb1', 'wb2', 'wb3', 'qpw'],
    program: 'Quattro Pro',
    title: 'Open Quattro Pro Files (.wq1, .wb1, .qpw) Online, Free',
    h1: 'Open Quattro Pro files online',
    desc: 'View Quattro Pro .wq1, .wb1, .wb2, .wb3 and .qpw spreadsheets in your browser and save them as Excel or CSV. Free and nothing is uploaded.',
    engine: 'sheet',
    outputs: ['Excel (.xlsx)', 'CSV'],
    era: 'Borland launched Quattro in 1988 to take on Lotus 1-2-3; Corel has sold it as part of WordPerfect Office since 1996.',
    about: [
      'Quattro Pro for DOS saved .wq1 and .wq2 files, Quattro Pro for Windows used .wb1, .wb2 and .wb3, and Corel versions since 2000 use .qpw. Outside WordPerfect Office almost nothing opens them.',
      'This page reads the sheets in the file, shows them as tables and saves .xlsx or .csv copies with the cell values intact.'
    ],
    faq: [
      ['How do I open a .qpw or .wb3 file without Quattro Pro?', 'Drop it here. The sheets are shown in your browser and can be downloaded as Excel or CSV. No upload and no install.'],
      ['Can Excel open Quattro Pro files?', 'Modern Excel cannot. Converting here gives you an .xlsx that Excel, Google Sheets, LibreOffice and Numbers all open.'],
      ['Is my file private?', 'Yes. It is processed in your browser and never sent to a server.']
    ],
    related: ['wk1', 'dbf', 'xlr']
  },
  {
    slug: 'xlr',
    fallback: 'doc',
    category: 'spreadsheets',
    exts: ['xlr', 'wks'],
    program: 'Microsoft Works',
    title: 'Open Microsoft Works Spreadsheets (.xlr, .wks) Online',
    h1: 'Open Microsoft Works spreadsheets online',
    desc: 'View Microsoft Works .xlr and .wks spreadsheets in your browser and convert them to Excel or CSV. Free, no upload, no Works needed.',
    engine: 'sheet',
    outputs: ['Excel (.xlsx)', 'CSV'],
    era: 'Microsoft Works came preinstalled on millions of home PCs from 1987 until it was discontinued in 2009.',
    about: [
      'Works for DOS and early Windows versions saved spreadsheets as .wks; Works 6 to 9 used .xlr. Microsoft stopped shipping the Works converters years ago, so current Office versions cannot open either.',
      'Drop the file here to see each sheet and download it as .xlsx or .csv. Word-processor documents from Works (.wps) and Works databases (.wdb) have their own pages.'
    ],
    faq: [
      ['How do I open an .xlr file on Windows 10 or 11?', 'Drop it on this page and download it as .xlsx, which Excel opens normally. Nothing is installed or uploaded.'],
      ['How do I open an .xlr file on a Mac?', 'The same way: this page runs in Safari, Chrome or Firefox on a Mac and converts the file to .xlsx for Numbers or Excel.'],
      ['Can it open Works .wps documents?', 'Yes, on the Works documents page: .wps files are word-processor documents in a different format.'],
      ['Is anything uploaded?', 'No. The spreadsheet is read in your browser.']
    ],
    related: ['wk1', 'wq1', 'dbf']
  },
  {
    slug: 'wdb',
    needs: 'Microsoft Works',
    category: 'spreadsheets',
    exts: ['wdb'],
    program: 'Microsoft Works Database',
    title: 'Open Microsoft Works WDB Database Files Online, Free',
    h1: 'Open Microsoft Works database (.wdb) files online',
    desc: 'View Microsoft Works .wdb database files in your browser and export them to Excel or CSV. Free, no upload, no Works needed.',
    engine: 'doc',
    outputs: ['Excel (.xlsx)', 'CSV'],
    era: 'Works Database was the address book and collection tracker of millions of home PCs from the late 1980s to 2009.',
    about: [
      'A .wdb file holds the records and fields of a Microsoft Works database: mailing lists, recipe collections, inventories. Access and Excel cannot open them, and Microsoft no longer distributes Works.',
      'This page reads the database with libwps and shows the records as a table, ready to save as Excel or CSV.'
    ],
    faq: [
      ['How do I open a .wdb file without Microsoft Works?', 'Drop it on this page. The records are shown as a table and can be downloaded as Excel or CSV.'],
      ['How do I convert WDB to Excel?', 'Open the file here and press "Download .xlsx".'],
      ['Is the database uploaded?', 'No. It is read in your browser.']
    ],
    related: ['xlr', 'dbf', 'wps']
  },

  // ---------------------------------------------------------------- documents
  {
    slug: 'sam',
    category: 'documents',
    exts: ['sam'],
    program: 'Lotus Ami Pro',
    needs: 'Ami Pro or Lotus Word Pro',
    title: 'Open Ami Pro (.sam) Files Online, Free | No Upload',
    h1: 'Open Lotus Ami Pro (.sam) files online',
    desc: 'Read Lotus Ami Pro .sam documents in your browser and save them as Word-compatible HTML or text. Free, no upload, no Ami Pro or Word Pro needed.',
    engine: 'amipro',
    outputs: ['Word-compatible HTML', 'plain text'],
    era: 'Ami Pro (1988) was one of the first Windows word processors; Lotus replaced it with Word Pro in 1996, and IBM ended SmartSuite in 2014.',
    about: [
      'Ami Pro saved documents as .sam files, and nothing current opens them: Word Pro could import them, but SmartSuite has been discontinued for a decade and does not run reliably on Windows 10 or 11. Many businesses, law offices and authors still have archives of .sam files from the early 1990s.',
      'This page reads the Ami Pro text stream directly: paragraphs, paragraph styles, bold, italic, underline, superscript and subscript, font changes, alignment and footnotes. Frames, tables and embedded pictures are not shown yet.'
    ],
    faq: [
      ['How do I open an Ami Pro .sam file?', 'Drop it on this page. The text is shown with its formatting and can be saved as HTML for Word or as plain text.'],
      ['How do I convert SAM to Word?', 'Open the file here, press "Download as Word-compatible HTML", open that file in Word and save it as .docx.'],
      ['Can Word open .sam files?', 'No current version of Word reads Ami Pro files, and Lotus Word Pro, which could, is discontinued.'],
      ['Is my document uploaded?', 'No. It is read in your browser.']
    ],
    related: ['wpd', 'wordstar', 'wk1']
  },
  {
    slug: 'wordstar',
    category: 'documents',
    exts: ['ws', 'ws3', 'ws4', 'ws5', 'ws6', 'ws7', 'wsd'],
    program: 'WordStar',
    title: 'Open WordStar Files Online, Free (.ws, DOS and CP/M)',
    h1: 'Open WordStar files online',
    desc: 'Read WordStar documents from CP/M and DOS (versions 3 to 7) in your browser and save them as text or Word-compatible HTML. Free, no upload.',
    engine: 'wordstar',
    outputs: ['Word-compatible HTML', 'plain text'],
    era: 'WordStar (1978) was the first hit word processor, on CP/M and then DOS. George R. R. Martin still writes on it.',
    about: [
      'WordStar files look like garbage in a modern editor: the program set the top bit of the last letter of every word and used invisible control codes for bold, underline and italic. Files were often saved with no extension, or as .ws, .wsd or even .doc, which makes Word mistake them for its own format.',
      'This page decodes the WordStar encoding, keeps bold, italic, underline, superscript and the original spacing (shown in a typewriter font, as WordStar did), and drops the dot commands that controlled printing. Save the result as plain text or as HTML that Word opens.'
    ],
    faq: [
      ['How do I open a WordStar file?', 'Drop it on this page. The text is decoded in your browser and shown with its formatting.'],
      ['Why does my WordStar file show strange characters in Notepad or Word?', 'WordStar marks the end of each word by changing the last letter, and stores formatting as control codes. This page reverses that encoding.'],
      ['My WordStar file has a .doc extension. Will it work?', 'Yes. Drop it on the home page: it is recognised as WordStar from its contents, not its name.'],
      ['Which versions are supported?', 'WordStar 3.x for CP/M and DOS, and WordStar for DOS 4 to 7. Embedded font commands in versions 5 to 7 are skipped.'],
      ['Is my file uploaded?', 'No. It is decoded entirely in your browser.']
    ],
    related: ['wpd', 'wri', 'wps']
  },
  {
    slug: 'hlp',
    convertTo: 'HTML or RTF',
    needs: 'WinHlp32',
    category: 'documents',
    exts: ['hlp'],
    program: 'Windows Help (WinHelp)',
    title: 'Open HLP Files on Windows 11, Mac or Online, Free',
    h1: 'Open Windows Help (.hlp) files online',
    desc: 'Read old WinHelp .hlp files that Windows 10 and 11 refuse to open, on any computer. Browse and search topics in your browser. Free, no upload.',
    engine: 'hlp',
    outputs: ['one HTML file of every topic', 'the decompiled RTF'],
    era: 'WinHelp was the help system of Windows 3.0 to XP. Microsoft removed the viewer, WinHlp32.exe, from Windows starting with Vista.',
    about: [
      'Software from the 1990s and early 2000s shipped its manual as a .hlp file. On Windows 10 and 11, opening one only shows a message that the help is no longer supported, and the old WinHlp32 download from Microsoft was never released for Windows 10 or 11. Macs and phones never had a viewer.',
      'This page decompiles the help file with helpdeco, an open-source WinHelp decompiler compiled to WebAssembly, and turns it back into topics you can browse, search by keyword and follow links between. Pictures stored as bitmaps are shown; hotspot graphics and macros are not.'
    ],
    faq: [
      ['How do I open a .hlp file on Windows 11?', 'Windows 11 cannot open .hlp files and Microsoft offers no viewer for it. Drop the file on this page to read every topic in your browser.'],
      ['Why does Windows say "the Help for this program was created in Windows Help format"?', 'That message appears because WinHlp32.exe was removed from Windows. The help file itself is fine; this page reads it without WinHlp32.'],
      ['How do I open a .hlp file on a Mac?', 'Use this page in Safari or any other browser. The topics are shown and linked like the original help window.'],
      ['Can I convert HLP to HTML or PDF?', 'Yes. Download every topic as one HTML file, then print it to PDF if you want one.'],
      ['What about the .cnt file next to my .hlp?', 'The .cnt holds the original contents tree. It is not needed: the topics are listed and searchable without it.'],
      ['Is the help file uploaded?', 'No. It is decompiled in your browser.']
    ],
    related: ['chm', 'wri', 'xps']
  },
  {
    slug: 'pub',
    convertTo: 'PDF or SVG',
    category: 'documents',
    exts: ['pub'],
    program: 'Microsoft Publisher',
    title: 'Open Publisher (.pub) Files Online Without Publisher',
    h1: 'Open Microsoft Publisher files online',
    desc: 'View Microsoft Publisher .pub files in your browser on Mac, Chromebook or Windows and save the pages as SVG. Free, no upload, no Publisher needed.',
    engine: 'doc',
    outputs: ['SVG pages', 'PDF (via print)'],
    era: 'Publisher has shipped with Office since 1991 for flyers, newsletters and cards. Microsoft is retiring it in October 2026.',
    about: [
      'Publisher files are only readable by Publisher itself, which never existed for Mac and is being retired from Microsoft 365 in October 2026. That leaves years of newsletters, church bulletins, flyers and school cards in .pub files nothing else opens.',
      'This page reads the publication with libmspub, the open-source library LibreOffice Draw uses for Publisher files, and draws each page in your browser. Text, shapes, tables and colours come through; some effects and embedded fonts may look different from the original.'
    ],
    faq: [
      ['How do I open a .pub file without Publisher?', 'Drop it on this page. Each page is drawn in your browser and nothing is uploaded.'],
      ['How do I open a Publisher file on a Mac?', 'Publisher was never made for Mac. Open this page in Safari and drop the file to see the pages.'],
      ['What happens to my Publisher files when Microsoft retires Publisher?', 'Microsoft says Publisher stops being supported in October 2026. Files you keep will still open here, because this page does not depend on Publisher at all.'],
      ['How do I convert a .pub file to PDF?', 'Open it here and use Print > Save as PDF in your browser.'],
      ['Is my file uploaded?', 'No. It is read entirely in your browser.']
    ],
    related: ['wpd', 'xps', 'wps']
  },
  {
    slug: 'wpd',
    needs: 'WordPerfect',
    category: 'documents',
    exts: ['wpd', 'wp', 'wp5', 'wp6', 'wp4', 'wp7', 'wpt'],
    program: 'WordPerfect',
    title: 'Open WordPerfect Files (.wpd, .wp) Online, Free',
    h1: 'Open WordPerfect files online',
    desc: 'Read WordPerfect .wpd and .wp documents in your browser and save them as Word-compatible HTML, text or PDF. Free, no upload, no WordPerfect needed.',
    engine: 'doc',
    outputs: ['Word-compatible HTML', 'plain text', 'PDF (via print)'],
    era: 'WordPerfect ruled word processing on DOS in the late 1980s and is still the standard in many US law firms and courts.',
    about: [
      'WordPerfect has used the .wpd extension since version 6 (1993); WordPerfect 4.2 and 5.x files often have .wp, .wp5 or no extension at all. Microsoft Word opens some of them with an optional converter and garbles others, and Macs, Chromebooks and phones have no reader.',
      'This page reads the document with libwpd, the open-source WordPerfect library LibreOffice uses, and shows it with its paragraphs, fonts, bold and italic, tables and alignment. You can save a copy as HTML that Word, Pages and Google Docs open, as plain text, or as a PDF from the print dialog.'
    ],
    faq: [
      ['How do I open a .wpd file without WordPerfect?', 'Drop it on this page. It is read in your browser and displayed as a document. Nothing is uploaded and nothing needs installing.'],
      ['How do I convert WPD to Word?', 'Open the file here and choose "Download as Word-compatible HTML". Open that file in Word and use Save As > Word Document (.docx).'],
      ['How do I open a WordPerfect file on a Mac?', 'Use this page in Safari, Chrome or Firefox. Pages cannot read WordPerfect files, but it opens the HTML copy you can download here.'],
      ['Can it open WordPerfect 5.1 files from DOS?', 'Yes. libwpd reads WordPerfect 4.2, 5.x, 6 through X9 and later. Old DOS files often have no extension; drop them on the home page and they are recognised from their contents.'],
      ['What about password-protected WordPerfect files?', 'You will be asked for the password, and the file is decrypted in your browser.'],
      ['Is my document uploaded?', 'No. It is read entirely in this browser tab.']
    ],
    related: ['wps', 'cwk', 'wri']
  },
  {
    slug: 'cwk',
    convertTo: 'HTML, PDF or Excel',
    needs: 'ClarisWorks or AppleWorks',
    category: 'documents',
    exts: ['cwk', 'cws', 'cwd', 'cwdb', 'cwpt', 'cwgr', 'cwss'],
    program: 'ClarisWorks and AppleWorks',
    title: 'Open ClarisWorks and AppleWorks (.cwk) Files Online',
    h1: 'Open ClarisWorks and AppleWorks files online',
    desc: 'Read ClarisWorks and AppleWorks 6 .cwk documents on any computer and save them as HTML, text or PDF. Free, no upload. Pages dropped support in 2013.',
    engine: 'doc',
    outputs: ['Word-compatible HTML', 'plain text', 'PDF (via print)', 'CSV for spreadsheets'],
    era: 'ClarisWorks (1991), renamed AppleWorks 5 and 6, shipped on every school Mac for a decade. Apple discontinued it in 2007.',
    about: [
      'ClarisWorks and AppleWorks saved word-processing, spreadsheet, drawing and database documents with the .cwk extension (templates were .cws). Pages and Numbers could import AppleWorks 6 files until 2013, when Apple removed the importer; nothing current on a Mac opens them.',
      'This page reads the file with libmwaw, the open-source classic Mac document library behind LibreOffice, and shows it in the browser. Word-processing documents keep their text and formatting, spreadsheets come out as tables you can save as Excel or CSV, and drawings are shown as pictures.'
    ],
    faq: [
      ['How do I open a .cwk file on a modern Mac?', 'Drop it on this page in Safari. Pages no longer imports AppleWorks files, but this reads them in the browser and lets you save a copy that Pages opens.'],
      ['How do I open a ClarisWorks file on Windows?', 'Drop it here in any browser and save it as HTML or text for Word, or CSV for Excel.'],
      ['My ClarisWorks file has no .cwk extension. Will it work?', 'Yes. Files copied off old Macs often lost their extension; drop it on the home page and it is recognised from its contents.'],
      ['Can it open ClarisWorks spreadsheets and drawings?', 'Yes. Spreadsheets are shown as tables and can be saved as Excel or CSV; drawings are shown as images.'],
      ['Is my file uploaded?', 'No. It is read entirely in your browser.']
    ],
    related: ['macwrite', 'wpd', 'wps']
  },
  {
    slug: 'wps',
    category: 'documents',
    exts: ['wps'],
    program: 'Microsoft Works',
    title: 'Open Microsoft Works WPS Files Online, Free | No Upload',
    h1: 'Open Microsoft Works documents (.wps) online',
    desc: 'Read Microsoft Works .wps word-processor documents in your browser and save them as Word-compatible HTML, text or PDF. Free, nothing uploaded.',
    engine: 'doc',
    outputs: ['Word-compatible HTML', 'plain text', 'PDF (via print)'],
    era: 'Microsoft Works came on most home PCs from the late 1980s until 2009; its word processor saved .wps files.',
    about: [
      'Works for DOS and Works 2 to 9 for Windows all wrote .wps documents, in several different internal formats. Microsoft stopped shipping the Works converter for Word years ago, so current Office versions cannot open most of them. (Note that WPS Office, an unrelated suite, uses the same extension for its own files.)',
      'This page reads Works documents with libwps, the open-source library LibreOffice uses, and shows them with their formatting in your browser. Save a copy as HTML for Word, as text, or as a PDF.'
    ],
    faq: [
      ['How do I open a .wps file on Windows 10 or 11?', 'Drop it on this page. It opens in your browser, and you can save it as an HTML file that Word opens and re-saves as .docx.'],
      ['How do I convert WPS to Word?', 'Open the file here, press "Download as Word-compatible HTML", open the download in Word and save it as a Word document.'],
      ['Can it open files from Works for DOS?', 'Yes. libwps reads Works for DOS and every Windows version of the Works word processor.'],
      ['My .wps file is from WPS Office, not Microsoft Works.', 'WPS Office files use a different format that this page does not read. WPS Office itself is free to download and opens them.'],
      ['Is the document uploaded?', 'No. It is read in your browser.']
    ],
    related: ['wpd', 'wdb', 'xlr']
  },
  {
    slug: 'macwrite',
    needs: 'old Mac software',
    category: 'documents',
    exts: ['mcw', 'mwii', 'mw', 'wn', 'mcw2'],
    program: 'MacWrite and classic Mac word processors',
    title: 'Open MacWrite and Old Mac Word Files Online, Free',
    h1: 'Open MacWrite and old Mac documents online',
    desc: 'Read MacWrite, MacWrite II and Pro, Word 1-5.1 for Mac, WriteNow, Nisus and other classic Mac documents in your browser. Free, no upload.',
    engine: 'doc',
    outputs: ['Word-compatible HTML', 'plain text', 'PDF (via print)'],
    era: 'MacWrite shipped with the first Macintosh in 1984; Word 5.1 for Mac (1992) is still remembered as the best Word ever made.',
    about: [
      'Documents from classic Mac OS rarely have an extension: the Mac stored the file type separately, and it is lost when files are copied to a PC, a USB stick or a modern Mac. Current versions of Word and Pages cannot open MacWrite, early Word for Mac, WriteNow, Nisus Writer, FullWrite, MindWrite or most of their contemporaries.',
      'This page reads them with libmwaw, which understands over a hundred classic Mac formats, and shows the text with its formatting. Drop the file even if it has no extension; it is recognised from its contents.'
    ],
    faq: [
      ['How do I open a MacWrite file?', 'Drop it on this page. It is read in your browser and you can save it as HTML, text or PDF.'],
      ['How do I open an old Word for Mac 5.1 document?', 'Drop it here. Word 1 to 5.1 for Mac files are read by libmwaw and shown with their formatting.'],
      ['My old Mac file has no extension and nothing opens it.', 'Drop it on the home page. The site reads the first bytes to work out the program that made it.'],
      ['What if the file is inside a .sit or .hqx archive?', 'Unpack it first on our sister site macemu.com, which opens StuffIt and BinHex archives, then drop the document here.'],
      ['Is my file uploaded?', 'No. It is read in your browser.']
    ],
    related: ['cwk', 'wpd', 'wri']
  },
  {
    slug: 'wri',
    fallback: 'doc',
    category: 'documents',
    exts: ['wri'],
    program: 'Windows Write',
    title: 'Open WRI Files Online (Windows Write) | Free, No Upload',
    h1: 'Open Windows Write (.wri) files online',
    desc: 'Read old Windows Write .wri documents in your browser and save them as text, HTML or PDF. Free, private, nothing uploaded. Works on Windows 11 and Mac.',
    engine: 'wri',
    outputs: ['plain text', 'HTML', 'PDF (via print)'],
    era: 'Write was the word processor bundled with Windows 1.0 to 3.11. WordPad replaced it in Windows 95, and Microsoft removed WordPad itself in 2024.',
    about: [
      'Windows Write saved .wri files: text with fonts, bold, italic, underline, paragraph alignment and page headers. WordPad could open them for decades, but WordPad no longer ships with Windows 11 24H2 and Word refuses the format.',
      'This page decodes the .wri structure directly, keeps the character and paragraph formatting it can, and lets you save the document as plain text, as HTML that Word opens, or as a PDF from the print dialog. Embedded pictures (OLE objects and bitmaps) are skipped and marked in the text.'
    ],
    faq: [
      ['How do I open a .wri file on Windows 11?', 'Windows 11 24H2 removed WordPad, the last Microsoft program that opened .wri. Drop the file on this page to read it, then save it as HTML or text to open in Word.'],
      ['How do I open a .wri file on a Mac?', 'Drop it here in any browser. TextEdit and Pages cannot read Write files, but the converted HTML or text opens in both.'],
      ['Can I convert WRI to Word?', 'Yes. Download the HTML version and open it in Word, then save as .docx. Formatting such as bold, italic and alignment is kept.'],
      ['Are pictures in the document kept?', 'Not yet. Embedded pictures are marked with a placeholder so you know where they were.'],
      ['Is my document uploaded?', 'No. It is read entirely in your browser tab.']
    ],
    related: ['chm', 'xps', 'wk1']
  },
  {
    slug: 'worddos',
    category: 'documents',
    needs: 'Word for DOS',
    exts: ['doc'],
    program: 'Word for DOS',
    title: 'Open Word for DOS Files (.doc) Online, Free | No Upload',
    h1: 'Open Microsoft Word for DOS files online',
    desc: 'Read .doc files from Microsoft Word for DOS (versions 3 to 6) in your browser and save them as HTML, text or PDF. Free, nothing uploaded.',
    engine: 'doc',
    fallback: 'wri',
    outputs: ['Word-compatible HTML', 'plain text', 'PDF (via print)'],
    era: 'Word for DOS shipped from 1983 to 1993; its .doc files predate the Word 97 format that modern Word expects.',
    about: [
      'Microsoft Word ran on DOS for a decade before Windows took over, and saved its documents as .doc, the same extension later Word versions used for a completely different format. Current Word either refuses these early files or opens them as garbled text, and LibreOffice is the only common program that still reads them.',
      'This page reads Word for DOS documents in your browser, keeping paragraphs, bold and italic text, footnotes and annotations, then lets you save a copy as HTML (which Word and Google Docs open), as plain text, or as a PDF. A .doc from Word 97 or later is a different format and is not handled here.'
    ],
    faq: [
      ['How do I open a Word for DOS file?', 'Drop the .doc on this page. It is read in your browser and you can save it as HTML, text or PDF.'],
      ['Why does modern Word show my old .doc as gibberish?', 'Word for DOS used its own file format under the same .doc extension. Word 97 and later only read the newer format, so the old file looks like random characters.'],
      ['How do I convert a Word for DOS file to DOCX?', 'Open it here and download the HTML copy, then open that in Word and save it as .docx. The text and basic formatting come through.'],
      ['How can I tell if my .doc is from Word for DOS?', 'Drop it here anyway. If it is a modern Word file, the page says so; files from the 1980s and early 1990s, often with short DOS-style names, are usually Word for DOS.'],
      ['Is my document uploaded?', 'No. It is read by code running in this tab.']
    ],
    related: ['wri', 'wordstar', 'wpd']
  },
  {
    slug: 'psw',
    category: 'documents',
    needs: 'Windows CE or Pocket PC',
    exts: ['psw'],
    program: 'Pocket Word',
    title: 'Open Pocket Word Files (.psw) Online, Free | No Upload',
    h1: 'Open Pocket Word (.psw) files online',
    desc: 'Read Pocket Word .psw documents from Windows CE and Pocket PC handhelds in your browser and save them as HTML, text or PDF. Free, no upload.',
    engine: 'doc',
    outputs: ['Word-compatible HTML', 'plain text', 'PDF (via print)'],
    era: 'Pocket Word came with Windows CE handhelds and Pocket PCs from 1996 until Windows Mobile 5 replaced it with Word Mobile in 2005.',
    about: [
      'Pocket Word saved notes and documents on Windows CE and Pocket PC devices as .psw files. ActiveSync converted them to .doc when it synced, but files copied off a memory card or an old backup stayed in the handheld format, and nothing on a modern computer opens them.',
      'This page reads .psw files in your browser and lets you save the text as HTML (which Word and Google Docs open), as plain text, or as a PDF.'
    ],
    faq: [
      ['How do I open a .psw file?', 'Drop it on this page. The document is read in your browser and you can save it as HTML, text or PDF.'],
      ['How do I convert PSW to DOC or DOCX?', 'Open it here, download the HTML copy, then open that in Word and save it as .doc or .docx.'],
      ['Can Word open Pocket Word files?', 'No. Desktop Word never read .psw; ActiveSync converted them while syncing, which is no longer possible.'],
      ['Is my file uploaded?', 'No. It is read in your browser.']
    ],
    related: ['wps', 'worddos', 'wri']
  },
  {
    slug: 'chm',
    convertTo: 'HTML or PDF',
    needs: 'Windows help viewer',
    category: 'documents',
    exts: ['chm'],
    program: 'Microsoft HTML Help',
    title: 'Open CHM Files Online, Free (Mac, Chromebook, Windows)',
    h1: 'Open CHM help files online',
    desc: 'Read Microsoft .chm help files and e-books in your browser with the table of contents. Works on Mac, Chromebook, Linux and Windows. No upload.',
    engine: 'chm',
    outputs: ['a .zip of every page'],
    era: 'Compiled HTML Help replaced WinHelp in Windows 98 and was used for software manuals and e-books through the 2000s.',
    about: [
      'A .chm file is a compressed bundle of HTML pages, images and a table of contents. Windows still ships a viewer, but it often shows blank pages for downloaded files (they are blocked until you unblock them in Properties), and Mac, ChromeOS and phones have no viewer at all.',
      'This page unpacks the bundle in your browser, builds the table of contents and shows each page. Scripts inside the help file are not run. You can also download every page and image as a .zip.'
    ],
    faq: [
      ['How do I open a CHM file on a Mac?', 'Drop it on this page in Safari, Chrome or Firefox. The table of contents and pages are shown right here; nothing needs installing.'],
      ['Why does my CHM file show blank pages on Windows?', 'Windows blocks help files downloaded from the internet. Right-click the file, choose Properties and tick Unblock. Or open it here, where that block does not apply.'],
      ['Can I convert CHM to PDF?', 'Open a page here and use Print > Save as PDF for that page. A whole-book PDF export is planned.'],
      ['How do I open a CHM file on a Chromebook or Android?', 'Open this page in Chrome and drop or pick the file. It works the same as on a computer.'],
      ['Is the file uploaded?', 'No. It is decompressed in your browser.']
    ],
    related: ['wri', 'xps', 'lzh']
  },
  {
    slug: 'xps',
    needs: 'XPS Viewer',
    category: 'documents',
    exts: ['xps', 'oxps'],
    program: 'Microsoft XPS Document Writer',
    title: 'Open XPS and OXPS Files Online, Free | Convert to PDF',
    h1: 'Open XPS and OXPS files online',
    desc: 'View .xps and .oxps documents in your browser and convert them to PDF. Free, no upload, no XPS Viewer needed. Works on Windows 11, Mac and phones.',
    engine: 'xps',
    outputs: ['PDF'],
    era: 'Microsoft introduced XPS with Windows Vista in 2006 as its answer to PDF; Windows 8 switched to OpenXPS (.oxps).',
    about: [
      'XPS files usually come from "Microsoft XPS Document Writer", a virtual printer that has been in every Windows since Vista, so people end up with .xps or .oxps files when they meant to save a PDF. Windows 10 and 11 removed the XPS Viewer from the default install, and Macs and phones never had one.',
      'This page renders every page in your browser and converts the whole document to a PDF in one click, without sending it to a conversion server.'
    ],
    faq: [
      ['How do I open an XPS file on Windows 11?', 'The XPS Viewer is an optional feature in Windows 11 that is not installed by default. Instead of installing it, drop the file here to view it and save it as a PDF.'],
      ['How do I convert XPS to PDF?', 'Drop the .xps or .oxps file here and press "Download PDF". The conversion runs in your browser.'],
      ['What is the difference between XPS and OXPS?', 'OXPS (OpenXPS) is the standardized version Windows 8 and later produce. Both open here.'],
      ['How do I open an XPS file on a Mac or iPhone?', 'Open this page in Safari and pick the file. It renders the pages and converts to PDF without any app.'],
      ['Is my document uploaded?', 'No. Unlike most XPS converters, nothing leaves your device.']
    ],
    related: ['chm', 'wri', 'emf']
  },

  // ---------------------------------------------------------------- archives
  {
    slug: 'lzh',
    needs: 'LHA software',
    category: 'archives',
    exts: ['lzh', 'lha'],
    program: 'LHA / LHarc',
    title: 'Open LZH and LHA Files Online, Free | No Upload',
    h1: 'Open LZH and LHA files online',
    desc: 'Extract .lzh and .lha archives in your browser on Windows, Mac or a phone. Free, nothing uploaded, no LHA software needed.',
    engine: 'archive',
    outputs: ['each file on its own', 'one .zip of everything'],
    era: 'LHarc (1988) and its successor LHA were the standard archivers in Japan and on the Amiga, and shipped inside countless DOS games and BIOS updates.',
    about: [
      'LZH and LHA archives are common in Japanese software, Amiga downloads, old BIOS and firmware updates and MIDI collections. Windows removed its built-in LZH support in Windows 10, and macOS never had it.',
      'Drop an archive here to list its contents, save single files, or download everything as a standard .zip. Japanese file names are decoded from Shift-JIS where needed.'
    ],
    faq: [
      ['How do I open an LZH file on Windows 10 or 11?', 'Windows dropped LZH support in Windows 10. Drop the file on this page to extract it in your browser instead of installing an archiver.'],
      ['How do I open an LHA file on a Mac?', 'Drop it here in any browser and download the files or a .zip.'],
      ['Can I convert LZH to ZIP?', 'Yes. Open the archive and press "Download all as .zip".'],
      ['Is the archive uploaded?', 'No. It is extracted in your browser.']
    ],
    related: ['arj', 'cab', 'z']
  },
  {
    slug: 'arj',
    needs: 'ARJ software',
    category: 'archives',
    exts: ['arj'],
    program: 'ARJ',
    title: 'Open ARJ Files Online, Free | Extract Without Software',
    h1: 'Open ARJ files online',
    desc: 'Extract .arj archives from the DOS era in your browser. Free, no upload, no ARJ or 7-Zip install. Works on Windows, Mac and phones.',
    engine: 'archive',
    outputs: ['each file on its own', 'one .zip of everything'],
    era: 'Robert Jung released ARJ in 1991. It beat PKZIP on compression and was the archive of choice for BBS downloads and multi-floppy sets.',
    about: [
      'ARJ archives turn up in old BBS collections, shareware CDs and DOS game backups, often split across .arj, .a01, .a02 volumes. Few modern tools open them.',
      'Drop a single .arj here to list and extract its files or convert the whole archive to .zip. Multi-volume sets are not supported yet.'
    ],
    faq: [
      ['How do I open an ARJ file on Windows 11?', 'Drop it here. The files are listed and can be saved one by one or as a .zip, without installing anything.'],
      ['How do I open an ARJ file on a Mac?', 'Use this page in any browser; macOS has no built-in ARJ support.'],
      ['What about .a01, .a02 files?', 'Those are later volumes of a multi-volume ARJ set. Only single-volume archives open here for now.'],
      ['Is anything uploaded?', 'No. Extraction runs in your browser.']
    ],
    related: ['lzh', 'cab', 'z']
  },
  {
    slug: 'cab',
    needs: 'extraction software',
    category: 'archives',
    exts: ['cab'],
    program: 'Microsoft Cabinet',
    title: 'Open CAB Files Online, Free | Extract on Mac or Windows',
    h1: 'Open CAB files online',
    desc: 'Extract Microsoft .cab cabinet files in your browser: drivers, updates and old installers. Free, no upload, works on Mac, Windows and Linux.',
    engine: 'archive',
    outputs: ['each file on its own', 'one .zip of everything'],
    era: 'Microsoft created the Cabinet format in the early 1990s for Windows and Office installation disks, and still uses it for drivers and updates.',
    about: [
      'CAB files hold the contents of Windows drivers, updates and old installers (Windows 95 and Office 97 disks were full of them). Windows Explorer can browse them, but Mac, Linux and phones cannot.',
      'Drop a .cab here to list its files and extract them, or save everything as a .zip.'
    ],
    faq: [
      ['How do I open a CAB file on a Mac?', 'Drop it on this page. The files are listed and you can save them individually or as a .zip.'],
      ['How do I extract a driver from a CAB file?', 'Open the .cab here and download the .inf, .sys and .dll files, or the whole set as a .zip, then point Device Manager at the folder.'],
      ['Is the file uploaded?', 'No. It is extracted in your browser.']
    ],
    related: ['lzh', 'arj', 'z']
  },
  {
    slug: 'z',
    needs: 'Unix tools',
    category: 'archives',
    exts: ['z', 'taz', 'tz'],
    program: 'Unix compress',
    title: 'Open .Z Files Online (Unix compress) | Free, No Upload',
    h1: 'Open .Z compressed files online',
    desc: 'Decompress Unix compress .Z and .tar.Z files in your browser on Windows, Mac or Linux. Free, nothing uploaded.',
    engine: 'archive',
    outputs: ['the decompressed file', 'one .zip of everything'],
    era: 'The compress utility (1984) was the standard Unix compressor until gzip replaced it in the 1990s; old FTP archives are full of .tar.Z files.',
    about: [
      'A .Z file is a single file squeezed with LZW by the Unix compress command; .tar.Z (or .taz) is a whole folder tarred and then compressed. They are common in old scientific data sets and software archives.',
      'Drop the file here to decompress it, and if it holds a tar archive, to list and extract the files inside.'
    ],
    faq: [
      ['How do I open a .Z file on Windows?', 'Drop it on this page to decompress it in your browser, with no tools to install.'],
      ['How do I open a .tar.Z file?', 'Drop it here. It is decompressed and the tar contents are listed so you can save the files or a .zip.'],
      ['Is the file uploaded?', 'No. It is decompressed locally.']
    ],
    related: ['lzh', 'arj', 'cab']
  },


  {
    slug: 'd64',
    category: 'archives',
    exts: ['d64', 'd71', 'd81'],
    program: 'Commodore 64 disk images',
    title: 'Open D64 Files Online (C64 Disk Image) | Free, No Upload',
    h1: 'Open Commodore 64 disk images (.d64) online',
    desc: 'See the directory of a C64 .d64, .d71 or .d81 disk image exactly as LOAD"$",8 showed it, and extract the PRG and SEQ files. Free, in your browser.',
    engine: 'disk',
    outputs: ['each file (.prg, .seq)', 'one .zip of everything'],
    era: 'The 1541 floppy drive stored 170 KB per side; .d64 is a sector-by-sector copy of one of its disks, the standard way C64 software is preserved.',
    about: [
      'A .d64 file is an image of a Commodore 1541 floppy disk (.d71 is the double-sided 1571, .d81 the 3.5-inch 1581). Emulators like VICE load them directly, but you cannot see what is on one, or pull a single program out of it, without special tools.',
      'This page reads the disk directory and shows it the way the C64 printed it, with block counts and file types, then lets you save any file as .prg or .seq, or the whole disk as a .zip.'
    ],
    faq: [
      ['How do I open a .d64 file?', 'Drop it on this page to see its directory and extract the files. To run the programs, load the .d64 or a .prg in a C64 emulator such as VICE.'],
      ['How do I extract a PRG file from a D64?', 'Open the disk here and press Save next to the program, or download every file as a .zip.'],
      ['Why does my disk show no files?', 'Many commercial games used custom loaders and copy protection, storing data outside the normal directory. Those disks only work in an emulator.'],
      ['Can it read .d71 and .d81 images?', 'Yes, both: the 1571 double-sided and 1581 3.5-inch formats.'],
      ['Is the image uploaded?', 'No. It is read in your browser.']
    ],
    related: ['adf', 'tzx', 'lzh']
  },
  {
    slug: 'tzx',
    category: 'archives',
    needs: 'emulator',
    exts: ['tzx', 'tap'],
    program: 'ZX Spectrum tape images',
    title: 'Open TZX and TAP Files Online (ZX Spectrum) | Free',
    h1: 'Open ZX Spectrum tape files (.tzx, .tap) online',
    desc: 'See what is on a ZX Spectrum .tzx or .tap tape, read its BASIC listing and loading screen, and save the tape as WAV audio. Free, nothing uploaded.',
    engine: 'tape',
    convertTo: 'WAV, TAP or text',
    outputs: ['WAV tape audio', 'TAP (from TZX)', 'BASIC listing as text', 'loading screen as PNG'],
    era: 'The ZX Spectrum (1982) loaded its software from cassette; .tap and .tzx files are how that tape library is preserved.',
    about: [
      'A .tap file holds the data blocks a Spectrum saved to tape, one after another. A .tzx file records the tape more exactly, including the fast custom loaders many games used, so it can rebuild the original sound. Emulators load both, but nothing else shows what is inside one.',
      'This page lists every file on the tape the way the Spectrum announced it ("Program: name", "Bytes: name"), prints BASIC programs as a readable listing, shows loading screens, and can turn the whole tape back into a WAV file you can play into a real Spectrum or a tape-loading emulator. A TZX that only uses standard blocks can also be converted to .tap.'
    ],
    faq: [
      ['How do I open a TZX file?', 'Drop it on this page to see the files on the tape, the BASIC listing and the loading screen. To play the game itself, load the .tzx in a Spectrum emulator such as Fuse or ZEsarUX.'],
      ['How do I convert TZX to WAV?', 'Open the file here and press "Download tape audio (.wav)". Play the WAV into a real Spectrum\'s EAR socket, or load it in an emulator that reads audio.'],
      ['How do I convert TZX to TAP?', 'If the tape only uses standard ROM blocks, a "Convert to .tap" button appears after it opens. Tapes with turbo loaders cannot be stored as .tap without losing data.'],
      ['How can I see the BASIC program in a .tap file?', 'Open the file here: every BASIC program on the tape is shown as a listing with its keywords spelled out, and can be saved as a text file.'],
      ['Is the file uploaded?', 'No. It is read in your browser.']
    ],
    related: ['d64', 'adf', 'mod']
  },
  {
    slug: 'adf',
    category: 'archives',
    exts: ['adf'],
    program: 'Amiga disk images',
    title: 'Open ADF Files Online (Amiga Disk Image) | Free',
    h1: 'Open Amiga disk images (.adf) online',
    desc: 'Browse the files on an Amiga .adf floppy disk image (OFS and FFS) in your browser and extract them, without an emulator or ADF tools. Free, no upload.',
    engine: 'disk',
    outputs: ['each file', 'one .zip of everything'],
    era: 'Amiga floppies held 880 KB; .adf (Amiga Disk File) images are how Amiga software, demos and Workbench disks survive today.',
    about: [
      'An .adf file is a block-for-block copy of an Amiga floppy. Emulators such as WinUAE and FS-UAE boot them, but to see the files on one, or copy a document or module off it, you normally need extra tools.',
      'This page reads AmigaDOS disks in both the original (OFS) and Fast File System (FFS) layouts, lists every folder and file, and lets you save them individually or all at once as a .zip. Tracker modules and other formats this site understands can be opened straight from the list.'
    ],
    faq: [
      ['How do I open an ADF file?', 'Drop it on this page to browse the files on the disk and save them. To boot the disk, use an Amiga emulator such as WinUAE or FS-UAE.'],
      ['How do I get files off an Amiga disk image?', 'Open the .adf here and press Save next to a file, or download all of them as a .zip.'],
      ['Why does my game disk show nothing?', 'Most Amiga games used their own disk format instead of AmigaDOS, so there is no directory to read. They only run in an emulator.'],
      ['Is the disk image uploaded?', 'No. It is read in your browser.']
    ],
    related: ['d64', 'mod', 'lzh']
  },

  // ---------------------------------------------------------------- media
  {
    slug: 'wpg',
    category: 'media',
    exts: ['wpg'],
    program: 'WordPerfect Graphics',
    needs: 'WordPerfect',
    title: 'Open WPG Files Online, Free | WordPerfect Graphics to SVG',
    h1: 'Open WordPerfect Graphics (.wpg) files online',
    desc: 'View WordPerfect .wpg clip art and drawings in your browser and save them as SVG or PNG. Free, no upload, no WordPerfect needed.',
    engine: 'doc',
    outputs: ['SVG', 'PDF (via print)'],
    era: 'WordPerfect Graphics was the clip-art format of WordPerfect 5 and 6 and Corel Presentations; thousands of .wpg images shipped on WordPerfect disks and clip-art CDs.',
    about: [
      'WPG files hold vector drawings and bitmaps in WordPerfect’s own format, version 1 (WordPerfect 5) or 2 (WordPerfect 6 and later). Outside WordPerfect Office and LibreOffice Draw almost nothing displays them.',
      'This page reads the picture with libwpg, the open-source WPG library LibreOffice uses, and shows it in your browser as SVG.'
    ],
    faq: [
      ['How do I open a .wpg file?', 'Drop it on this page. The drawing is shown in your browser and can be saved as SVG.'],
      ['How do I convert WPG to PNG or JPG?', 'Open it here, then save the SVG and open it in any image editor, or print the page to PDF.'],
      ['Is the picture uploaded?', 'No. It is read in your browser.']
    ],
    related: ['wpd', 'wmf', 'pict']
  },
  {
    slug: 'pict',
    category: 'media',
    needs: 'old Mac software',
    exts: ['pict', 'pct', 'pic'],
    program: 'Macintosh PICT',
    title: 'Open PICT Files Online, Free | Convert PICT to PNG',
    h1: 'Open Macintosh PICT (.pict, .pct) files online',
    desc: 'View classic Mac PICT images in your browser and convert them to PNG or JPEG. macOS Preview dropped PICT support; this works anywhere. Free, no upload.',
    engine: 'pict',
    outputs: ['PNG', 'JPEG'],
    era: 'PICT was the Macintosh picture format from 1984 until Mac OS X moved to PDF; every copy-and-paste on a classic Mac went through it.',
    about: [
      'Classic Mac clip art, screenshots, scanned photos and the pictures inside old documents are stored as QuickDraw PICT. Apple removed PICT support from Preview and Quick Look in macOS Catalina (10.15), so modern Macs show a blank icon, and Windows never had a viewer.',
      'This page replays the QuickDraw drawing commands in your browser: lines, shapes, text, patterns and both colour and black-and-white bitmaps, then saves the result as PNG or JPEG.'
    ],
    faq: [
      ['How do I open a PICT file on a Mac?', 'Since macOS Catalina, Preview no longer opens PICT files. Drop the file on this page to see it and save a PNG that Preview opens.'],
      ['How do I convert PICT to PNG or JPG?', 'Open the file here and press "Download PNG" or "Download JPEG".'],
      ['How do I open a .pct file on Windows?', 'Drop it on this page in any browser. Windows has no built-in PICT viewer.'],
      ['Some parts of my picture look different. Why?', 'QuickDraw text used classic Mac fonts that modern systems lack, so text is drawn in a similar font. Rare effects such as transfer modes are approximated.'],
      ['Is my image uploaded?', 'No. It is drawn in your browser.']
    ],
    related: ['macwrite', 'wmf', 'cwk']
  },
  {
    slug: 'rm',
    category: 'media',
    exts: ['rm', 'rmvb', 'ra', 'rv'],
    program: 'RealPlayer',
    title: 'Convert RM and RMVB to MP4 Online, Free | No Upload',
    h1: 'Open RealMedia (.rm, .rmvb) files and convert them to MP4',
    desc: 'Play and convert RealMedia .rm, .rmvb and RealAudio .ra files to MP4 or MP3 in your browser. Free, no RealPlayer, no upload.',
    engine: 'realmedia',
    outputs: ['MP4 video', 'MP3 audio'],
    era: 'RealNetworks launched RealAudio in 1995 and RealVideo in 1997; .rmvb was the format of choice for fan-subbed anime and TV in the 2000s.',
    about: [
      'RealMedia files (.rm and the variable-bitrate .rmvb) and RealAudio files (.ra) need RealPlayer, which is now a cloud-tied app most people would rather not install. VLC plays many of them, but phones, editors and most media players do not.',
      'This page converts them in your browser with FFmpeg compiled to WebAssembly: video becomes an H.264 MP4 that plays everywhere, audio-only files become MP3. The converter is downloaded once (about 31 MB) and your file never leaves your device. A .ram file is only a text link to a stream that usually no longer exists, so there is nothing to convert in it.'
    ],
    faq: [
      ['How do I convert RMVB to MP4?', 'Drop the .rmvb file on this page. It is converted to MP4 in your browser and you can download it when it finishes.'],
      ['How do I play a .rm file without RealPlayer?', 'Convert it here to MP4 or MP3, which every phone and computer plays. You can also play the result right on the page.'],
      ['How do I open a RealAudio .ra file?', 'Drop it here and it is converted to MP3.'],
      ['How long does the conversion take?', 'Roughly real time or faster on a laptop for standard-definition video; phones are slower. Audio converts in seconds.'],
      ['Is my video uploaded?', 'No. Only the converter program is downloaded; the video is processed in your browser.']
    ],
    related: ['swf', 'mid', 'mod']
  },
  {
    slug: 'swf',
    needs: 'Flash Player',
    category: 'media',
    exts: ['swf'],
    program: 'Adobe Flash',
    title: 'Open SWF Files Online, Free | Flash Player in Your Browser',
    h1: 'Open SWF files online',
    desc: 'Play .swf Flash games and animations in your browser without Flash Player, using the Ruffle emulator. Free, no upload, no plugin.',
    engine: 'swf',
    outputs: ['Play in the page', 'Full screen'],
    era: 'Adobe ended Flash Player on 31 December 2020 and browsers removed it, stranding two decades of games and animations.',
    about: [
      'A .swf file is a compiled Flash movie: a game, an animation, an e-card or an interactive lesson. Since Flash Player was switched off, double-clicking one does nothing.',
      'This page plays the file with Ruffle, an open-source Flash emulator written in Rust and compiled to WebAssembly. Most ActionScript 1 and 2 content plays well; ActionScript 3 support is good but not complete, so some later games may not run.'
    ],
    faq: [
      ['How do I open a SWF file without Flash Player?', 'Drop it on this page. It plays in your browser through the Ruffle emulator, with no plugin and no download.'],
      ['How do I play a SWF game on a Chromebook or Mac?', 'Open this page and drop the .swf. It runs the same on ChromeOS, macOS, Windows and Linux.'],
      ['Why does my SWF game not work?', 'Some games built with ActionScript 3 use features Ruffle does not support yet, and games that load extra files from their original website will miss those files.'],
      ['Is the file uploaded?', 'No. It is played locally in your browser.']
    ],
    related: ['mid', 'mod', 'wmf']
  },
  {
    slug: 'mid',
    needs: 'MIDI software',
    category: 'media',
    exts: ['mid', 'midi', 'rmi', 'kar'],
    program: 'MIDI',
    title: 'Play MIDI Files Online, Free | Convert MIDI to WAV',
    h1: 'Play MIDI files online',
    desc: 'Play .mid, .midi, .rmi and .kar files in your browser with a General MIDI sound bank and save them as WAV audio. Free, nothing uploaded.',
    engine: 'midi',
    outputs: ['Play in the page', 'WAV audio'],
    era: 'MIDI dates from 1983. In the 1990s it was how PCs played music: game soundtracks, web page tunes and karaoke files.',
    about: [
      'A MIDI file stores notes, not sound, so how it sounds depends on the synthesizer playing it. Windows still includes a basic synth, but macOS, iOS and Android mostly do not, and media players often refuse .mid files.',
      'This page plays the file through a General MIDI sound bank in your browser and can render it to a WAV file you can convert to MP3 or put on a phone. .rmi (RIFF MIDI) and .kar (karaoke) files work too.'
    ],
    faq: [
      ['How do I play a MIDI file on a Mac or iPhone?', 'Drop it on this page in Safari. It plays with a built-in General MIDI sound bank, no app needed.'],
      ['How do I convert MIDI to WAV or MP3?', 'Press "Save as WAV" after the file loads. The WAV can be converted to MP3 with any audio converter.'],
      ['Why does my MIDI sound different from the original game?', 'MIDI files only contain notes. Each sound card or synth used its own instrument sounds, so the same file can sound quite different.'],
      ['Is the file uploaded?', 'No. It is played and rendered in your browser.']
    ],
    related: ['mod', 'swf', 'lzh']
  },
  {
    slug: 'mod',
    needs: 'tracker software',
    category: 'media',
    exts: ['mod', 'xm', 's3m', 'it', 'mptm', 'mtm', '669', 'med'],
    program: 'Amiga and PC music trackers',
    title: 'Play MOD, XM, S3M and IT Tracker Music Online, Free',
    h1: 'Play MOD, XM, S3M and IT files online',
    desc: 'Play Amiga and PC tracker modules (.mod, .xm, .s3m, .it) in your browser. Free, no upload, no tracker software needed.',
    engine: 'tracker',
    outputs: ['Play in the page'],
    era: 'Ultimate Soundtracker introduced the .mod format on the Amiga in 1987; FastTracker 2 (.xm), Scream Tracker 3 (.s3m) and Impulse Tracker (.it) carried it through the PC demoscene.',
    about: [
      'Tracker modules contain both the samples and the note patterns, so they sound the same everywhere, but most media players no longer play them. Game soundtracks (Unreal, Deus Ex, many shareware titles) and demoscene music are stored this way.',
      'This page plays modules with libopenmpt, the library behind OpenMPT, compiled to WebAssembly.'
    ],
    faq: [
      ['How do I play a .mod file?', 'Drop it on this page and it starts playing. .xm, .s3m, .it and several rarer tracker formats work too.'],
      ['How do I play tracker music on a Mac or phone?', 'Use this page in any browser. No app is needed.'],
      ['Is the file uploaded?', 'No. It is played in your browser.']
    ],
    related: ['mid', 'swf', 'lzh']
  },
  {
    slug: 'wmf',
    needs: 'graphics software',
    category: 'media',
    exts: ['wmf', 'wmz'],
    program: 'Windows Metafile',
    title: 'Open WMF Files Online, Free | Convert WMF to PNG or SVG',
    h1: 'Open WMF files online',
    desc: 'View Windows Metafile .wmf and .wmz clip art in your browser and save it as PNG or SVG. Free, no upload, works on Mac and Windows.',
    engine: 'metafile',
    outputs: ['PNG', 'SVG'],
    era: 'Windows Metafile dates from Windows 3.0 (1990) and was the format of Microsoft Office clip art for over a decade.',
    about: [
      'WMF is a vector drawing format: a recording of Windows drawing commands. Old Office clip art, Corel and Visio exports and many 1990s documents use it, and .wmz is the same thing gzip-compressed. Browsers, macOS Preview and most image editors cannot display it.',
      'This page replays the drawing commands in your browser and lets you save the picture as a PNG at any size or as an SVG.'
    ],
    faq: [
      ['How do I open a WMF file on a Mac?', 'Drop it on this page. It is drawn in your browser and can be saved as PNG or SVG for Preview, Keynote or Pages.'],
      ['How do I convert WMF to PNG?', 'Open the file here, choose a size and press "Download PNG".'],
      ['What is a .wmz file?', 'A gzip-compressed WMF. It opens here the same way.'],
      ['Is the file uploaded?', 'No. It is rendered locally.']
    ],
    related: ['emf', 'xps', 'swf']
  },
  {
    slug: 'emf',
    needs: 'graphics software',
    category: 'media',
    exts: ['emf', 'emz'],
    program: 'Enhanced Metafile',
    title: 'Open EMF Files Online, Free | Convert EMF to PNG or SVG',
    h1: 'Open EMF files online',
    desc: 'View Enhanced Metafile .emf and .emz images in your browser and convert them to PNG or SVG. Free, nothing uploaded.',
    engine: 'metafile',
    outputs: ['PNG', 'SVG'],
    era: 'Enhanced Metafile replaced WMF with Windows NT and 95; it is still how Office copies charts and diagrams, and how Windows spools print jobs.',
    about: [
      'EMF files come from Office charts and diagrams, Visio and AutoCAD exports, and Windows print spool folders. .emz is a gzip-compressed EMF. Outside Windows almost nothing displays them.',
      'This page renders the drawing in your browser and saves it as PNG or SVG.'
    ],
    faq: [
      ['How do I open an EMF file on a Mac?', 'Drop it here. The image is drawn in your browser and can be saved as PNG or SVG.'],
      ['How do I convert EMF to PNG?', 'Open it on this page and press "Download PNG".'],
      ['What is an .emz file?', 'A gzip-compressed EMF, often found inside Word and PowerPoint files. It opens here directly.'],
      ['Is the file uploaded?', 'No. Rendering happens in your browser.']
    ],
    related: ['wmf', 'xps', 'chm']
  }
];

// Formats a sister site already owns. The home page sniffer sends these there
// instead of competing with it in search.
export const ELSEWHERE = [
  { exts: ['sit', 'sea', 'cpt'], name: 'StuffIt archive', url: 'https://macemu.com/open-sit-file/' },
  { exts: ['hqx'], name: 'BinHex file', url: 'https://macemu.com/open-hqx-file/' },
  { exts: ['dsk', 'img', 'image', 'toast'], name: 'classic Mac disk image', url: 'https://macemu.com/load-mac-file/' },
  { exts: ['exe', 'com'], name: 'Windows or DOS program', url: 'https://exebrowser.com/load-exe/' }
];

// Formats with pages on the way. The sniffer recognises them and says so
// honestly instead of failing.
export const PLANNED = [
  { exts: ['dcr'], name: 'Shockwave movie' },
  { exts: ['sid'], name: 'C64 SID tune' }
];
