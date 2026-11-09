// The models that draw a head start (views._detect_sources + auto_label.sources), grouped as the Auto Label page and
// the editor's "Find Objects with AI" show them (agentic-docs/AUTO_LABEL_VISION_SAM3_PLAN.md): one row per model or
// pair (``family``, e.g. "GPT-6.1 Terra + SAM 3"), under its maker (OpenAI, Google, Meta, AADML, My Models). A family
// has up to two sources, its Polygons and its Masks; the page's switch chooses between them.

//: The order the makers are shown in. A maker not named here comes after these, by name.
const MAKER_ORDER = ['OpenAI', 'Google', 'Meta', 'AADML', 'My Models'];

const labelsOf = source => (source?.labels === 'masks' ? 'masks' : 'polygons');

export function familyOf(source) {
  if (!source) return '';
  if (source.family) return source.family;
  return `${source.mode ? `${source.mode}: ` : ''}${source.name}`;
}

export function makerOf(source) {
  if (!source) return '';
  if (source.maker) return source.maker;
  return source.trained_here ? 'My Models' : 'AADML';
}

// ``[{maker, families: [{key, name, maker, ids: {polygons, masks}, unavailable, what, detail, research_only, licence}]}]``
export function groupSources(sources) {
  const families = new Map();
  for (const source of sources || []) {
    const key = `${makerOf(source)}|${familyOf(source)}`;
    if (!families.has(key)) {
      families.set(key, { key, name: familyOf(source), maker: makerOf(source), ids: {}, unavailable: source.unavailable || '',
        what: source.what || '', detail: source.detail || '', research_only: !!source.research_only, licence: source.licence || '' });
    }
    families.get(key).ids[labelsOf(source)] = source.id;
  }
  const groups = new Map();
  for (const family of families.values()) {
    if (!groups.has(family.maker)) groups.set(family.maker, []);
    groups.get(family.maker).push(family);
  }
  const rank = maker => { const at = MAKER_ORDER.indexOf(maker); return at < 0 ? MAKER_ORDER.length : at; };
  return [...groups.entries()]
    .map(([maker, list]) => ({ maker, families: list }))
    .sort((a, b) => rank(a.maker) - rank(b.maker) || a.maker.localeCompare(b.maker));
}

// The family a source id belongs to, and the id of that family in the other way of showing it.
export function familyOfId(groups, id) {
  for (const group of groups) {
    for (const family of group.families) {
      if (Object.values(family.ids).includes(id)) return family;
    }
  }
  return null;
}

export function labelsOfId(sources, id) {
  return labelsOf((sources || []).find(s => s.id === id));
}

// The id of ``family`` shown as ``labels``, or its only id when it has one way of showing.
export function idFor(family, labels) {
  if (!family) return '';
  return family.ids[labels] || family.ids.polygons || family.ids.masks || '';
}

export function waysOf(family) {
  return ['polygons', 'masks'].filter(way => family?.ids?.[way]);
}

// Whether a source runs on a server that is started when it is down (SAM 3, a published or trained model), so the
// page says it may take a moment; a vision model alone is an outside AI provider's and is never "started".
export function startsServer(source) {
  return !/^vision(-masks)?:/.test(String(source?.id || ''));
}
