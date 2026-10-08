// Second entry point over the Document Liberation Project libraries, for
// the drawing, page layout, StarOffice and e-book formats. Built by
// native/build.sh into src/client/vendor/dlp2.{mjs,wasm}, separate from
// docconv so pages that don't need these libraries don't download them.
//
//   const char *oof_convert(const char *path, const char *password)
//
// Same output as docconv.cpp, so the doc engine shows either:
//   "html <library> <format>\n<html>"
//   "csv <library> <format>\n<sheet1>\f<sheet2>..."
//   "svg <library> <format>\n<page1>\f<page2>..."
//   "error <reason>\n"   reason: unsupported | password | parse
// The caller frees the result with free().

#include <cstdlib>
#include <cstring>
#include <string>

#include <librevenge/librevenge.h>
#include <librevenge-stream/librevenge-stream.h>
#include <librevenge-generators/librevenge-generators.h>
#include <libcdr/libcdr.h>
#include <libvisio/libvisio.h>
#include <libpagemaker/libpagemaker.h>
#include <libfreehand/libfreehand.h>
#include <libqxp/libqxp.h>
#include <libzmf/libzmf.h>
#include <libstaroffice/libstaroffice.hxx>
#include <libe-book/libe-book.h>
#include <libabw/libabw.h>

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

static std::string joinSvg(const RVNGStringVector &v) {
  std::string out;
  for (unsigned i = 0; i < v.size(); ++i) {
    if (i) out += '\f';
    out += "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n";
    out += v[i].cstr();
  }
  return out;
}

// The drawing libraries share one shape: isSupported(input), parse(input, painter).
template <typename Doc>
static const char *tryDrawing(const char *path, const char *name) {
  RVNGFileStream input(path);
  if (!Doc::isSupported(&input)) return nullptr;
  input.seek(0, librevenge::RVNG_SEEK_SET);
  RVNGStringVector pages;
  librevenge::RVNGSVGDrawingGenerator gen(pages, "svg");
  if (!Doc::parse(&input, &gen) || !pages.size()) return finish("error parse\n");
  return finish(std::string("svg ") + name + "\n" + joinSvg(pages));
}

static const char *tryQxp(const char *path) {
  RVNGFileStream input(path);
  if (!libqxp::QXPDocument::isSupported(&input)) return nullptr;
  input.seek(0, librevenge::RVNG_SEEK_SET);
  RVNGStringVector pages;
  librevenge::RVNGSVGDrawingGenerator gen(pages, "svg");
  if (libqxp::QXPDocument::parse(&input, &gen) != libqxp::QXPDocument::RESULT_OK || !pages.size()) return finish("error parse\n");
  return finish(std::string("svg libqxp quarkxpress\n") + joinSvg(pages));
}

static const char *tryZmf(const char *path) {
  RVNGFileStream input(path);
  if (!libzmf::ZMFDocument::isSupported(&input)) return nullptr;
  input.seek(0, librevenge::RVNG_SEEK_SET);
  RVNGStringVector pages;
  librevenge::RVNGSVGDrawingGenerator gen(pages, "svg");
  if (!libzmf::ZMFDocument::parse(&input, &gen) || !pages.size()) return finish("error parse\n");
  return finish(std::string("svg libzmf zoner\n") + joinSvg(pages));
}

