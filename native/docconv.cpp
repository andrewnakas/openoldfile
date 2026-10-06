// One entry point over the Document Liberation Project import libraries,
// compiled to WebAssembly by native/build.sh.
//
//   const char *oof_convert(const char *path, const char *password)
//
// Tries libmspub (Publisher), libwpd (WordPerfect), libwps (Works, Word for DOS, Lotus/Quattro
// text...) and libmwaw (ClarisWorks, MacWrite, Word for Mac and ~100 other
// classic Mac formats) in turn. Returns a malloc'd UTF-8 string whose first
// line says what follows, then the body:
//   "html <library> <format>\n<html>"     word-processing documents
//   "csv <library> <format>\n<sheet1>\f<sheet2>..."   spreadsheets/databases
//   "svg <library> <format>\n<page1>\f<page2>..."     drawings, paint, slides
//   "error <reason>\n"                    nothing could read it
// reason: unsupported | password | parse
// The caller frees the result with free().

#include <cstdlib>
#include <cstring>
#include <string>

#include <librevenge/librevenge.h>
#include <librevenge-stream/librevenge-stream.h>
#include <librevenge-generators/librevenge-generators.h>
#include <libwpd/libwpd.h>
#include <libwps/libwps.h>
#include <libmwaw/libmwaw.hxx>
#include <libmspub/libmspub.h>
#include <libwpg/libwpg.h>

using librevenge::RVNGFileStream;
using librevenge::RVNGString;
using librevenge::RVNGStringVector;

static const char *finish(const std::string &s) {
  char *out = static_cast<char *>(malloc(s.size() + 1));
  memcpy(out, s.c_str(), s.size() + 1);
  return out;
}

static std::string joinPages(const RVNGStringVector &v) {
  std::string out;
  for (unsigned i = 0; i < v.size(); ++i) {
    if (i) out += '\f';
    out += v[i].cstr();
  }
  return out;
}

// SVG pages from librevenge need an XML header to stand alone.
static std::string joinSvg(const RVNGStringVector &v) {
  std::string out;
  for (unsigned i = 0; i < v.size(); ++i) {
    if (i) out += '\f';
    out += "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n";
    out += v[i].cstr();
  }
  return out;
}

static const char *tryWpd(const char *path, const char *password) {
  RVNGFileStream input(path);
  if (libwpd::WPDocument::isFileFormatSupported(&input) == libwpd::WPD_CONFIDENCE_NONE) return nullptr;
  RVNGString html;
  librevenge::RVNGHTMLTextGenerator gen(html);
  input.seek(0, librevenge::RVNG_SEEK_SET);
  libwpd::WPDResult r = libwpd::WPDocument::parse(&input, &gen, password && *password ? password : nullptr);
  if (r == libwpd::WPD_PASSWORD_MISSMATCH_ERROR) return finish("error password\n");
  if (r != libwpd::WPD_OK) return finish("error parse\n");
  return finish(std::string("html libwpd wordperfect\n") + html.cstr());
}

static const char *tryWps(const char *path, const char *password) {
  RVNGFileStream input(path);
  libwps::WPSKind kind;
  libwps::WPSCreator creator;
  bool needEncoding = false;
  if (libwps::WPSDocument::isFileFormatSupported(&input, kind, creator, needEncoding) == libwps::WPS_CONFIDENCE_NONE) return nullptr;
  input.seek(0, librevenge::RVNG_SEEK_SET);
  const char *pw = password ? password : "";
  libwps::WPSResult r;
  std::string head, body;
  if (kind == libwps::WPS_TEXT) {
    RVNGString html;
    librevenge::RVNGHTMLTextGenerator gen(html);
    r = libwps::WPSDocument::parse(&input, &gen, pw, "");
    head = "html";
    body = html.cstr();
  } else {
    RVNGStringVector sheets;
    librevenge::RVNGCSVSpreadsheetGenerator gen(sheets, false);
    r = libwps::WPSDocument::parse(&input, &gen, pw, "");
    head = "csv";
    body = joinPages(sheets);
  }
  if (r == libwps::WPS_ENCRYPTION_ERROR) return finish("error password\n");
  if (r != libwps::WPS_OK) return finish("error parse\n");
  return finish(head + " libwps " + std::to_string(int(creator)) + "\n" + body);
}

