export const COLOR_ROLES = [
  { id: 'title', color: '#FF3B30', label: 'Title', shortLabel: 'Title' },
  { id: 'definition', color: '#FFCC00', label: 'Definition', shortLabel: 'Def' },
  { id: 'list', color: '#34C759', label: 'List', shortLabel: 'List' },
  { id: 'example', color: '#007AFF', label: 'Example', shortLabel: 'Ex' },
  { id: 'summary', color: '#AF52DE', label: 'Summary', shortLabel: 'Sum' },
];

export const ROLE_BY_ID = Object.fromEntries(COLOR_ROLES.map((role) => [role.id, role]));

export const ROLE_PRESETS = [
  {
    id: 'study',
    label: 'Study Notes',
    labels: {
      title: 'Title',
      definition: 'Definition',
      list: 'List',
      example: 'Example',
      summary: 'Summary',
    },
  },
  {
    id: 'research',
    label: 'Research Paper',
    labels: {
      title: 'Claim',
      definition: 'Evidence',
      list: 'Method',
      example: 'Citation',
      summary: 'Takeaway',
    },
  },
  {
    id: 'vocabulary',
    label: 'Vocabulary',
    labels: {
      title: 'Term',
      definition: 'Meaning',
      list: 'Forms',
      example: 'Usage',
      summary: 'Memory Cue',
    },
  },
  {
    id: 'meeting',
    label: 'Meeting Notes',
    labels: {
      title: 'Topic',
      definition: 'Decision',
      list: 'Action Item',
      example: 'Context',
      summary: 'Follow-up',
    },
  },
];

export const SAMPLE_TEXT = `Cognitive Load Theory

Cognitive load refers to the total amount of mental effort being used in working memory at a given time.

Working memory has a limited capacity. Learning experiences become easier to understand when lessons reduce unnecessary processing and help learners connect new ideas to existing schemas.

There are three common types of cognitive load. Intrinsic load comes from the complexity of the material. Extraneous load comes from confusing presentation or poor instructional design. Germane load is the useful effort of building durable mental models.

For example, a student learning calculus for the first time may experience high intrinsic load because the concepts are new and layered. A well-designed lesson can reduce extraneous load by using clear diagrams, worked examples, and step-by-step explanations.

The central idea is simple: good learning materials respect the limits of attention and memory. They remove friction, organize concepts clearly, and make space for meaningful practice.`;

export const SAMPLE_DOCUMENTS = [
  {
    id: 'demo-cognitive-load',
    title: 'Cognitive Psychology Ch.4.pdf',
    name: 'Cognitive Psychology Ch.4.pdf',
    size: 348000,
    sizeLabel: '339.8 KB',
    pages: 18,
    date: 'Jun 1, 2026',
    uploaded_at: '2026-06-01T05:30:00.000Z',
    url: null,
    extracted_text: SAMPLE_TEXT,
    colors: COLOR_ROLES.slice(0, 5).map((role) => role.color),
  },
  {
    id: 'demo-design-notes',
    title: 'Learning Design Notes.docx',
    name: 'Learning Design Notes.docx',
    size: 184000,
    sizeLabel: '179.7 KB',
    pages: 9,
    date: 'May 29, 2026',
    uploaded_at: '2026-05-29T08:15:00.000Z',
    url: null,
    extracted_text:
      'Learning Design Notes\n\nA strong annotation workflow starts by separating claims, definitions, examples, lists, and summaries.\n\nDefinitions anchor the concept. Examples make the idea concrete. Lists expose structure. Summaries help the reader compress a section into a reusable memory cue.',
    colors: COLOR_ROLES.slice(1, 5).map((role) => role.color),
  },
];

export function createActivityEntry(message) {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    message,
    createdAt: new Date().toISOString(),
  };
}

export function normalizeDocument(doc = {}) {
  const title = doc.title || doc.name || 'Untitled Document';
  const uploadedAt = doc.uploaded_at || doc.uploadedAt || new Date().toISOString();
  return {
    id: doc.id || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    title,
    name: doc.name || title,
    size: doc.size || 0,
    sizeLabel: doc.sizeLabel || formatBytes(doc.size || 0),
    pages: doc.pages || Math.max(1, Math.round((doc.size || 0) / 10000)) || '?',
    date:
      doc.date ||
      new Date(uploadedAt).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      }),
    uploaded_at: uploadedAt,
    url: doc.url || null,
    extracted_text: doc.extracted_text || doc.extractedText || null,
    folder: doc.folder || doc.subject || 'General',
    tags: Array.isArray(doc.tags) ? doc.tags : [],
    syncStatus: doc.syncStatus || (doc.id && !String(doc.id).startsWith('local-') ? 'Cloud' : 'Offline'),
    colors: doc.colors || COLOR_ROLES.slice(0, 2).map((role) => role.color),
  };
}

export function isExtractionFallbackText(text = '') {
  return /Text extraction was not available|scanned PDF|OCR_SPACE_API_KEY/i.test(text || '');
}

