#!/bin/sh
# Builds native/docconv.cpp and the Document Liberation Project libraries it
# wraps into WebAssembly: src/client/vendor/docconv.{mjs,wasm}.
#
# Needs: emscripten (emcc), boost headers (brew install boost), curl, xz.
# Sources are fetched into native/src and built into native/prefix; both
# are gitignored. Re-running skips libraries that are already installed.
#
#   sh native/build.sh

set -eu
HERE=$(cd "$(dirname "$0")" && pwd)
SRC=$HERE/src
P=$HERE/prefix
INC=$HERE/include
OUT=$HERE/../src/client/vendor
MIRROR=https://dev-www.libreoffice.org/src

mkdir -p "$SRC" "$P" "$INC" "$OUT"
# Boost is header-only for these libraries; expose just boost/, not all of
# /opt/homebrew/include (whose zlib.h would shadow Emscripten's).
BOOST=$(brew --prefix boost 2>/dev/null || echo /opt/homebrew)/include/boost
ln -sfn "$BOOST" "$INC/boost"

# The tarballs' config.sub predates Emscripten.
[ -f "$HERE/config.sub" ] || curl -sfL -o "$HERE/config.sub" https://git.savannah.gnu.org/cgit/config.git/plain/config.sub
[ -f "$HERE/config.guess" ] || curl -sfL -o "$HERE/config.guess" https://git.savannah.gnu.org/cgit/config.git/plain/config.guess

export REVENGE_CFLAGS="-I$P/include/librevenge-0.0" REVENGE_LIBS="-L$P/lib -lrevenge-0.0"
export REVENGE_STREAM_CFLAGS="$REVENGE_CFLAGS" REVENGE_STREAM_LIBS="-L$P/lib -lrevenge-stream-0.0"
export WPD_CFLAGS="-I$P/include/libwpd-0.10" WPD_LIBS="-L$P/lib -lwpd-0.10"
export REVENGE_GENERATORS_CFLAGS="$REVENGE_CFLAGS" REVENGE_GENERATORS_LIBS="-L$P/lib -lrevenge-generators-0.0"

