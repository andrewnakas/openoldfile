# librevenge's HTML text generator drops every picture (insertBinaryObject
# is an empty stub). Emit them inline instead: browser-native images as
# <img>, anything else (WMF, PICT, WPG...) as a placeholder span carrying the
# data, which the site's doc engine renders or labels.
# Idempotent: run from the librevenge source root.
import sys
p = 'src/lib/RVNGHTMLTextGenerator.cpp'
s = open(p).read()
if 'oof-picture' in s:
    sys.exit(0)
s = s.replace(
    'void RVNGHTMLTextGenerator::openFrame(const RVNGPropertyList & /* propList */) {}',
    '''static double s_oofFrameWidth = 0, s_oofFrameHeight = 0;
void RVNGHTMLTextGenerator::openFrame(const RVNGPropertyList &propList)
{
	s_oofFrameWidth = propList["svg:width"] ? propList["svg:width"]->getDouble() : 0;
	s_oofFrameHeight = propList["svg:height"] ? propList["svg:height"]->getDouble() : 0;
}''')
s = s.replace(
    'void RVNGHTMLTextGenerator::insertBinaryObject(const RVNGPropertyList & /* propList */) {}',
    '''void RVNGHTMLTextGenerator::insertBinaryObject(const RVNGPropertyList &propList)
{
	if (m_impl->m_ignore || !propList["librevenge:mime-type"] || !propList["office:binary-data"])
		return;
	RVNGString mime = propList["librevenge:mime-type"]->getStr();
	std::string m(mime.cstr());
	std::ostringstream size;
	if (s_oofFrameWidth > 0) size << "width:" << s_oofFrameWidth << "in;";
	if (s_oofFrameHeight > 0) size << "height:" << s_oofFrameHeight << "in;";
	bool native = m == "image/png" || m == "image/jpeg" || m == "image/gif" || m == "image/bmp" || m == "image/svg+xml" || m == "image/tiff";
	m_impl->output() << (native ? "<img class=\\"oof-picture\\" alt=\\"\\" style=\\"max-width:100%;" : "<span class=\\"oof-picture oof-object\\" style=\\"")
	                 << size.str() << "\\" " << (native ? "src" : "data-src") << "=\\"data:" << m << ";base64,"
	                 << propList["office:binary-data"]->getStr().cstr() << "\\"" << (native ? std::string(">") : " data-mime=\\"" + m + "\\"></span>");
}''')
if '#include <sstream>' not in s:
    s = s.replace('#include <map>', '#include <map>\n#include <sstream>', 1)
open(p, 'w').write(s)
