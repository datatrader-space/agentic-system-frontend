// Clone a GitHub repository by its address (ADM-1205, phase C): what the page sends, or the words for what is wrong.
// The server checks the address and the branch again with the same rules (lets_code_views._GITHUB_URL / _BRANCH).
const GITHUB_URL = /^https:\/\/github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+?(?:\.git)?\/?$/
const BRANCH_NAME = /^(?!\/)(?!.*\.\.)(?!.*\/\/)[A-Za-z0-9._/-]{1,100}(?<!\/)(?<!\.lock)$/

export function cloneRequest(url, branch) {
  const u = String(url || '').trim()
  const b = String(branch || '').trim()
  if (!GITHUB_URL.test(u)) return { error: 'Use a GitHub address like https://github.com/owner/repository.' }
  if (b && !BRANCH_NAME.test(b)) return { error: 'That branch name cannot be used.' }
  return { body: { github_url: u, ...(b ? { branch: b } : {}) } }
}