# Source fixes applied before configuring (idempotent).
patches() {
  case "$1" in
    librevenge-*)
      # SVG text sizes are written in inches inside a points viewBox; scale
      # them like every other length the generator writes.
      sed -i '' 's|doubleToString(pList\["fo:font-size"\]->getDouble())|doubleToString(72*pList["fo:font-size"]->getDouble())|' \
        src/lib/RVNGSVGDrawingGenerator.cpp
      python3 "$HERE/patches/librevenge-html-images.py"
      python3 "$HERE/patches/librevenge-svg-lines.py" ;;
    libfreehand-*)
      # Current ICU's U16_NEXT is a statement that needs its own semicolon.
      sed -i '' 's/U16_NEXT(s, j, length, c)$/U16_NEXT(s, j, length, c);/' src/lib/libfreehand_utils.cpp ;;
    libe-book-*)
      # macOS's gperf 3.0 writes "register", which C++17 rejects; fix the
      # generated tables and keep them newer than their .gperf sources.
      sed -i '' 's/register //g' src/lib/*.inc
      touch src/lib/*.inc
      # Current ICU no longer defines TRUE.
      sed -i '' 's/TRUE, TRUE, &status/true, true, \&status/' src/lib/EBOOKCharsetConverter.cpp ;;
  esac
}

lib() { # tarball, directory, installed .a, extra configure flags
  [ -f "$P/lib/$3" ] && return 0
  cd "$SRC"
  [ -d "$2" ] || { curl -sfLO "$MIRROR/$1"; tar xf "$1"; }
  cp "$HERE/config.sub" "$HERE/config.guess" "$2/"
  cd "$2"
  patches "$2"
  emconfigure ./configure --host=wasm32-unknown-emscripten --prefix="$P" \
    --disable-shared --enable-static --disable-werror --without-docs $4 \
    CPPFLAGS="-I$INC -I$P/include -sUSE_ZLIB=1 -sUSE_ICU=1" CXXFLAGS="-O2 -fexceptions" \
    ZLIB_CFLAGS="-sUSE_ZLIB=1" ZLIB_LIBS="-sUSE_ZLIB=1" > "../$2.configure.log" 2>&1
  emmake make -j8 > "../$2.make.log" 2>&1
  emmake make install > /dev/null 2>&1
  echo "built $2"
}

lib librevenge-0.0.5.tar.bz2 librevenge-0.0.5 librevenge-0.0.a "--disable-tests"
lib libwpd-0.10.3.tar.xz libwpd-0.10.3 libwpd-0.10.a "--disable-tools --disable-debug"
lib libwps-0.4.14.tar.xz libwps-0.4.14 libwps-0.4.a "--disable-tools --disable-debug --disable-zip"
lib libmwaw-0.3.22.tar.xz libmwaw-0.3.22 libmwaw-0.3.a "--disable-tools --disable-debug --disable-zip"
lib libwpg-0.3.4.tar.xz libwpg-0.3.4 libwpg-0.3.a "--disable-tools --disable-debug"
ICU_CFLAGS="-sUSE_ICU=1" ICU_LIBS="-sUSE_ICU=1" \
  lib libmspub-0.1.4.tar.xz libmspub-0.1.4 libmspub-0.1.a "--disable-tools --disable-debug"

em++ -O2 -fexceptions -std=c++17 "$HERE/docconv.cpp" -o "$OUT/docconv.mjs" \
  -I"$INC" -I"$P/include/librevenge-0.0" -I"$P/include/libwpd-0.10" -I"$P/include/libwps-0.4" -I"$P/include/libmwaw-0.3" -I"$P/include/libmspub-0.1" -I"$P/include/libwpg-0.3" \
  -L"$P/lib" -lmspub-0.1 -lwpg-0.3 -lmwaw-0.3 -lwps-0.4 -lwpd-0.10 -lrevenge-generators-0.0 -lrevenge-stream-0.0 -lrevenge-0.0 \
  -sUSE_ZLIB=1 -sUSE_ICU=1 -sMODULARIZE=1 -sEXPORT_ES6=1 -sENVIRONMENT=web,worker,node \
  -sALLOW_MEMORY_GROWTH=1 -sFORCE_FILESYSTEM=1 -fexceptions \
  -sEXPORTED_FUNCTIONS=_oof_convert,_oof_decode_graphic,_free -sEXPORTED_RUNTIME_METHODS=FS,ccall,UTF8ToString
ls -la "$OUT"/docconv.*

# helpdeco (WinHelp decompiler, GPL-3.0): plain C, no dependencies.
if [ ! -d "$SRC/helpdeco-master" ]; then
  (cd "$SRC" && curl -sfL -o helpdeco.tar.gz https://github.com/pmachapman/helpdeco/archive/refs/heads/master.tar.gz && tar xzf helpdeco.tar.gz)
fi
emcc -O2 -Wno-everything "$SRC"/helpdeco-master/src/helpdeco.c "$SRC"/helpdeco-master/src/helpdec1.c "$SRC"/helpdeco-master/src/compat.c \
  -o "$OUT/helpdeco.mjs" -sMODULARIZE=1 -sEXPORT_ES6=1 -sENVIRONMENT=web,worker,node -sINVOKE_RUN=0 -sEXIT_RUNTIME=0 \
  -sALLOW_MEMORY_GROWTH=1 -sFORCE_FILESYSTEM=1 -sEXPORTED_RUNTIME_METHODS=FS,callMain
ls -la "$OUT"/helpdeco.*

# splitmrb (same package): turns WinHelp .shg/.mrb pictures into .bmp/.wmf.
emcc -O2 -Wno-everything "$SRC"/helpdeco-master/src/splitmrb.c "$SRC"/helpdeco-master/src/compat.c \
  -o "$OUT/splitmrb.mjs" -sMODULARIZE=1 -sEXPORT_ES6=1 -sENVIRONMENT=web,worker,node -sINVOKE_RUN=0 -sEXIT_RUNTIME=0 \
  -sALLOW_MEMORY_GROWTH=1 -sFORCE_FILESYSTEM=1 -sEXPORTED_RUNTIME_METHODS=FS,callMain

# ---------------------------------------------------------------------------
# dlp2: the drawing, layout, StarOffice and e-book libraries, in a second
# module so pages that only need docconv don't download them.
#   CorelDRAW/CMX (libcdr), Visio (libvisio), PageMaker (libpagemaker),
#   FreeHand (libfreehand), QuarkXPress (libqxp), Zoner (libzmf),
#   StarOffice (libstaroffice), Palm/Sony e-books (libe-book), AbiWord (libabw)
export PKG_CONFIG_PATH="$P/lib/pkgconfig"
export ICU_CFLAGS="-sUSE_ICU=1" ICU_LIBS="-sUSE_ICU=1"
export LCMS2_CFLAGS="-I$P/include" LCMS2_LIBS="-L$P/lib -llcms2"
export LIBXML_CFLAGS="-I$P/include/libxml2" LIBXML_LIBS="-L$P/lib -lxml2"
export XML_CFLAGS="$LIBXML_CFLAGS" XML_LIBS="$LIBXML_LIBS"
export LIBPNG_CFLAGS="-sUSE_LIBPNG=1" LIBPNG_LIBS="-sUSE_LIBPNG=1"

lib lcms2-2.16.tar.gz lcms2-2.16 liblcms2.a "--without-jpeg --without-tiff --without-threads"
lib libxml2-2.12.9.tar.xz libxml2-2.12.9 libxml2.a "--without-python --without-http --without-ftp --without-threads --without-lzma --without-modules --without-debug --without-zlib"
lib libcdr-0.1.8.tar.xz libcdr-0.1.8 libcdr-0.1.a "--disable-tools --disable-debug --disable-tests"
lib libvisio-0.1.8.tar.xz libvisio-0.1.8 libvisio-0.1.a "--disable-tools --disable-debug --disable-tests"
lib libpagemaker-0.0.4.tar.xz libpagemaker-0.0.4 libpagemaker-0.0.a "--disable-tools --disable-debug"
lib libfreehand-0.1.2.tar.xz libfreehand-0.1.2 libfreehand-0.1.a "--disable-tools --disable-debug --disable-tests"
lib libqxp-0.0.2.tar.xz libqxp-0.0.2 libqxp-0.0.a "--disable-tools --disable-debug --disable-tests"
lib libzmf-0.0.2.tar.xz libzmf-0.0.2 libzmf-0.0.a "--disable-tools --disable-debug --disable-tests"
lib libstaroffice-0.0.7.tar.xz libstaroffice-0.0.7 libstaroffice-0.0.a "--disable-tools --disable-debug --disable-zip"
lib libe-book-0.1.3.tar.xz libe-book-0.1.3 libe-book-0.1.a "--without-tools --disable-debug --disable-tests --without-liblangtag"
lib libabw-0.1.3.tar.xz libabw-0.1.3 libabw-0.1.a "--disable-tools --disable-debug"

DLP2_INC=""
for d in libcdr-0.1 libvisio-0.1 libpagemaker-0.0 libfreehand-0.1 libqxp-0.0 libzmf-0.0 libstaroffice-0.0 libe-book-0.1 libabw-0.1; do DLP2_INC="$DLP2_INC -I$P/include/$d"; done
em++ -O2 -fexceptions -std=c++17 "$HERE/dlp2.cpp" -o "$OUT/dlp2.mjs" \
  -I"$INC" -I"$P/include/librevenge-0.0" $DLP2_INC \
  -L"$P/lib" -lcdr-0.1 -lvisio-0.1 -lpagemaker-0.0 -lfreehand-0.1 -lqxp-0.0 -lzmf-0.0 -lstaroffice-0.0 -le-book-0.1 -labw-0.1 \
  -llcms2 -lxml2 -lrevenge-generators-0.0 -lrevenge-stream-0.0 -lrevenge-0.0 \
  -sUSE_ZLIB=1 -sUSE_ICU=1 -sUSE_LIBPNG=1 -sMODULARIZE=1 -sEXPORT_ES6=1 -sENVIRONMENT=web,worker,node \
  -sALLOW_MEMORY_GROWTH=1 -sFORCE_FILESYSTEM=1 -fexceptions \
  -sEXPORTED_FUNCTIONS=_oof_convert,_free -sEXPORTED_RUNTIME_METHODS=FS,ccall,UTF8ToString
ls -la "$OUT"/dlp2.*
