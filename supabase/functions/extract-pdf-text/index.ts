import * as pdfjsLib from 'npm:pdfjs-dist/legacy/build/pdf.mjs';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  });
}

type TextItem = {
  str: string;
  transform?: number[];
  width?: number;
  height?: number;
};

function getItemX(item: TextItem) {
  return Array.isArray(item.transform) ? item.transform[4] || 0 : 0;
}

function getItemY(item: TextItem) {
  return Array.isArray(item.transform) ? item.transform[5] || 0 : 0;
}

function getItemFontSize(item: TextItem) {
  if (!Array.isArray(item.transform)) return item.height || 10;
  return Math.hypot(item.transform[2] || 0, item.transform[3] || 0) || item.height || 10;
}

function layoutTextItems(items: TextItem[]) {
  const visibleItems = items
    .filter((item) => item.str?.trim())
    .map((item) => ({
      ...item,
      x: getItemX(item),
      y: getItemY(item),
      fontSize: getItemFontSize(item),
      text: item.str.replace(/\s+/g, ' ').trim(),
    }));

  if (!visibleItems.length) return '';

  const rows: Array<typeof visibleItems> = [];
  const sortedItems = visibleItems.sort((a, b) => b.y - a.y || a.x - b.x);

  sortedItems.forEach((item) => {
    const tolerance = Math.max(3, item.fontSize * 0.45);
    const row = rows.find((candidate) => Math.abs(candidate[0].y - item.y) <= tolerance);
    if (row) row.push(item);
    else rows.push([item]);
  });

  rows.sort((a, b) => b[0].y - a[0].y);

  const lines: string[] = [];
  let previousY: number | null = null;
  let previousFontSize = 10;

  rows.forEach((row) => {
    row.sort((a, b) => a.x - b.x);

    if (previousY !== null) {
      const rowGap = Math.abs(previousY - row[0].y);
      if (rowGap > previousFontSize * 1.65) {
        lines.push('');
      }
    }

    let line = '';
    let previousEnd = row[0].x;
    let averageCharWidth = Math.max(4, row[0].fontSize * 0.45);

    row.forEach((item, index) => {
      const gap = index === 0 ? 0 : item.x - previousEnd;
      const spaces = gap > averageCharWidth ? Math.min(12, Math.max(1, Math.round(gap / averageCharWidth))) : index === 0 ? 0 : 1;
      line += `${' '.repeat(spaces)}${item.text}`;
      previousEnd = item.x + (item.width || item.text.length * averageCharWidth);
      averageCharWidth = Math.max(4, item.text.length ? (item.width || averageCharWidth * item.text.length) / item.text.length : averageCharWidth);
    });

    lines.push(line.trimEnd());
    previousY = row[0].y;
    previousFontSize = row[0].fontSize;
  });

  return lines.join('\n').replace(/[ \t]+\n/g, '\n').trim();
}

async function extractPdfText(buffer: ArrayBuffer) {
  const task = pdfjsLib.getDocument({
    data: new Uint8Array(buffer),
    disableFontFace: true,
    disableWorker: true,
    isEvalSupported: false,
    useSystemFonts: false,
  });
  const pdf = await task.promise;
  const pages: string[] = [];

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const content = await page.getTextContent();
    const pageText = layoutTextItems(content.items as TextItem[]);

    if (pageText) pages.push(pageText);
  }

  return pages.join('\n\n').trim();
}

async function extractPdfTextWithOcr(url: string) {
  const apiKey = Deno.env.get('OCR_SPACE_API_KEY');
  if (!apiKey) {
    return { text: '', error: 'OCR fallback is not configured. Add OCR_SPACE_API_KEY to enable scanned PDF extraction.' };
  }

  const form = new FormData();
  form.append('apikey', apiKey);
  form.append('url', url);
  form.append('filetype', 'PDF');
  form.append('OCREngine', '2');
  form.append('scale', 'true');
  form.append('isTable', 'true');

  const ocrRes = await fetch('https://api.ocr.space/parse/image', {
    method: 'POST',
    body: form,
  });
  const data = await ocrRes.json();
  const text = Array.isArray(data?.ParsedResults)
    ? data.ParsedResults.map((item: { ParsedText?: string }) => item.ParsedText || '').join('\n\n').trim()
    : '';

  return { text, error: data?.ErrorMessage || null };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  const authorization = req.headers.get('Authorization');
  if (!authorization) {
    return jsonResponse({ error: 'Missing authorization header' }, 401);
  }

  try {
    const { url, enableOcr } = await req.json();
    if (!url || typeof url !== 'string') {
      return jsonResponse({ error: 'Missing PDF URL' }, 400);
    }

    const pdfRes = await fetch(url, {
      headers: {
        Authorization: authorization,
        apikey: Deno.env.get('SUPABASE_ANON_KEY') || '',
      },
    });

    if (!pdfRes.ok) {
      return jsonResponse({ error: `Unable to download PDF (${pdfRes.status})` }, 400);
    }

    const contentType = pdfRes.headers.get('Content-Type') || '';
    if (contentType && !contentType.toLowerCase().includes('pdf')) {
      return jsonResponse({ error: 'URL did not return a PDF' }, 400);
    }

    let text = await extractPdfText(await pdfRes.arrayBuffer());
    let ocrError = null;

    if (!text && enableOcr) {
      const ocrResult = await extractPdfTextWithOcr(url);
      text = ocrResult.text;
      ocrError = ocrResult.error;
    }

    return jsonResponse({
      text,
      extracted: text.length > 0,
      ocrAttempted: Boolean(enableOcr),
      ocrError,
    });
  } catch (error) {
    return jsonResponse(
      {
        error: error instanceof Error ? error.message : 'PDF extraction failed',
      },
      500
    );
  }
});