static const char *tryStarOffice(const char *path, const char *password) {
  RVNGFileStream input(path);
  STOFFDocument::Kind kind;
  STOFFDocument::Confidence c = STOFFDocument::isFileFormatSupported(&input, kind);
  if (c == STOFFDocument::STOFF_C_NONE) return nullptr;
  if (c == STOFFDocument::STOFF_C_UNSUPPORTED_ENCRYPTION) return finish("error password\n");
  input.seek(0, librevenge::RVNG_SEEK_SET);
  const char *pw = password && *password ? password : nullptr;
  STOFFDocument::Result r;
  std::string head, body;
  if (kind == STOFFDocument::STOFF_K_TEXT) {
    RVNGString html;
    librevenge::RVNGHTMLTextGenerator gen(html);
    r = STOFFDocument::parse(&input, &gen, pw);
    head = "html";
    body = html.cstr();
  } else if (kind == STOFFDocument::STOFF_K_SPREADSHEET || kind == STOFFDocument::STOFF_K_DATABASE) {
    RVNGStringVector sheets;
    librevenge::RVNGCSVSpreadsheetGenerator gen(sheets, false);
    r = STOFFDocument::parse(&input, &gen, pw);
    head = "csv";
    body = joinPages(sheets);
  } else if (kind == STOFFDocument::STOFF_K_PRESENTATION) {
    RVNGStringVector pages;
    librevenge::RVNGSVGPresentationGenerator gen(pages);
    r = STOFFDocument::parse(&input, &gen, pw);
    head = "svg";
    body = joinSvg(pages);
  } else {
    RVNGStringVector pages;
    librevenge::RVNGSVGDrawingGenerator gen(pages, "svg");
    r = STOFFDocument::parse(&input, &gen, pw);
    head = "svg";
    body = joinSvg(pages);
  }
  if (r == STOFFDocument::STOFF_R_PASSWORD_MISSMATCH_ERROR) return finish("error password\n");
  if (r != STOFFDocument::STOFF_R_OK) return finish("error parse\n");
  return finish(head + " libstaroffice " + std::to_string(int(kind)) + "\n" + body);
}

static const char *tryAbw(const char *path) {
  RVNGFileStream input(path);
  if (!libabw::AbiDocument::isFileFormatSupported(&input)) return nullptr;
  input.seek(0, librevenge::RVNG_SEEK_SET);
  RVNGString html;
  librevenge::RVNGHTMLTextGenerator gen(html);
  if (!libabw::AbiDocument::parse(&input, &gen)) return finish("error parse\n");
  return finish(std::string("html libabw abiword\n") + html.cstr());
}

// weak: accept libe-book's "maybe" (plain-text-like formats) only as a last resort.
static const char *tryEbook(const char *path, const char *password, bool weak) {
  RVNGFileStream input(path);
  libebook::EBOOKDocument::Type type = libebook::EBOOKDocument::TYPE_UNKNOWN;
  libebook::EBOOKDocument::Confidence c = libebook::EBOOKDocument::isSupported(&input, &type);
  if (c == libebook::EBOOKDocument::CONFIDENCE_NONE || (c == libebook::EBOOKDocument::CONFIDENCE_WEAK && !weak)) return nullptr;
  if (c == libebook::EBOOKDocument::CONFIDENCE_UNSUPPORTED_ENCRYPTION) return finish("error password\n");
  input.seek(0, librevenge::RVNG_SEEK_SET);
  RVNGString html;
  librevenge::RVNGHTMLTextGenerator gen(html);
  libebook::EBOOKDocument::Result r = libebook::EBOOKDocument::parse(&input, &gen, type, password && *password ? password : nullptr);
  if (r == libebook::EBOOKDocument::RESULT_PASSWORD_MISMATCH || r == libebook::EBOOKDocument::RESULT_UNSUPPORTED_ENCRYPTION) return finish("error password\n");
  if (r != libebook::EBOOKDocument::RESULT_OK) return finish("error parse\n");
  return finish(std::string("html libe-book ") + std::to_string(int(type)) + "\n" + html.cstr());
}

extern "C" const char *oof_convert(const char *path, const char *password) {
  if (const char *r = tryDrawing<libcdr::CMXDocument>(path, "libcdr cmx")) return r;
  if (const char *r = tryDrawing<libcdr::CDRDocument>(path, "libcdr cdr")) return r;
  if (const char *r = tryDrawing<libvisio::VisioDocument>(path, "libvisio visio")) return r;
  if (const char *r = tryDrawing<libpagemaker::PMDocument>(path, "libpagemaker pagemaker")) return r;
  if (const char *r = tryDrawing<libfreehand::FreeHandDocument>(path, "libfreehand freehand")) return r;
  if (const char *r = tryQxp(path)) return r;
  if (const char *r = tryZmf(path)) return r;
  if (const char *r = tryStarOffice(path, password)) return r;
  if (const char *r = tryAbw(path)) return r;
  if (const char *r = tryEbook(path, password, false)) return r;
  if (const char *r = tryEbook(path, password, true)) return r;
  return finish("error unsupported\n");
}
