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
