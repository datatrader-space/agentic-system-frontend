// Files the person drops from their computer onto the Let's Code explorer, or picks with "Upload files" (ADM-1205).
//
// A dropped FOLDER keeps its layout: each file comes with its path inside what was dropped (`site/css/main.css`),
// read through the File System entries API that every current browser has. Without it (an old browser) the files
// alone arrive, by name.

export async function filesFromDrop(dataTransfer) {
  const items = [...(dataTransfer?.items || [])]
  const entries = items.map((i) => (i.kind === 'file' && typeof i.webkitGetAsEntry === 'function' ? i.webkitGetAsEntry() : null))
  if (entries.some(Boolean)) {
    const out = []
    for (const entry of entries) if (entry) await walk(entry, '', out)
    return out
  }
  return [...(dataTransfer?.files || [])].map((file) => ({ file, path: file.name }))
}

export function filesFromPicker(fileList) {
  return [...(fileList || [])].map((file) => ({ file, path: file.webkitRelativePath || file.name }))
}

async function walk(entry, prefix, out) {
  const path = prefix ? `${prefix}/${entry.name}` : entry.name
  if (entry.isFile) {
    out.push({ file: await new Promise((resolve, reject) => entry.file(resolve, reject)), path })
    return
  }
  if (!entry.isDirectory) return
  const reader = entry.createReader()
  // readEntries answers in batches (100 in Chrome) until it answers an empty one.
  for (;;) {
    const batch = await new Promise((resolve, reject) => reader.readEntries(resolve, reject))
    if (!batch.length) break
    for (const child of batch) await walk(child, path, out)
  }
}

// What one request carries (ADM-1269): at most 50 files (Django takes 100, DATA_UPLOAD_MAX_NUMBER_FILES) and 8 MB, so
// every request finishes well inside the time the aadml.com front server allows. A larger drop goes in parts; a
// file larger than a part goes alone, in 8 MB pieces the sandbox joins (`api.uploadRepositoryFiles`). A file larger
// than MAX_FILE_BYTES is said, not sent: the Terminal adds it (curl, git).
export const MAX_FILES_PER_PART = 50
export const MAX_BYTES_PER_PART = 8 * 1024 * 1024
export const MAX_FILE_BYTES = 1024 * 1024 * 1024

export function tooLarge(files) {
  return files.filter((f) => (f.file?.size || 0) > MAX_FILE_BYTES)
}

export function uploadParts(files) {
  const parts = []
  let cur = []
  let bytes = 0
  for (const f of files) {
    const size = f.file?.size || 0
    if (cur.length && (cur.length >= MAX_FILES_PER_PART || bytes + size > MAX_BYTES_PER_PART)) {
      parts.push(cur)
      cur = []
      bytes = 0
    }
    cur.push(f)
    bytes += size
  }
  if (cur.length) parts.push(cur)
  return parts
}
