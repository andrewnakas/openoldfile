// CorelDRAW, Visio, PageMaker, FreeHand, QuarkXPress, Zoner, StarOffice,
// Palm and Sony e-books and AbiWord: the second set of Document Liberation
// Project libraries (native/dlp2.cpp), shown by the doc engine's viewers.

import { open as openDoc } from './doc.js';

export const open = (file, ui) => openDoc(file, ui, '/js/workers/dlp2-worker.js');
