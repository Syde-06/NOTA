import JSZip from 'jszip';

export const ROLE_DEFINITIONS = [
  { id: 'title', color: '#FF3B30', soft: '#FFF1F0', bg: '#FF3B3022', label: 'Title', shortLabel: 'Title', emoji: 'T' },
  { id: 'definition', color: '#FFCC00', soft: '#FFFBE6', bg: '#FFCC0022', label: 'Definition', shortLabel: 'Define', emoji: 'D' },
  { id: 'list', color: '#34C759', soft: '#EEFCEF', bg: '#34C75922', label: 'List', shortLabel: 'List', emoji: 'L' },
  { id: 'example', color: '#007AFF', soft: '#EEF5FF', bg: '#007AFF22', label: 'Example', shortLabel: 'Example', emoji: 'E' },
  { id: 'summary', color: '#AF52DE', soft: '#F8F0FF', bg: '#AF52DE22', label: 'Summary', shortLabel: 'Summary', emoji: 'S' },
];

export const ROLE_MAP = Object.fromEntries(ROLE_DEFINITIONS.map((role) => [role.id, role]));

export function splitIntoTokens(text = '') {
  const tokens = [];
  const matcher = /(\S+|\s+)/g;
  let index = 0;
  let match;

  while ((match = matcher.exec(text)) !== null) {
    tokens.push({
      index,
      text: match[0],
      isSpace: /^\s+$/.test(match[0]),
    });
    index += 1;
  }

  return tokens;
}

export function countHighlights(highlights = {}) {
  return Object.keys(highlights).length;
}

export function buildHighlightSummary(highlights = {}) {
  const summary = {
    title: 0,
    definition: 0,
    list: 0,
    example: 0,
    summary: 0,
  };

  Object.values(highlights).forEach((role) => {
    if (summary[role] !== undefined) {
      summary[role] += 1;
    }
  });

  return summary;
}