export function formatBytes(bytes) {
  if (!bytes) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function splitIntoTokens(text) {
  const tokens = [];
  const re = /(\S+|\s+)/g;
  let match;
  let wordIndex = 0;

  while ((match = re.exec(text || '')) !== null) {
    const isSpace = /^\s+$/.test(match[0]);
    const isLineBreak = isSpace && /\n/.test(match[0]);
    tokens.push({
      text: match[0],
      index: isSpace ? `s-${tokens.length}` : wordIndex++,
      isSpace,
      isLineBreak,
      lineBreaks: isLineBreak ? match[0].split('\n').length - 1 : 0,
    });
  }

  return tokens;
}

export function getHighlightedGroups(tokens, highlights) {
  const groups = [];
  let current = null;

  tokens.forEach((token) => {
    if (token.isSpace) {
      if (current) current.text += token.text;
      return;
    }

    const roleId = highlights?.[token.index];
    if (!roleId) {
      current = null;
      return;
    }

    if (current?.roleId === roleId) {
      current.text += token.text;
    } else {
      current = {
        id: `${roleId}-${token.index}`,
        roleId,
        role: ROLE_BY_ID[roleId] || COLOR_ROLES[0],
        text: token.text,
      };
      groups.push(current);
    }
  });

  return groups.map((group) => ({ ...group, text: group.text.trim() })).filter((group) => group.text);
}

export function buildStructuredExportSections(groups, selectedRoles = {}) {
  const visibleGroups = groups.filter((group) => selectedRoles[group.roleId] !== false);
  const sections = [];
  let current = null;

  const ensureSection = () => {
    if (!current) {
      current = {
        id: `section-${sections.length + 1}`,
        title: 'Untitled',
        definitions: [],
        listItems: [],
        examples: [],
        summaries: [],
      };
      sections.push(current);
    }
    return current;
  };

  visibleGroups.forEach((group) => {
    if (group.roleId === 'title') {
      current = {
        id: group.id,
        title: group.text,
        definitions: [],
        listItems: [],
        examples: [],
        summaries: [],
      };
      sections.push(current);
      return;
    }

    const section = ensureSection();
    if (group.roleId === 'definition') {
      section.definitions.push(group.text);
    } else if (group.roleId === 'list') {
      section.listItems.push(group.text);
    } else if (group.roleId === 'example') {
      section.examples.push(group.text);
    } else if (group.roleId === 'summary') {
      section.summaries.push(group.text);
    }
  });

  return sections.filter(
    (section) =>
      section.title ||
      section.definitions.length ||
      section.listItems.length ||
      section.examples.length ||
      section.summaries.length
  );
}

export function buildFlashcards(groups, selectedRoles = {}) {
  const visibleGroups = groups.filter((group) => selectedRoles[group.roleId] !== false);
  const cards = [];
  let currentTitle = 'General';
  let pendingDefinition = null;

  visibleGroups.forEach((group) => {
    if (group.roleId === 'title') {
      currentTitle = group.text;
      pendingDefinition = null;
      return;
    }

    if (group.roleId === 'definition') {
      pendingDefinition = group.text;
      cards.push({
        front: `Define: ${group.text.split(/[.:;-]/)[0].slice(0, 80) || currentTitle}`,
        back: group.text,
        section: currentTitle,
      });
      return;
    }

    if (group.roleId === 'example' && pendingDefinition) {
      cards.push({
        front: `Give an example of: ${pendingDefinition.split(/[.:;-]/)[0].slice(0, 70)}`,
        back: group.text,
        section: currentTitle,
      });
      return;
    }

    if (group.roleId === 'summary') {
      cards.push({
        front: `Summarize: ${currentTitle}`,
        back: group.text,
        section: currentTitle,
      });
    }
  });

  return cards;
}

export function buildExportPayload({ doc, groups, format, selectedRoles, template = 'study-notes' }) {
  const visibleGroups = groups.filter((group) => selectedRoles[group.roleId]);
  const sections = buildStructuredExportSections(groups, selectedRoles);
  const flashcards = buildFlashcards(groups, selectedRoles);

  if (format === 'json') {
    return JSON.stringify(
      {
        document: doc?.title || doc?.name || 'Document',
        exportedAt: new Date().toISOString(),
        template,
        highlights: visibleGroups.map((group) => ({
          role: group.role.label,
          color: group.role.color,
          text: group.text,
        })),
        flashcards,
      },
      null,
      2
    );
  }

  if (format === 'csv') {
    const rows = [['Role', 'Color', 'Text']];
    visibleGroups.forEach((group) => {
      rows.push([group.role.label, group.role.color, group.text]);
    });
    return rows
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n');
  }

  if (template === 'flashcards') {
    return flashcards
      .map((card, index) => [
        `## Card ${index + 1}`,
        `Section: ${card.section}`,
        `Front: ${card.front}`,
        `Back: ${card.back}`,
      ].join('\n'))
      .join('\n\n')
      .trim();
  }

  if (template === 'outline') {
    return sections
      .flatMap((section) => [
        `# ${section.title}`,
        ...section.definitions.map((item) => `- Definition: ${item}`),
        ...section.listItems.map((item) => `- ${item}`),
        ...section.examples.map((item) => `- Example: ${item}`),
        ...section.summaries.map((item) => `- Summary: ${item}`),
        '',
      ])
      .join('\n')
      .trim();
  }

  if (template === 'reviewer') {
    return sections
      .flatMap((section) => [
        `# ${section.title}`,
        '',
        section.summaries.length ? '## Quick Summary' : null,
        ...section.summaries.map((item) => `${item}\n`),
        section.definitions.length ? '## Key Terms' : null,
        ...section.definitions.map((item) => `- ${item}`),
        section.examples.length ? '\n## Examples' : null,
        ...section.examples.map((item) => `- ${item}`),
        section.listItems.length ? '\n## Checklist' : null,
        ...section.listItems.map((item) => `- ${item}`),
        '',
      ])
      .filter(Boolean)
      .join('\n')
      .trim();
  }

  return sections
    .flatMap((section) => [
      `# ${section.title}`,
      '',
      ...section.definitions.flatMap((item) => [item, '']),
      ...section.listItems.map((item) => `- ${item}`),
      section.listItems.length ? '' : null,
      ...section.examples.flatMap((item) => [`Example: ${item}`, '']),
      ...section.summaries.flatMap((item) => [item, '']),
    ])
    .filter((line) => line !== null)
    .join('\n')
    .trim();
}
