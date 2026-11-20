// The models that draw a head start (views._detect_sources + auto_label.sources), grouped as the Auto Label page and
// the editor's "Find Objects with AI" show them (agentic-docs/AUTO_LABEL_VISION_SAM3_PLAN.md): one row per model or
// pair (``family``, e.g. "GPT-6.1 Terra + SAM 3"), under its maker (OpenAI, Google, Meta, AADML, My Models). A family
// has up to two sources, its Polygons and its Masks; the page's switch chooses between them. Nobody chooses where a model
// runs here: a ready-to-use model (SAM 3, and SAM 3 inside a vision + SAM 3 pair) is ``hosted``, started and stopped by
// AADML and charged per image; every other model runs where it runs (agentic-docs/FIND_OBJECTS_AND_OWN_CLASSES_PLAN.md
// section 10).

//: The order the makers are shown in. A maker not named here comes after these, by name.
const MAKER_ORDER = ['OpenAI', 'Google', 'Meta', 'AADML', 'My Models'];

const labelsOf = source => (source?.labels === 'masks' ? 'masks' : 'polygons');

// Why a model cannot be used now, as the reason alone. The server's words end with "Nothing was charged." because they
// are also the answer to a refused call; shown beside a model nobody asked anything of, that sentence is wrong (live,
// 2026-11-19: the hosted SAM 3 Try said its reason three times, each ending "Nothing was charged.").
export function reasonOnly(text) {
  return String(text || '')
    .replace(/\s*Nothing was charged; (\w)/g, (_, first) => ` ${first.toUpperCase()}`)
    .replace(/\s*Nothing was charged\.?/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

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

// ``[{maker, families: [{key, name, maker, ids: {polygons, masks}, unavailable, what, detail, research_only, licence,
// hosted}]}]``; ``hosted`` is ``{state, price}`` or null.
export function groupSources(sources) {
  const families = new Map();
  for (const source of sources || []) {
    const key = `${makerOf(source)}|${familyOf(source)}`;
    if (!families.has(key)) {
      families.set(key, { key, name: familyOf(source), maker: makerOf(source), ids: {}, unavailable: reasonOnly(source.unavailable),
        what: source.what || '', detail: source.detail || '', research_only: !!source.research_only, licence: source.licence || '',
        hosted: source.hosted || null });
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

// How solid an answer is drawn: a mask is the same outline as its polygon, filled (Auto Label's preview and the
// editor's "Find Objects with AI" draw it alike; live, 2026-11-20, the editor drew both the same).
export function fillOpacityOf(labels) {
  return labels === 'masks' ? 0.55 : 0.25;
}

// Whether two sources give the same answer: the Polygons and the Masks of one model or pair ask the same model and get
// the same shapes (backend auto_label.detect), only drawn differently. Switching between them keeps an answer and never
// asks (and charges) again (live, 2026-11-20: Auto Label threw its SAM 3 preview away on the switch).
export function sameAnswer(a, b) {
  return !!a && !!b && makerOf(a) === makerOf(b) && familyOf(a) === familyOf(b);
}

// A ready-to-use model AADML hosts (``hosted``: SAM 3, a vision + SAM 3 pair): nobody chooses where it runs.
export function isHosted(source) {
  return !!source?.hosted;
}

// What asking a source about one photo costs, in words; '' when its words say nothing of a price. A foundation model
// (``platform``) and a hosted one ("$X an image") say their price; a model of this project or one AADML runs as
// published says where it comes from instead (editor.detect_sources: "As AADML published it, ..."), which is not a
// price (live, 2026-11-17: "Each photo is charged to you:" was followed by those words).
export function costOf(source) {
  return source && (source.platform || isHosted(source)) ? source.detail || '' : '';
}

// What a source does and where it runs, as sentences: its ``what``, then its ``detail``, each ending in a full stop and
// with a space between them (live, 2026-11-17: "...the model drew.As AADML published it").
export function aboutOf(source) {
  return [source?.what, source?.detail].map(sentence).filter(Boolean).join(' ');
}

// Words as one sentence: ending in a full stop unless they end in one already ('' stays ''). A hosted model's words
// come both ways ("..., $0.002 an image" and "Not running now: AADML starts it.").
export function sentence(text) {
  const words = String(text || '').trim();
  return !words || /[.!?]$/.test(words) ? words : `${words}.`;
}

// Whether a source runs on a server that is started when it is down (a published or trained model), so the page says
// it may take a moment. A vision model alone is an outside AI provider's and is never "started"; a hosted model is
// started and stopped by AADML only, never by a call.
export function startsServer(source) {
  if (isHosted(source)) return false;
  return !/^vision(-masks)?:/.test(String(source?.id || ''));
}
