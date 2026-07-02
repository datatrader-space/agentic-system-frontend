/**
 * Resolve where a Help Center smart-search SUBMIT should navigate.
 *
 * Input is the `results` array from GET /api/help/search (NOT /help/suggest) — the
 * smart, section-level endpoint. The top result already carries the exact article
 * `route` + section `anchor` (and a canonical `url` combining them), so we land on the
 * precise section and HelpArticle scrolls/highlights it.
 *
 * Returns a vue-router location object. Falls back to the documentation list (filtered
 * by the query) when there are no results.
 */
export function resolveSearchDestination(results, q) {
  const top = (results || [])[0]
  if (top && (top.url || top.route)) {
    // Split the canonical url into path + hash so types without an anchor (e.g. learning
    // paths) don't get a dangling "#"; always keep ?q for context.
    const [path, hash] = String(top.url || top.route).split('#')
    return { path, ...(hash ? { hash: `#${hash}` } : {}), query: { q } }
  }
  return { path: '/dashboard/help-center/docs', query: { q } }
}