static const char *tryMwaw(const char *path, const char *password) {
  RVNGFileStream input(path);
  MWAWDocument::Type type;
  MWAWDocument::Kind kind;
  if (MWAWDocument::isFileFormatSupported(&input, type, kind) == MWAWDocument::MWAW_C_NONE) return nullptr;
  input.seek(0, librevenge::RVNG_SEEK_SET);
  const char *pw = password && *password ? password : nullptr;
  MWAWDocument::Result r;
  std::string head, body;
  if (kind == MWAWDocument::MWAW_K_TEXT) {
    RVNGString html;
    librevenge::RVNGHTMLTextGenerator gen(html);
    r = MWAWDocument::parse(&input, &gen, pw);
    head = "html";
    body = html.cstr();
  } else if (kind == MWAWDocument::MWAW_K_SPREADSHEET || kind == MWAWDocument::MWAW_K_DATABASE) {
    RVNGStringVector sheets;
    librevenge::RVNGCSVSpreadsheetGenerator gen(sheets, false);
    r = MWAWDocument::parse(&input, &gen, pw);
    head = "csv";
    body = joinPages(sheets);
  } else if (kind == MWAWDocument::MWAW_K_PRESENTATION) {
    RVNGStringVector pages;
    librevenge::RVNGSVGPresentationGenerator gen(pages);
    r = MWAWDocument::parse(&input, &gen, pw);
    head = "svg";
    body = joinSvg(pages);
  } else {
    RVNGStringVector pages;
    librevenge::RVNGSVGDrawingGenerator gen(pages, "svg");
    r = MWAWDocument::parse(&input, &gen, pw);
    head = "svg";
    body = joinSvg(pages);
  }
  if (r == MWAWDocument::MWAW_R_PASSWORD_MISSMATCH_ERROR) return finish("error password\n");
  if (r != MWAWDocument::MWAW_R_OK) return finish("error parse\n");
  return finish(head + " libmwaw " + std::to_string(int(type)) + "\n" + body);
}

// Publisher pages come out as SVG, one per page.
static const char *tryMspub(const char *path) {
  RVNGFileStream input(path);
  if (!libmspub::MSPUBDocument::isSupported(&input)) return nullptr;
  input.seek(0, librevenge::RVNG_SEEK_SET);
  RVNGStringVector pages;
  librevenge::RVNGSVGDrawingGenerator gen(pages, "svg");
  if (!libmspub::MSPUBDocument::parse(&input, &gen) || !pages.size()) return finish("error parse\n");
  return finish(std::string("svg libmspub publisher\n") + joinSvg(pages));
}

// WordPerfect Graphics (.wpg): one SVG page.
static const char *tryWpg(const char *path) {
  RVNGFileStream input(path);
  if (!libwpg::WPGraphics::isSupported(&input)) return nullptr;
  input.seek(0, librevenge::RVNG_SEEK_SET);
  RVNGStringVector pages;
  librevenge::RVNGSVGDrawingGenerator gen(pages, "svg");
  if (!libwpg::WPGraphics::parse(&input, &gen) || !pages.size()) return finish("error parse\n");
  return finish(std::string("svg libwpg wpg\n") + joinSvg(pages));
}

extern "C" const char *oof_convert(const char *path, const char *password) {
  if (const char *r = tryWpg(path)) return r;
  if (const char *r = tryMspub(path)) return r;
  if (const char *r = tryWpd(path, password)) return r;
  if (const char *r = tryWps(path, password)) return r;
  if (const char *r = tryMwaw(path, password)) return r;
  return finish("error unsupported\n");
}

// Embedded drawings: WordPerfect Graphics (libwpg) or libmwaw's own
// serialisation ("image/mwaw-odg"), turned into SVG.
//   const char *oof_decode_graphic(const char *path)  -> malloc'd SVG or ""
extern "C" const char *oof_decode_graphic(const char *path) {
  RVNGFileStream input(path);
  librevenge::RVNGBinaryData data;
  const unsigned char *buf;
  unsigned long n = 0;
  while (!input.isEnd() && (buf = input.read(65536, n)) && n) data.append(buf, n);
  RVNGStringVector pages;
  librevenge::RVNGSVGDrawingGenerator gen(pages, "svg");
  librevenge::RVNGStringVector wpgPages;
  librevenge::RVNGSVGDrawingGenerator wpgGen(wpgPages, "svg");
  RVNGFileStream again(path);
  if (libwpg::WPGraphics::isSupported(&again)) {
    again.seek(0, librevenge::RVNG_SEEK_SET);
    if (libwpg::WPGraphics::parse(&again, &wpgGen) && wpgPages.size())
      return finish(std::string("<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n") + wpgPages[0].cstr());
  }
  if (!MWAWDocument::decodeGraphic(data, &gen) || !pages.size()) return finish("");
  return finish(std::string("<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n") + pages[0].cstr());
}