export function formatBytes(bytes) {
  if (!bytes) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function estimatePages(size) {
  return Math.max(1, Math.round((size || 0) / 10000)) || 1;
}

export function formatDocumentDate(value) {
  const date = value ? new Date(value) : new Date();
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function normalizeDocument(raw = {}) {
  const title = raw.title || raw.name || 'Untitled document';
  const uploadedAt = raw.uploaded_at || raw.updatedAt || raw.createdAt || new Date().toISOString();
  const highlights = raw.highlights || {};
  const type = title.toLowerCase().endsWith('.pdf') ? 'PDF' : 'DOCX';

  return {
    id: raw.id || `local-${Date.now()}`,
    title,
    name: title,
    url: raw.url || null,
    localUri: raw.localUri || raw.uri || null,
    extracted_text: raw.extracted_text || raw.extractedText || '',
    uploaded_at: uploadedAt,
    size: raw.size || 0,
    sizeLabel: formatBytes(raw.size || 0),
    pages: raw.pages || estimatePages(raw.size || 0),
    date: formatDocumentDate(uploadedAt),
    highlights,
    highlightCount: countHighlights(highlights),
    type,
    colors: ROLE_DEFINITIONS.slice(0, 3).map((role) => role.color),
    source: raw.source || 'local',
    syncStatus: raw.syncStatus || 'local',
    mimeType: raw.mimeType || null,
    ownerId: raw.ownerId || raw.user_id || null,
  };
}

export function groupHighlightedSegments(tokens = [], highlights = {}) {
  const segments = [];
  let current = null;

  tokens.forEach((token) => {
    const role = highlights[token.index];

    if (token.isSpace) {
      if (current) {
        current.text += token.text;
      }
      return;
    }

    if (!role) {
      current = null;
      return;
    }

    if (!current || current.role !== role) {
      current = {
        id: `${role}-${token.index}`,
        role,
        text: token.text,
      };
      segments.push(current);
      return;
    }

    current.text += token.text;
  });

  return segments
    .map((segment) => ({ ...segment, text: segment.text.trim() }))
    .filter((segment) => segment.text.length > 0);
}

function inferParagraphRole(paragraph, index) {
  const trimmed = paragraph.trim();
  if (!trimmed) return null;
  if (/^[•\-*]\s+/.test(trimmed)) return 'list';
  if (trimmed.length < 70 && !/[.!?]$/.test(trimmed)) return 'title';
  if (index === 0) return 'title';
  if (/for example|for instance|such as/i.test(trimmed)) return 'example';
  if (/in summary|overall|therefore|to conclude/i.test(trimmed)) return 'summary';
  if (/ is | refers to | means | defined as /i.test(trimmed)) return 'definition';
  return 'example';
}

export function buildStructuredSections(text = '', highlights = {}) {
  const tokens = splitIntoTokens(text);
  const highlightedSegments = groupHighlightedSegments(tokens, highlights);

  if (highlightedSegments.length > 0) {
    return highlightedSegments.map((segment) => ({
      ...segment,
      roleDef: ROLE_MAP[segment.role],
    }));
  }

  return text
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
    .slice(0, 12)
    .map((paragraph, index) => {
      const role = inferParagraphRole(paragraph, index);
      return {
        id: `${role}-${index}`,
        role,
        text: paragraph.replace(/^[•\-*]\s+/, ''),
        roleDef: ROLE_MAP[role],
      };
    });
}

export function buildExportText(doc, sections = [], options = {}) {
  const lines = [
    doc?.title || 'Nota Export',
    '',
    `Pages: ${doc?.pages || 1}`,
    `Highlights: ${doc?.highlightCount || 0}`,
    '',
  ];

  sections.forEach((section) => {
    if (!section?.text) return;
    const title = section.roleDef?.label?.toUpperCase() || section.role.toUpperCase();
    lines.push(`${title}`);
    lines.push(section.text.trim());
    lines.push('');
  });

  if (options.includeColorLegend) {
    lines.push('COLOR LEGEND');
    ROLE_DEFINITIONS.forEach((role) => lines.push(`${role.label}: ${role.shortLabel}`));
    lines.push('');
  }

  return lines.join('\n').trim();
}

function decodeXmlEntities(text) {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

export async function extractTextFromDocx(uri) {
  try {
    const response = await fetch(uri);
    const arrayBuffer = await response.arrayBuffer();
    const zip = await JSZip.loadAsync(arrayBuffer);
    const xmlFile = zip.file('word/document.xml');

    if (!xmlFile) return null;

    const xml = await xmlFile.async('string');
    const paragraphs = [];
    const paragraphMatches = xml.match(/<w:p[\s\S]*?<\/w:p>/g) || [];

    paragraphMatches.forEach((paragraph) => {
      const textRuns = [...paragraph.matchAll(/<w:t[^>]*>([\s\S]*?)<\/w:t>/g)];
      const line = decodeXmlEntities(textRuns.map((match) => match[1]).join('')).trim();
      if (line) {
        paragraphs.push(line);
      }
    });

    return paragraphs.join('\n\n') || null;
  } catch (error) {
    console.log('DOCX extraction error:', error);
    return null;
  }
}

export async function extractTextFromPdf(uri) {
  try {
    const response = await fetch(uri);
    const arrayBuffer = await response.arrayBuffer();
    const raw = new TextDecoder('latin1').decode(new Uint8Array(arrayBuffer));
    const chunks = [];

    for (const block of raw.matchAll(/BT([\s\S]*?)ET/g)) {
      for (const textMatch of block[1].matchAll(/\(([^)]{1,400})\)\s*T[Jj]/g)) {
        const cleaned = textMatch[1]
          .replace(/\\(\d{3})/g, (_, oct) => String.fromCharCode(parseInt(oct, 8)))
          .replace(/\\n/g, ' ')
          .replace(/\\r/g, '')
          .replace(/\\\\/g, '\\')
          .replace(/\\'/g, "'")
          .trim();

        if (cleaned.length > 1) {
          chunks.push(cleaned);
        }
      }
    }

    const compact = chunks.join(' ').replace(/\s{2,}/g, ' ').trim();
    return compact.length > 40 ? compact : null;
  } catch (error) {
    console.log('PDF extraction error:', error);
    return null;
  }
}

export async function extractText(uri, mimeType) {
  const lowerUri = (uri || '').toLowerCase();
  const isDocx =
    mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    lowerUri.endsWith('.docx');
  const isPdf = mimeType === 'application/pdf' || lowerUri.endsWith('.pdf');

  if (isDocx) return extractTextFromDocx(uri);
  if (isPdf) return extractTextFromPdf(uri);
  return null;
}
