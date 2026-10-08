# librevenge's SVG drawing and presentation generators ignore paragraphs and
# line breaks, so every text box came out as one long line, and they put the
# baseline of top-aligned text on the box's bottom edge. Start each new
# paragraph or line on a fresh line (x = the box's left edge, dy = 1.2em per
# break) and hang the first line of top-aligned text just below the top.
# Idempotent: run from the librevenge source root.
import sys

FILES = [
    ('src/lib/RVNGSVGDrawingGenerator.cpp', 'RVNGSVGDrawingGenerator', 'm_pImpl', 'struct RVNGSVGDrawingGeneratorPrivate\n{\n',
     '\tm_pImpl->m_outputSink << "<" << m_pImpl->getNamespaceAndDelim() << "tspan ";\n',
     'void RVNGSVGDrawingGenerator::openParagraph(const RVNGPropertyList & /*propList*/) {}',
     'void RVNGSVGDrawingGenerator::insertLineBreak()\n{\n\tm_pImpl->m_outputSink << "\\n";\n}'),
    ('src/lib/RVNGSVGPresentationGenerator.cpp', 'RVNGSVGPresentationGenerator', 'm_impl', 'struct RVNGSVGPresentationGeneratorImpl\n{\n',
     '\tm_impl->m_outputSink << "<svg:tspan ";\n',
     'void RVNGSVGPresentationGenerator::openParagraph(const RVNGPropertyList &)\n{\n}',
     "void RVNGSVGPresentationGenerator::insertLineBreak()\n{\n\tm_impl->m_outputSink << '\\n';\n}"),
]


def must_replace(s, old, new, path):
    if old not in s:
        sys.exit(f'{path}: pattern not found: {old[:60]!r}')
    return s.replace(old, new, 1)


for path, cls, impl, struct, tspan, para, brk in FILES:
    s = open(path).read()
    if 'm_oofBreaks' in s:
        continue
    s = must_replace(s, struct, struct + '\tdouble m_oofTextX = 0;\n\tint m_oofParas = 0, m_oofBreaks = 0;\n\tbool m_oofFirst = false;\n', path)

    start = s.index(f'void {cls}::startTextObject')
    end = s.index(f'void {cls}::endTextObject')
    body = s[start:end]
    body = must_replace(body, '\tdouble x = 0.0;\n', f'\t{impl}->m_oofFirst = false;\n\tdouble x = 0.0;\n', path)
    body = must_replace(body, '\telse\n\t\ty += height;\n',
                        f'\telse\n\t\t{impl}->m_oofFirst = true; // top-aligned: the first span hangs below y\n', path)
    body = must_replace(body, '\tif (propList["fo:padding-left"])\n\t\tx += propList["fo:padding-left"]->getDouble();\n',
                        '\tif (propList["fo:padding-left"])\n\t\tx += propList["fo:padding-left"]->getDouble();\n'
                        f'\t{impl}->m_oofTextX = x;\n\t{impl}->m_oofParas = 0;\n\t{impl}->m_oofBreaks = 0;\n', path)
    s = s[:start] + body + s[end:]

    s = must_replace(s, para, para.split('\n')[0].replace(' {}', '') + f'\n{{\n\tif ({impl}->m_oofParas++) {impl}->m_oofBreaks++;\n}}', path)
    s = must_replace(s, brk, f'void {cls}::insertLineBreak()\n{{\n\t{impl}->m_oofBreaks++;\n}}', path)
    s = must_replace(s, tspan, tspan +
                     f'\tif ({impl}->m_oofBreaks)\n\t{{\n'
                     f'\t\t{impl}->m_outputSink << "x=\\"" << doubleToString(72*{impl}->m_oofTextX) << "\\" dy=\\"" << doubleToString(1.2*{impl}->m_oofBreaks) << "em\\" ";\n'
                     f'\t\t{impl}->m_oofBreaks = 0;\n\t\t{impl}->m_oofFirst = false;\n\t}}\n'
                     f'\telse if ({impl}->m_oofFirst)\n\t{{\n'
                     f'\t\t{impl}->m_outputSink << "dy=\\"0.9em\\" ";\n\t\t{impl}->m_oofFirst = false;\n\t}}\n', path)
    open(path, 'w').write(s)
