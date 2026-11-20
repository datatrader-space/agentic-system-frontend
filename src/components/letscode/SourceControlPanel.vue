<template>
  <!-- VS Code–style Source Control over the project's repository. The agent edits the files; this is where the
       person sees every change (click one for its side-by-side diff, `open-diff`), discards a file, commits,
       pushes and opens a pull request (owner, 2026-11-09). A new project with no GitHub repository commits on
       its own branch and is published from here (ADM-1183). Gitignored files are not listed. -->
  <div class="scm">
    <div class="scm-head">
      <span class="scm-branch" :title="status.branch"><Icon icon="lucide:git-branch" aria-hidden="true" /> {{ status.branch || 'No branch' }}</span>
      <div class="scm-tools">
        <button v-if="status.has_remote" type="button" class="scm-refresh" :disabled="loading || busy || status.merging"
                :title="status.merging ? 'Resolve or abort the merge first' : 'Pull: bring in GitHub\'s commits'" aria-label="Pull from GitHub" @click="pull">
          <Icon icon="lucide:arrow-down-to-line" :class="{ spin: action === 'pull' }" aria-hidden="true" />
        </button>
        <button type="button" class="scm-refresh" :disabled="busy" title="Download a backup of the project (every commit and every file)"
                aria-label="Download a backup of the project" @click="downloadBackup">
          <Icon :icon="action === 'backup' ? 'lucide:loader' : 'lucide:hard-drive-download'" :class="{ spin: action === 'backup' }" aria-hidden="true" />
        </button>
        <button type="button" class="scm-refresh" :disabled="loading || busy || status.merging" title="New branch (keeps your changes)"
                aria-label="New branch" :aria-expanded="branchOpen ? 'true' : 'false'" @click="branchOpen = !branchOpen">
          <Icon icon="lucide:git-branch-plus" aria-hidden="true" />
        </button>
        <button v-if="!status.clean && !status.merging" type="button" class="scm-refresh" :disabled="loading || busy"
                title="Discard all changes" aria-label="Discard all changes" @click="discardAll">
          <Icon icon="lucide:undo-2" aria-hidden="true" />
        </button>
        <button type="button" class="scm-refresh" :class="{ on: stashOpen }" :disabled="loading" title="Stashes"
                aria-label="Stashes" :aria-expanded="stashOpen ? 'true' : 'false'" @click="toggleStashes">
          <Icon icon="lucide:archive" aria-hidden="true" />
        </button>
        <button type="button" class="scm-refresh" :class="{ on: tagsOpen }" :disabled="loading" title="Tags"
                aria-label="Tags" :aria-expanded="tagsOpen ? 'true' : 'false'" @click="toggleTags">
          <Icon icon="lucide:tag" aria-hidden="true" />
        </button>
        <button type="button" class="scm-refresh" :class="{ on: historyOpen }" :disabled="loading" title="History"
                aria-label="History" :aria-expanded="historyOpen ? 'true' : 'false'" @click="toggleHistory">
          <Icon icon="lucide:history" aria-hidden="true" />
        </button>
        <button type="button" class="scm-refresh" :disabled="loading || busy" title="Refresh" aria-label="Refresh source control" @click="load">
          <Icon icon="lucide:refresh-cw" :class="{ spin: loading }" />
        </button>
      </div>
    </div>

    <!-- A new branch from here; the changes not yet committed come along (VS Code's Create Branch). -->
    <form v-if="branchOpen" class="scm-newbranch" @submit.prevent="createBranch">
      <label class="scm-label" for="scm-newbranch">New branch from {{ status.branch || 'here' }}</label>
      <div class="scm-inline">
        <input id="scm-newbranch" v-model="newBranch" class="scm-input" type="text" spellcheck="false" autocomplete="off"
               placeholder="feature/my-change" :disabled="busy" @keydown.esc.prevent="branchOpen = false" />
        <button type="submit" class="scm-btn primary" :disabled="busy || !newBranch.trim()">
          {{ action === 'branch' ? 'Creating…' : 'Create' }}
        </button>
      </div>
    </form>

    <!-- Stashes (ADM-1321): the changes put away and brought back, as VS Code's Stash. Dropping one asks first. -->
    <section v-if="stashOpen" class="scm-section" aria-label="Stashes">
      <form class="scm-sectionform" @submit.prevent="stashPush">
        <label class="scm-label" for="scm-stashmsg">Stash the changes</label>
        <div class="scm-inline">
          <input id="scm-stashmsg" v-model="stashMessage" name="stash-message" class="scm-input" type="text" autocomplete="off"
                 placeholder="Message (optional)…" :disabled="busy" />
          <button type="submit" class="scm-btn primary" :disabled="busy || status.clean || status.merging">
            {{ action === 'stash' ? 'Stashing…' : 'Stash' }}
          </button>
        </div>
        <label class="scm-check">
          <input id="scm-stashnew" v-model="stashUntracked" type="checkbox" :disabled="busy" /> Include new files
        </label>
      </form>
      <p v-if="stashError" class="scm-note err" role="alert">{{ stashError }}</p>
      <p v-else-if="stashesLoading && !stashes.length" class="scm-note">Loading the stashes…</p>
      <p v-else-if="!stashes.length" class="scm-note">No stashes.</p>
      <ul class="scm-plain">
        <li v-for="s in stashes" :key="s.sha" class="scm-rowwrap scm-item">
          <span class="scm-item-t">
            <span class="scm-item-name">{{ s.message || 'No message' }}</span>
            <span class="scm-item-meta">{{ s.branch ? `${s.branch}, ` : '' }}{{ ago(s.date) }}</span>
          </span>
          <button type="button" class="scm-icon" :disabled="busy" :aria-label="`Apply the stash ${s.message || s.ref}`"
                  title="Apply (keep the stash)" @click="stashOp('apply', s)">
            <Icon icon="lucide:archive-restore" aria-hidden="true" />
          </button>
          <button type="button" class="scm-icon" :disabled="busy" :aria-label="`Pop the stash ${s.message || s.ref}`"
                  title="Pop (apply, then drop the stash)" @click="stashOp('pop', s)">
            <Icon icon="lucide:package-open" aria-hidden="true" />
          </button>
          <button type="button" class="scm-icon danger" :disabled="busy" :aria-label="`Drop the stash ${s.message || s.ref}`"
                  title="Drop the stash" @click="stashOp('drop', s)">
            <Icon icon="lucide:trash-2" aria-hidden="true" />
          </button>
        </li>
      </ul>
    </section>

    <!-- Tags (ADM-1321): a lightweight tag, or an annotated one with a message; pushed to GitHub one at a time. -->
    <section v-if="tagsOpen" class="scm-section" aria-label="Tags">
      <form class="scm-sectionform" @submit.prevent="createTag">
        <label class="scm-label" for="scm-tagname">New tag on {{ tagTarget ? tagTarget.short : (status.branch || 'this commit') }}</label>
        <div class="scm-inline">
          <input id="scm-tagname" v-model="tagName" name="tag-name" class="scm-input" type="text" spellcheck="false" autocomplete="off"
                 placeholder="v1.0.0…" :disabled="busy" />
          <button type="submit" class="scm-btn primary" :disabled="busy || !tagName.trim() || !status.has_commit">
            {{ action === 'tag' ? 'Creating…' : 'Create' }}
          </button>
        </div>
        <label class="sr-only" for="scm-tagmsg">Tag message</label>
        <input id="scm-tagmsg" v-model="tagMessage" name="tag-message" class="scm-input" type="text" autocomplete="off"
               placeholder="Message (optional: makes an annotated tag)…" :disabled="busy" />
        <button v-if="tagTarget" type="button" class="scm-linkbtn" @click="tagTarget = null">Tag the current commit instead</button>
      </form>
      <p v-if="tagsError" class="scm-note err" role="alert">{{ tagsError }}</p>
      <p v-else-if="tagsLoading && !tags.length" class="scm-note">Loading the tags…</p>
      <p v-else-if="!tags.length" class="scm-note">No tags.</p>
      <ul class="scm-plain">
        <li v-for="t in tags" :key="t.name" class="scm-rowwrap scm-item">
          <Icon icon="lucide:tag" class="scm-item-ic" aria-hidden="true" />
          <span class="scm-item-t">
            <span class="scm-item-name" translate="no">{{ t.name }}</span>
            <span class="scm-item-meta">{{ t.annotated ? (t.message || 'Annotated') : 'Lightweight' }}, <code>{{ t.sha.slice(0, 7) }}</code></span>
          </span>
          <button v-if="status.has_remote" type="button" class="scm-icon" :disabled="busy" :aria-label="`Push the tag ${t.name} to GitHub`"
                  title="Push to GitHub" @click="pushTag(t)">
            <Icon :icon="action === 'pushtag:' + t.name ? 'lucide:loader' : 'lucide:upload'" :class="{ spin: action === 'pushtag:' + t.name }" aria-hidden="true" />
          </button>
          <button type="button" class="scm-icon danger" :disabled="busy" :aria-label="`Delete the tag ${t.name}`"
                  title="Delete the tag from this project" @click="deleteTag(t)">
            <Icon icon="lucide:trash-2" aria-hidden="true" />
          </button>
        </li>
      </ul>
    </section>

    <!-- A pull stopped on files changed on both sides: resolve each one, or abort. -->
    <div v-if="status.merging" class="scm-merge" role="status">
      <p class="scm-merge-t">
        <Icon icon="lucide:git-merge" aria-hidden="true" />
        <template v-if="conflicts.length">Merging GitHub's commits: {{ conflicts.length }} {{ conflicts.length === 1 ? 'file has' : 'files have' }} a conflict. Open each one, keep the lines you want (remove the &lt;&lt;&lt;&lt;&lt;&lt;&lt; ======= &gt;&gt;&gt;&gt;&gt;&gt;&gt; markers), then Mark resolved.</template>
        <template v-else>Every conflict is resolved. Commit to finish the merge.</template>
      </p>
      <button type="button" class="scm-btn" :disabled="busy" @click="abortMerge">
        <Icon icon="lucide:x-circle" aria-hidden="true" /> {{ action === 'abort' ? 'Aborting…' : 'Abort merge' }}
      </button>
    </div>

    <div v-if="waiting" class="scm-empty" role="status" aria-live="polite">
      <Icon icon="lucide:loader" class="spin scm-faint" aria-hidden="true" /> The project's sandbox is starting. Trying again in {{ waiting }}s…
    </div>
    <div v-else-if="loading && !fetched" class="scm-empty">Loading changes…</div>
    <div v-else-if="error" class="scm-empty err" role="alert">{{ error }}</div>

    <template v-else>
      <!-- Commit: a message; on the branch the project is on, or on a new branch only when the person names one
           (owner, 2026-11-10: "if user did not ask to create the branch he should not create"). -->
      <form v-if="!status.clean" class="scm-commit" @submit.prevent="commit">
        <label class="sr-only" for="scm-message">Commit message</label>
        <textarea id="scm-message" v-model="message" class="scm-input" rows="2" placeholder="Commit message"
                  :disabled="busy" @keydown.ctrl.enter.prevent="commit" @keydown.meta.enter.prevent="commit"></textarea>
        <div v-if="status.has_remote" class="scm-branchrow">
          <label class="scm-label" for="scm-branch">New branch <span class="scm-hint">(optional)</span></label>
          <input id="scm-branch" v-model="branch" class="scm-input" type="text" spellcheck="false" autocomplete="off"
                 :placeholder="`Leave empty to commit on ${status.branch || 'this branch'}`" :disabled="busy" />
        </div>
        <button type="submit" class="scm-btn primary" :disabled="busy || !message.trim() || (!status.merging && !chosen.length) || conflicts.length > 0">
          <Icon icon="lucide:check" aria-hidden="true" />
          {{ commitLabel }}
        </button>
      </form>

      <!-- A new project: GitHub enters only here, when the person publishes it. -->
      <form v-if="!status.has_remote && status.has_commit" class="scm-publish" @submit.prevent="publish">
        <p class="scm-publish-h"><Icon icon="lucide:github" aria-hidden="true" /> Publish to GitHub</p>
        <label class="scm-label" for="scm-repo">Repository name</label>
        <input id="scm-repo" v-model="repoName" class="scm-input" type="text" spellcheck="false" autocomplete="off"
               :placeholder="projectName || 'my-project'" :disabled="busy" />
        <label class="scm-check">
          <input id="scm-private" v-model="isPrivate" type="checkbox" :disabled="busy" />
          Private repository
        </label>
        <button type="submit" class="scm-btn primary" :disabled="busy">
          <Icon icon="lucide:upload-cloud" aria-hidden="true" /> {{ action === 'publish' ? 'Publishing…' : 'Publish to GitHub' }}
        </button>
      </form>
      <p v-else-if="!status.has_remote && !status.has_commit && loaded" class="scm-note">
        Commit your changes, then publish the project to GitHub.
      </p>

      <!-- After a commit: push the branch, then open a pull request. -->
      <div v-if="canPush || canOpenPr || prUrl" class="scm-sync">
        <button v-if="canPush" type="button" class="scm-btn" :disabled="busy" @click="push">
          <Icon icon="lucide:upload" aria-hidden="true" />
          {{ action === 'push' ? 'Pushing…' : `Push ${status.unpushed} ${status.unpushed === 1 ? 'commit' : 'commits'}` }}
        </button>
        <button v-if="canOpenPr && !prOpen" type="button" class="scm-btn" :disabled="busy" @click="startPullRequest">
          <Icon icon="lucide:git-pull-request" aria-hidden="true" /> Open pull request…
        </button>
        <a v-if="prUrl" class="scm-pr" :href="prUrl" target="_blank" rel="noopener noreferrer">
          <Icon icon="lucide:external-link" aria-hidden="true" /> View pull request
        </a>
      </div>
      <form v-if="prOpen && canOpenPr" class="scm-prform" @submit.prevent="openPullRequest">
        <label class="scm-label" for="scm-prtitle">Pull request into {{ status.default_branch || 'the base branch' }}</label>
        <input id="scm-prtitle" v-model="prTitle" class="scm-input" type="text" :disabled="busy" placeholder="Title" />
        <label class="sr-only" for="scm-prbody">Description</label>
        <textarea id="scm-prbody" v-model="prBody" class="scm-input" rows="4" :disabled="busy"
                  placeholder="What changed, and why (optional)"></textarea>
        <div class="scm-inline">
          <button type="submit" class="scm-btn primary" :disabled="busy || !prTitle.trim()">
            <Icon icon="lucide:git-pull-request" aria-hidden="true" /> {{ action === 'pr' ? 'Opening…' : 'Open pull request' }}
          </button>
          <button type="button" class="scm-btn" :disabled="busy" @click="prOpen = false">Cancel</button>
        </div>
      </form>
      <p v-if="actionError" class="scm-note err" role="alert">{{ actionError }}</p>

      <div v-if="status.clean" class="scm-empty">
        <Icon icon="lucide:check-circle-2" aria-hidden="true" /> No changes. The working tree is clean.
      </div>
      <div v-else class="scm-list">
        <template v-for="g in groups" :key="g.key">
          <div v-if="g.items.length" class="scm-group">
            <div class="scm-group-h">
              <input v-if="ticking && g.key !== 'staged'" type="checkbox" class="scm-tick" :checked="allTicked(g)" :indeterminate.prop="someTicked(g)"
                     :aria-label="`Commit every file in ${g.label}`" @change="tickAll(g, $event.target.checked)" />
              {{ g.label }} <span class="scm-count">{{ g.items.length }}</span>
            </div>
            <div v-for="it in g.items" :key="g.key + it.path" class="scm-rowwrap" :class="{ active: selected === it.path, conflict: it.status === 'conflict' }">
              <input v-if="ticking && g.key !== 'staged'" type="checkbox" class="scm-tick" :checked="!unticked.has(it.path)"
                     :aria-label="`Commit ${it.path}`" @change="tick(it.path, $event.target.checked)" />
              <button type="button" class="scm-row" :title="it.status === 'conflict' ? `Open ${it.path} to resolve it` : `Show the changes in ${it.path}`" @click="it.status === 'conflict' ? emit('open-file', it.path) : openDiff(it)">
                <span class="scm-badge" :class="it.status" :title="it.status">{{ letter(it) }}</span>
                <span class="scm-path">{{ it.path }}</span>
              </button>
              <!-- Stage or unstage the file whole (ADM-1321); one change of it is staged from its diff. -->
              <button v-if="g.key === 'staged'" type="button" class="scm-stage" :disabled="busy" :aria-label="`Unstage ${it.path}`"
                      title="Unstage" @click="stageFile(it, true)">
                <Icon icon="lucide:minus" aria-hidden="true" />
              </button>
              <button v-else-if="it.status !== 'conflict'" type="button" class="scm-stage" :disabled="busy" :aria-label="`Stage ${it.path}`"
                      title="Stage" @click="stageFile(it, false)">
                <Icon icon="lucide:plus" aria-hidden="true" />
              </button>
              <button v-if="!status.merging && g.key !== 'staged'" type="button" class="scm-discard" :disabled="busy" :aria-label="`Discard the changes in ${it.path}`"
                      title="Discard changes" @click="discard(it)">
                <Icon icon="lucide:undo-2" aria-hidden="true" />
              </button>
              <!-- A conflicted file: keep one side whole, or edit it and mark it resolved (VS Code's Accept Current /
                   Incoming; "both" is the person's edit). -->
              <div v-if="it.status === 'conflict'" class="scm-conflict-actions">
                <button type="button" class="scm-resolve" :disabled="busy" :aria-label="`Keep your version of ${it.path}`"
                        title="Keep this project's version" @click="markResolved(it, 'mine')">Keep mine</button>
                <button type="button" class="scm-resolve" :disabled="busy" :aria-label="`Keep GitHub's version of ${it.path}`"
                        title="Keep GitHub's version" @click="markResolved(it, 'theirs')">Keep GitHub's</button>
                <button type="button" class="scm-resolve" :disabled="busy" :aria-label="`Mark ${it.path} resolved`"
                        title="You edited it: mark it resolved" @click="markResolved(it)">
                  <Icon icon="lucide:check" aria-hidden="true" /> Mark resolved
                </button>
                <button type="button" class="scm-mergeopen" :aria-label="`Open ${it.path} in the merge editor`"
                        title="Base, yours, theirs and the result, side by side" @click="emit('open-merge', it.path)">
                  <Icon icon="lucide:git-merge" aria-hidden="true" /> Merge editor
                </button>
              </div>
            </div>
          </div>
        </template>
        <p v-if="status.has_remote" class="scm-foot">
          <Icon icon="lucide:clock" aria-hidden="true" />
          These changes are in this project's sandbox. Changes you have not pushed are kept for 3 days after
          you last use the project. Push them, or download a backup.
        </p>
      </div>
      <!-- History: the branch's commits, newest first, page by page; a commit opens to its files, a file to its two
           sides as that commit changed it. -->
      <div v-if="historyOpen" class="scm-history">
        <div class="scm-group-h">
          History <span class="scm-count">{{ history.length }}{{ historyMore ? '+' : '' }}</span>
          <label class="scm-check scm-allbranches">
            <input id="scm-graph" v-model="historyGraph" type="checkbox" :disabled="historyLoading" /> All branches
          </label>
        </div>
        <p v-if="historyError" class="scm-note err" role="alert">{{ historyError }}</p>
        <p v-else-if="historyLoading && !history.length" class="scm-note">Loading the history…</p>
        <p v-else-if="!history.length" class="scm-note">No commits yet.</p>
        <ul class="scm-commits">
          <li v-for="c in history" :key="c.sha" class="scm-commitrow">
            <button type="button" class="scm-commitbtn" :aria-expanded="openCommit === c.sha ? 'true' : 'false'" :title="c.subject" @click="toggleCommit(c)">
              <!-- The commit graph (ADM-1321): each branch's line in its lane; a merge joins two. -->
              <span v-if="graphRows[c.sha]" class="scm-graph" :style="{ width: `${graphRows[c.sha].width * LANE_PX}px` }" aria-hidden="true">
                <svg :viewBox="`0 0 ${graphRows[c.sha].width * LANE_PX} 2`" preserveAspectRatio="none">
                  <path v-for="(e, i) in graphRows[c.sha].edges" :key="i" :d="edgePath(e)" :class="`lane-c${e.color}`" />
                </svg>
                <span class="scm-dot" :class="[`lane-c${graphRows[c.sha].color}`, { merge: (c.parents || []).length > 1 }]"
                      :style="{ left: `${graphRows[c.sha].lane * LANE_PX + LANE_PX / 2}px` }"></span>
              </span>
              <Icon :icon="openCommit === c.sha ? 'lucide:chevron-down' : 'lucide:chevron-right'" class="scm-chev" aria-hidden="true" />
              <span v-for="r in shownRefs(c)" :key="r.kind + r.name" translate="no" class="scm-ref" :class="[r.kind, { current: r.current }]">
                <Icon v-if="r.kind === 'tag'" icon="lucide:tag" aria-hidden="true" />{{ r.name }}
              </span>
              <span class="scm-subject">{{ c.subject }}</span>
              <span class="scm-meta">{{ c.author }}, {{ ago(c.date) }} <code>{{ c.short }}</code></span>
            </button>
            <ul v-if="openCommit === c.sha" class="scm-cfiles">
              <li><button type="button" class="scm-linkbtn" @click="tagCommit(c)"><Icon icon="lucide:tag" aria-hidden="true" /> Tag this commit…</button></li>
              <li v-if="!commitFiles[c.sha]" class="scm-note">Loading…</li>
              <li v-else-if="!commitFiles[c.sha].length" class="scm-note">No file changes (a merge).</li>
              <li v-for="f in commitFiles[c.sha] || []" :key="f.path">
                <button type="button" class="scm-row" :title="`Show ${f.path} as this commit changed it`" @click="openCommitDiff(c, f)">
                  <span class="scm-badge" :class="f.status">{{ letter(f) }}</span>
                  <span class="scm-path">{{ f.path }}</span>
                </button>
              </li>
            </ul>
          </li>
        </ul>
        <button v-if="historyMore" type="button" class="scm-btn scm-older" :disabled="historyLoading" @click="loadHistory(historyPage + 1)">
          {{ historyLoading ? 'Loading…' : 'Older commits' }}
        </button>
      </div>

      <div v-if="loaded && !status.has_remote" class="scm-keep">
        <p class="scm-foot warn">
          <Icon icon="lucide:triangle-alert" aria-hidden="true" />
          This project is only in its sandbox, which is deleted 3 days after you last use the project. Publish it
          to GitHub to keep a copy, or download a backup.
        </p>
        <button type="button" class="scm-btn scm-backup" :disabled="busy" @click="downloadBackup">
          <Icon :icon="action === 'backup' ? 'lucide:loader' : 'lucide:hard-drive-download'" :class="{ spin: action === 'backup' }" aria-hidden="true" />
          {{ action === 'backup' ? 'Packing the backup…' : 'Download backup' }}
        </button>
      </div>
    </template>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, onBeforeUnmount, watch } from 'vue'
import { Icon } from '@iconify/vue'
import api from '@/services/api'
import { notify } from '@/composables/useNotify'
import { confirm } from '@/composables/useConfirm'
import { whileSandboxStarts } from '@/utils/sandboxStarting'
import { saveBlob, filenameFrom } from '@/utils/saveBlob'
import { projectCache } from '@/services/projectCache'
import { layoutGraph } from '@/utils/commitGraph'
import { ago } from '@/utils/timeAgo'

const props = defineProps({
  systemId: { type: [String, Number], required: true },
  repoId: { type: [String, Number], required: true },
  // The project's name: the repository name Publish suggests.
  projectName: { type: String, default: '' },
})
// open-file: a conflicted file opens in the editor to be resolved; open-merge: in the 3-way merge editor (ADM-1321).
// `branch`: the branch the project is on, as git reports it (the page's branch picker follows it).
const emit = defineEmits(['count', 'open-diff', 'open-file', 'open-merge', 'changed', 'published', 'branch'])

const status = reactive({ branch: '', default_branch: '', on_default: false, unpushed: 0, on_remote: false,
                          has_remote: true, has_commit: true, clean: true, changes: [], untracked: [], merging: false })
const loading = ref(false)
// True once a status has been read. Until then the panel shows "Loading", never the empty default state: after
// a failed first load, a refresh flashed "No branch · The working tree is clean" (live test 2026-11-09).
const fetched = ref(false)
const loaded = computed(() => fetched.value)
const repoName = ref('')
const isPrivate = ref(true)
const error = ref('')
const waiting = ref(0)
const selected = ref('')
const message = ref('')
const branch = ref('')
const action = ref('')            // 'commit' | 'push' | 'pr' | 'discard' | 'publish' while one runs
const actionError = ref('')
const prUrl = ref('')
let gone = false

const busy = computed(() => !!action.value)
// Staged (ADM-1321): `code` is git's two letters, the index then the working tree. A file staged in part is in both
// groups. Once anything is staged, Commit takes only what is staged, as VS Code does, and the ticks step aside.
const isStaged = (c) => !!c.code && c.status !== 'conflict' && !' ?'.includes(c.code[0])
const isUnstaged = (c) => !c.code || c.status === 'conflict' || c.code[1] !== ' '
const stagedItems = computed(() => (status.changes || []).filter(isStaged))
const hasStaged = computed(() => !status.merging && stagedItems.value.length > 0)
const ticking = computed(() => !status.merging && !hasStaged.value)
const groups = computed(() => [
  { key: 'staged', label: 'Staged', items: stagedItems.value },
  { key: 'changes', label: 'Changes', items: (status.changes || []).filter(isUnstaged) },
  { key: 'untracked', label: 'Untracked', items: status.untracked || [] },
])
// Any branch is pushed, main included; a pull request is offered only from a branch other than the default one.
const canPush = computed(() => status.has_remote && status.branch && status.unpushed > 0)
const canOpenPr = computed(() => !status.on_default && status.branch && status.on_remote && !status.unpushed && !prUrl.value)

const _LETTER = { modified: 'M', added: 'A', deleted: 'D', renamed: 'R', untracked: 'U', conflict: '!' }
function letter(it) { return _LETTER[it.status] || '?' }

function apply(data) {
  Object.assign(status, {
    branch: data.branch || '', default_branch: data.default_branch || '', on_default: !!data.on_default,
    unpushed: data.unpushed || 0, on_remote: !!data.on_remote, clean: !!data.clean,
    has_remote: data.has_remote !== false, has_commit: data.has_commit !== false,
    changes: data.changes || [], untracked: data.untracked || [], merging: !!data.merging,
  })
  // A file that is no longer changed is no longer "unticked".
  const now = new Set([...status.changes, ...status.untracked].map(c => c.path))
  for (const p of [...unticked.value]) if (!now.has(p)) unticked.value.delete(p)
  unticked.value = new Set(unticked.value)
  projectCache.status.set(props.repoId, data)
  emit('count', status.changes.length + status.untracked.length)
  if (status.branch) emit('branch', status.branch)
}

// Opened again: the status last read shows at once while it is read again (ADM-1196; it took 4.6 s on prod).
function showKept() {
  const kept = projectCache.status.get(props.repoId)
  if (!kept) return
  apply(kept)
  fetched.value = true
}

async function load() {
  loading.value = true
  error.value = ''
  try {
    const { data } = await whileSandboxStarts(() => api.getSourceControlStatus(props.systemId, props.repoId),
      { onWaiting: (s) => { waiting.value = s }, isCancelled: () => gone })
    apply(data)
    fetched.value = true
  } catch (e) {
    error.value = e?.response?.data?.error || 'Could not load source control status.'
  } finally {
    loading.value = false
  }
}

// A backup to keep before the sandbox is deleted (ADM-1205 phase F, item 18): every commit as a git bundle, the
// files git does not ignore and RESTORE.txt, saved on the person's computer. Nothing in the project changes.
async function downloadBackup() {
  action.value = 'backup'
  try {
    const res = await whileSandboxStarts(() => api.downloadProjectBackup(props.systemId, props.repoId),
      { onWaiting: (s) => { waiting.value = s }, isCancelled: () => gone })
    saveBlob(res.data, filenameFrom(res.headers, `${props.projectName || 'project'}-backup.tar.gz`))
    notify.success('Backup downloaded')
  } catch (e) {
    notify.error(e?.response?.data?.error || 'The backup could not be downloaded. Try again.')
  } finally {
    action.value = ''
  }
}

async function run(kind, call, done) {
  action.value = kind
  actionError.value = ''
  try {
    const { data } = await whileSandboxStarts(call, { onWaiting: (s) => { waiting.value = s }, isCancelled: () => gone })
    if (data && 'clean' in data) apply(data)
    if (done) done(data)
    emit('changed')
  } catch (e) {
    const data = e?.response?.data
    actionError.value = data?.error || 'That did not work. Try again.'
    // Some refusals carry the state that changed anyway (a repository created whose push failed): show it.
    if (data && typeof data === 'object' && 'clean' in data) { apply(data); emit('changed') }
  } finally {
    action.value = ''
  }
}

function publish() {
  if (busy.value) return
  const name = (repoName.value.trim() || props.projectName || '').trim()
  run('publish', () => api.publishProject(props.systemId, props.repoId, { name, private: isPrivate.value }), (data) => {
    notify.success('Published to GitHub')
    emit('published', data.published || {})
  })
}

function commit() {
  if (busy.value || !message.value.trim()) return
  const body = { message: message.value.trim() }
  if (branch.value.trim()) body.branch = branch.value.trim()
  if (hasStaged.value) body.staged = true
  else if (!status.merging && unticked.value.size) body.paths = chosen.value
  run('commit', () => api.commitSourceControl(props.systemId, props.repoId, body), () => {
    notify.success('Committed')
    message.value = ''
    branch.value = ''
    prUrl.value = ''
  })
}

function push() {
  run('push', () => api.pushSourceControl(props.systemId, props.repoId), (data) => notify.success(`Pushed ${data.pushed}`))
}

function startPullRequest() {
  prTitle.value = prTitle.value || status.branch
  prOpen.value = true
}
function openPullRequest() {
  run('pr', () => api.openPullRequest(props.systemId, props.repoId, { title: prTitle.value.trim(), body: prBody.value.trim() }), (data) => {
    prUrl.value = data.url
    prOpen.value = false
    // The branch already had its pull request (the Coding Agent opened it): that one is shown, never an error.
    notify.success(data.existing ? 'This branch already has a pull request. It is linked below.' : 'Pull request opened')
  })
}

async function discard(it) {
  const ok = await confirm({
    title: `Discard the changes in ${it.path}?`,
    message: it.status === 'untracked' ? 'The new file is deleted.' : 'The file goes back to its last commit.',
    confirmText: 'Discard', danger: true,
  })
  if (!ok) return
  run('discard', () => api.discardSourceControlFile(props.systemId, props.repoId, it.path))
}

// ── Pull, a merge's conflicts, discard all, a branch, history (ADM-1205, phase C) ──────────────────────────────
const unticked = ref(new Set())          // files left out of the next commit (every file is in it by default)
const allFiles = computed(() => [...(status.changes || []), ...(status.untracked || [])])
const chosen = computed(() => allFiles.value.map(c => c.path).filter(p => !unticked.value.has(p)))
const conflicts = computed(() => (status.changes || []).filter(c => c.status === 'conflict'))
const commitLabel = computed(() => {
  if (action.value === 'commit') return 'Committing…'
  if (status.merging) return conflicts.value.length ? 'Resolve the conflicts to commit' : 'Commit the merge'
  const where = branch.value.trim() ? `to ${branch.value.trim()}` : `on ${status.branch || 'this branch'}`
  if (hasStaged.value) {
    const k = stagedItems.value.length
    return `Commit ${k} staged ${k === 1 ? 'file' : 'files'} ${where}`
  }
  const n = chosen.value.length
  return n === allFiles.value.length ? `Commit ${where}` : `Commit ${n} ${n === 1 ? 'file' : 'files'} ${where}`
})
function tick(path, on) {
  const next = new Set(unticked.value)
  if (on) next.delete(path); else next.add(path)
  unticked.value = next
}
const allTicked = (g) => g.items.every(it => !unticked.value.has(it.path))
const someTicked = (g) => !allTicked(g) && g.items.some(it => !unticked.value.has(it.path))
function tickAll(g, on) {
  const next = new Set(unticked.value)
  for (const it of g.items) { if (on) next.delete(it.path); else next.add(it.path) }
  unticked.value = next
}

function pull() {
  run('pull', () => api.pullSourceControl(props.systemId, props.repoId), (data) => {
    const n = data.pulled?.commits || 0
    notify.success(n ? `Pulled ${n} ${n === 1 ? 'commit' : 'commits'} from GitHub` : 'Already up to date with GitHub')
  })
}
function abortMerge() {
  run('abort', () => api.abortMerge(props.systemId, props.repoId), () => notify.success('Merge aborted'))
}
function markResolved(it, side = '') {
  run('resolve', () => api.markResolved(props.systemId, props.repoId, it.path, side), () => notify.success(
    side === 'mine' ? `Kept your version of ${it.path}` : side === 'theirs' ? `Kept GitHub's version of ${it.path}` : `${it.path} is resolved`))
}
async function discardAll() {
  const n = allFiles.value.length
  const ok = await confirm({
    title: `Discard all ${n} ${n === 1 ? 'change' : 'changes'}?`,
    message: 'Every changed file goes back to its last commit and every new file is deleted. Files git ignores (such as .env) stay.',
    confirmText: 'Discard all', danger: true,
  })
  if (!ok) return
  run('discard', () => api.discardAllSourceControl(props.systemId, props.repoId), () => notify.success('Discarded every change'))
}
const branchOpen = ref(false)
const newBranch = ref('')
function createBranch() {
  const name = newBranch.value.trim()
  if (!name || busy.value) return
  run('branch', () => api.createBranch(props.systemId, props.repoId, name), (data) => {
    notify.success(`On the new branch ${data.created}`)
    newBranch.value = ''
    branchOpen.value = false
    prUrl.value = ''
  })
}
const prOpen = ref(false)
const prTitle = ref('')
const prBody = ref('')

const historyOpen = ref(false)
const history = ref([])
const historyPage = ref(0)
const historyMore = ref(false)
const historyLoading = ref(false)
const historyError = ref('')
const openCommit = ref('')
const commitFiles = reactive({})
function toggleHistory() {
  historyOpen.value = !historyOpen.value
  if (historyOpen.value) loadHistory(0)
}
async function loadHistory(page) {
  historyLoading.value = true
  historyError.value = ''
  try {
    const { data } = await whileSandboxStarts(() => api.getSourceControlLog(props.systemId, props.repoId, page,
      ...(historyGraph.value ? [{ graph: true }] : [])),
      { isCancelled: () => gone })
    history.value = page === 0 ? data.commits : [...history.value, ...data.commits]
    historyPage.value = page
    historyMore.value = !!data.more
  } catch (e) {
    historyError.value = e?.response?.data?.error || 'The history could not be loaded.'
  } finally {
    historyLoading.value = false
  }
}
async function toggleCommit(c) {
  openCommit.value = openCommit.value === c.sha ? '' : c.sha
  if (!openCommit.value || commitFiles[c.sha]) return
  try {
    const { data } = await api.getCommitFiles(props.systemId, props.repoId, c.sha)
    commitFiles[c.sha] = data.files || []
  } catch {
    commitFiles[c.sha] = []
    historyError.value = 'The commit\'s files could not be loaded.'
  }
}
function openCommitDiff(c, f) {
  emit('open-diff', { path: f.path, status: f.status, sha: c.sha, short: c.short, from: f.from || '' })
}
// A commit, a pull or a branch changes the history: it is read again when shown.
watch(() => status.branch + (fetched.value ? '' : '-') + status.unpushed, () => { if (historyOpen.value) loadHistory(0) })

// ── The commit graph, staging, stash and tags (ADM-1321) ───────────────────────────────────────────────────────
// The graph: every page's lanes continue the page before (commitGraph.js); "All branches" reads every branch, GitHub's
// branches and the tags. Nothing is cut: older commits come page by page.
const LANE_PX = 12
const historyGraph = ref(false)
watch(historyGraph, () => { if (historyOpen.value) loadHistory(0) })
const graphRows = computed(() => Object.fromEntries(layoutGraph(history.value).rows.map((r) => [r.sha, r])))
function edgePath(e) {
  const x1 = e.from * LANE_PX + LANE_PX / 2
  const x2 = e.to * LANE_PX + LANE_PX / 2
  const [y1, y2] = e.half === 'top' ? [0, 1] : [1, 2]
  return x1 === x2 ? `M${x1} ${y1}L${x2} ${y2}` : `M${x1} ${y1}C${x1} ${y1 + 0.6} ${x2} ${y2 - 0.6} ${x2} ${y2}`
}
// The branches and tags at a commit; the branch HEAD is on is marked, HEAD itself is not shown on its own.
function shownRefs(c) {
  const refs = c.refs || []
  const onHead = refs.some((r) => r.kind === 'head')
  let marked = false
  return refs.filter((r) => r.kind !== 'head').map((r) => {
    const current = onHead && !marked && r.kind === 'branch'
    if (current) marked = true
    return { ...r, current }
  })
}

// Stage or unstage a file whole; a single change is staged from its diff in the editor.
function stageFile(it, unstage) {
  run('stage', () => api.stageSourceControlChange(props.systemId, props.repoId, { path: it.path, unstage }),
    () => notify.success(unstage ? `Unstaged ${it.path}` : `Staged ${it.path}`))
}

const stashOpen = ref(false)
const stashes = ref([])
const stashesLoading = ref(false)
const stashError = ref('')
const stashMessage = ref('')
const stashUntracked = ref(false)
function toggleStashes() {
  stashOpen.value = !stashOpen.value
  if (stashOpen.value) loadStashes()
}
async function loadStashes() {
  stashesLoading.value = true
  stashError.value = ''
  try {
    const { data } = await whileSandboxStarts(() => api.getStashes(props.systemId, props.repoId), { isCancelled: () => gone })
    stashes.value = data.stashes || []
  } catch (e) {
    stashError.value = e?.response?.data?.error || 'The stashes could not be loaded.'
  } finally {
    stashesLoading.value = false
  }
}
// Every stash action answers the stashes after it, also when it was refused (a conflict leaves the stash).
function stashRun(kind, body, done) {
  return run(kind, () => api.stashSourceControl(props.systemId, props.repoId, body), (data) => {
    stashes.value = data.stashes || []
    if (done) done(data)
  }).then(() => {
    if (actionError.value) stashError.value = actionError.value
  })
}
function stashPush() {
  if (busy.value || status.clean) return
  stashError.value = ''
  const body = { op: 'push', include_untracked: stashUntracked.value, ...(stashMessage.value.trim() ? { message: stashMessage.value.trim() } : {}) }
  stashRun('stash', body, () => { notify.success('Changes stashed'); stashMessage.value = '' })
}
async function stashOp(op, s) {
  if (busy.value) return
  if (op === 'drop') {
    const ok = await confirm({
      title: `Drop the stash "${s.message || s.ref}"?`,
      message: 'Its changes are deleted for good. Apply it first to keep them.',
      confirmText: 'Drop', danger: true,
    })
    if (!ok) return
  }
  stashError.value = ''
  stashRun(op, { op, index: s.index, sha: s.sha }, () => notify.success(
    op === 'drop' ? 'Stash dropped' : op === 'pop' ? 'Stash applied and dropped' : 'Stash applied'))
}

const tagsOpen = ref(false)
const tags = ref([])
const tagsLoading = ref(false)
const tagsError = ref('')
const tagName = ref('')
const tagMessage = ref('')
const tagTarget = ref(null)          // a commit from History, or null for the commit the project is on
function toggleTags() {
  tagsOpen.value = !tagsOpen.value
  if (tagsOpen.value) loadTags()
}
async function loadTags() {
  tagsLoading.value = true
  tagsError.value = ''
  try {
    const { data } = await whileSandboxStarts(() => api.getTags(props.systemId, props.repoId), { isCancelled: () => gone })
    tags.value = data.tags || []
  } catch (e) {
    tagsError.value = e?.response?.data?.error || 'The tags could not be loaded.'
  } finally {
    tagsLoading.value = false
  }
}
function tagCommit(c) {
  tagTarget.value = { sha: c.sha, short: c.short }
  if (!tagsOpen.value) toggleTags()
}
async function tagAction(kind, call, done) {
  action.value = kind
  tagsError.value = ''
  try {
    const { data } = await whileSandboxStarts(call, { onWaiting: (s) => { waiting.value = s }, isCancelled: () => gone })
    if (data.tags) tags.value = data.tags
    done(data)
  } catch (e) {
    const data = e?.response?.data
    if (data?.tags) tags.value = data.tags
    tagsError.value = data?.error || 'That did not work. Try again.'
  } finally {
    action.value = ''
  }
}
function createTag() {
  const name = tagName.value.trim()
  if (!name || busy.value) return
  const body = { op: 'create', name, ...(tagTarget.value ? { sha: tagTarget.value.sha } : {}),
    ...(tagMessage.value.trim() ? { message: tagMessage.value.trim() } : {}) }
  tagAction('tag', () => api.changeTag(props.systemId, props.repoId, body), () => {
    notify.success(`Tag ${name} created`)
    tagName.value = ''
    tagMessage.value = ''
    tagTarget.value = null
    if (historyOpen.value) loadHistory(0)
  })
}
async function deleteTag(t) {
  if (busy.value) return
  const ok = await confirm({
    title: `Delete the tag ${t.name}?`,
    message: 'It is deleted from this project only. A tag already on GitHub stays there.',
    confirmText: 'Delete', danger: true,
  })
  if (!ok) return
  tagAction('tag', () => api.changeTag(props.systemId, props.repoId, { op: 'delete', name: t.name }), () => {
    notify.success(`Tag ${t.name} deleted`)
    if (historyOpen.value) loadHistory(0)
  })
}
function pushTag(t) {
  if (busy.value) return
  tagAction(`pushtag:${t.name}`, () => api.pushTag(props.systemId, props.repoId, t.name),
    () => notify.success(`Pushed the tag ${t.name} to GitHub`))
}

// The diff opens in the editor, side by side, as VS Code shows a change.
function openDiff(it) {
  selected.value = it.path
  emit('open-diff', { path: it.path, status: it.status })
}

onMounted(() => { showKept(); load() })
onBeforeUnmount(() => { gone = true })
watch(() => [props.systemId, props.repoId], () => {
  prUrl.value = ''; fetched.value = false; unticked.value = new Set(); history.value = []; historyOpen.value = false
  stashOpen.value = false; stashes.value = []; tagsOpen.value = false; tags.value = []; tagTarget.value = null
  showKept(); load()
})
defineExpose({ refresh: load })
</script>

<style scoped>
.scm { display: flex; flex-direction: column; height: 100%; min-height: 0; font: 12.5px var(--vm-font-sans); color: var(--vm-ink); }
.sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; border: 0; }
.scm-head { display: flex; align-items: center; gap: 6px; padding: 7px 10px; border-bottom: 1px solid var(--vm-line); }
.scm-branch { display: inline-flex; align-items: center; gap: 5px; font: 600 12.5px var(--vm-font-mono); color: var(--vm-ink); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.scm-branch :deep(svg) { width: 13px; height: 13px; flex: 0 0 auto; }
.scm-refresh { margin-left: auto; border: none; background: transparent; color: var(--vm-ink-soft); cursor: pointer; border-radius: 6px; width: 28px; height: 28px; display: grid; place-items: center; }
.scm-refresh:hover { background: var(--vm-surface-soft); color: var(--vm-ink); }
.scm-refresh:disabled { cursor: progress; }
.scm-refresh:focus-visible { outline: 2px solid var(--vm-violet); outline-offset: 1px; }
.scm-refresh :deep(svg) { width: 14px; height: 14px; }
.scm-empty { padding: 16px 12px; color: var(--vm-ink-soft); display: flex; align-items: center; gap: 6px; line-height: 1.45; }
.scm-empty.err { color: var(--vm-red-ink); }
.scm-empty :deep(svg) { width: 14px; height: 14px; flex: 0 0 auto; color: var(--vm-green); }
.scm-empty :deep(svg.scm-faint) { color: var(--vm-ink-faint); }

.scm-commit { display: flex; flex-direction: column; gap: 6px; padding: 10px; border-bottom: 1px solid var(--vm-line); }
.scm-input { width: 100%; min-width: 0; box-sizing: border-box; padding: 6px 8px; border: 1px solid var(--vm-line-2); border-radius: 7px; background: var(--vm-surface); color: var(--vm-ink); font: 12.5px/1.45 var(--vm-font-sans); resize: vertical; }
.scm-input:focus-visible { outline: 2px solid var(--vm-violet); outline-offset: 1px; border-color: transparent; }
.scm-branchrow { display: flex; flex-direction: column; gap: 4px; }
.scm-label { font-weight: 600; font-size: 12px; color: var(--vm-ink-soft); }
.scm-hint { font-weight: 400; color: var(--vm-ink-faint); }
.scm-btn { display: inline-flex; align-items: center; justify-content: center; gap: 6px; min-height: 32px; padding: 0 12px; border: 1px solid var(--vm-line-2); border-radius: 7px; background: var(--vm-surface); color: var(--vm-ink); font: 600 12.5px var(--vm-font-sans); cursor: pointer; transition: background-color .15s, border-color .15s; }
.scm-btn:hover:not(:disabled) { background: var(--vm-surface-soft); }
.scm-btn.primary { background: var(--vm-violet); border-color: var(--vm-violet); color: #fff; }
.scm-btn.primary:hover:not(:disabled) { background: var(--vm-violet-d); }
.scm-btn:disabled { opacity: .55; cursor: not-allowed; }
.scm-btn:focus-visible { outline: 2px solid var(--vm-violet); outline-offset: 2px; }
.scm-btn :deep(svg) { width: 14px; height: 14px; }
.scm-sync { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; padding: 10px; border-bottom: 1px solid var(--vm-line); }
.scm-pr { display: inline-flex; align-items: center; gap: 5px; color: var(--vm-violet); font-weight: 600; text-decoration: none; }
.scm-pr:hover { text-decoration: underline; }
.scm-pr :deep(svg) { width: 13px; height: 13px; }
.scm-note { margin: 6px 10px 0; font-size: 12px; line-height: 1.45; }
.scm-publish { display: flex; flex-direction: column; gap: 6px; padding: 10px; border-bottom: 1px solid var(--vm-line); }
.scm-publish-h { display: inline-flex; align-items: center; gap: 6px; margin: 0 0 2px; font-weight: 700; font-size: 12.5px; color: var(--vm-ink); }
.scm-publish-h :deep(svg) { width: 14px; height: 14px; }
.scm-check { display: inline-flex; align-items: center; gap: 6px; font-size: 12.5px; color: var(--vm-ink-soft); cursor: pointer; }
.scm-check input { width: 15px; height: 15px; accent-color: var(--vm-violet); }
.scm-foot.warn { color: color-mix(in srgb, var(--vm-amber) 55%, var(--vm-ink)); }
.scm-tools { margin-left: auto; display: flex; flex-wrap: wrap; justify-content: flex-end; align-items: center; gap: 2px; }
.scm-tools .scm-refresh { margin-left: 0; }
.scm-refresh.on { color: var(--vm-violet-ink); background: var(--vm-violet-soft); }
.scm-newbranch, .scm-prform { display: flex; flex-direction: column; gap: 6px; padding: 10px; border-bottom: 1px solid var(--vm-line); }
.scm-inline { display: flex; gap: 6px; align-items: center; }
.scm-inline .scm-input { flex: 1 1 auto; }
.scm-merge { display: flex; flex-direction: column; gap: 8px; padding: 10px; border-bottom: 1px solid var(--vm-line); background: var(--vm-amber-soft); }
.scm-merge-t { display: flex; gap: 6px; margin: 0; line-height: 1.45; color: var(--vm-amber-ink); }
.scm-merge-t :deep(svg) { width: 14px; height: 14px; flex: 0 0 auto; margin-top: 2px; }
.scm-merge .scm-btn { align-self: flex-start; }
.scm-tick { flex: 0 0 auto; width: 14px; height: 14px; margin: 0 0 0 10px; accent-color: var(--vm-violet); cursor: pointer; }
.scm-group-h .scm-tick { margin: 0; }
.scm-rowwrap .scm-row { padding-left: 6px; }
.scm-rowwrap.conflict { background: color-mix(in srgb, var(--vm-amber) 10%, transparent); flex-wrap: wrap; }
.scm-conflict-actions { flex: 1 0 100%; display: flex; flex-wrap: wrap; gap: 4px; padding: 0 8px 6px 34px; }
.scm-badge.conflict { color: var(--vm-amber-ink); }
.scm-resolve { flex: 0 0 auto; display: inline-flex; align-items: center; gap: 4px; margin-right: 6px; padding: 2px 8px; border: 1px solid var(--vm-line-2); border-radius: 6px; background: var(--vm-surface); color: var(--vm-ink); font: 600 11.5px var(--vm-font-sans); cursor: pointer; }
.scm-resolve:hover:not(:disabled) { border-color: var(--vm-green); color: var(--vm-green-ink); }
.scm-resolve :deep(svg) { width: 12px; height: 12px; }
.scm-resolve:focus-visible { outline: 2px solid var(--vm-violet); outline-offset: 1px; }
.scm-history { border-top: 1px solid var(--vm-line); padding-bottom: 8px; }
.scm-commits, .scm-cfiles { list-style: none; margin: 0; padding: 0; }
.scm-commitrow { content-visibility: auto; contain-intrinsic-size: auto 28px; }
.scm-cfiles { padding-left: 18px; }
.scm-commitbtn { display: flex; align-items: center; gap: 6px; width: 100%; min-width: 0; padding: 5px 10px; border: none; background: transparent; text-align: left; cursor: pointer; color: var(--vm-ink); }
.scm-commitbtn:hover { background: var(--vm-surface-soft); }
.scm-commitbtn:focus-visible { outline: 2px solid var(--vm-violet); outline-offset: -2px; }
.scm-chev { width: 12px; height: 12px; flex: 0 0 auto; color: var(--vm-ink-faint); }
.scm-subject { flex: 1 1 auto; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.scm-meta { flex: 0 1 auto; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 11px; color: var(--vm-ink-faint); }
.scm-meta code { font: 11px var(--vm-font-mono); }
.scm-older { margin: 6px 10px 0; }
.scm-note.err { color: var(--vm-red-ink); }

.scm-list { overflow: auto; flex: 0 1 auto; }
.scm-group-h { display: flex; align-items: center; gap: 6px; padding: 8px 10px 4px; font: 600 12px var(--vm-font-sans); color: var(--vm-ink-soft); }
.scm-count { background: var(--vm-surface-soft); color: var(--vm-ink-soft); border-radius: 8px; padding: 0 6px; font-size: 11px; }
.scm-rowwrap { display: flex; align-items: center; }
.scm-rowwrap:hover, .scm-rowwrap:focus-within { background: var(--vm-surface-soft); }
.scm-rowwrap.active { background: var(--vm-violet-soft); }
.scm-row { display: flex; align-items: center; gap: 7px; flex: 1 1 auto; min-width: 0; padding: 5px 4px 5px 10px; background: transparent; border: none; cursor: pointer; text-align: left; }
.scm-row:focus-visible, .scm-discard:focus-visible, .scm-stage:focus-visible { outline: 2px solid var(--vm-violet); outline-offset: -2px; }
.scm-discard, .scm-stage { flex: 0 0 auto; display: grid; place-items: center; width: 28px; height: 28px; margin-right: 4px; border: none; border-radius: 6px; background: transparent; color: var(--vm-ink-faint); cursor: pointer; opacity: 0; transition: opacity .12s, color .12s, background-color .12s; }
.scm-rowwrap:hover .scm-discard, .scm-discard:focus-visible, .scm-rowwrap:hover .scm-stage, .scm-stage:focus-visible { opacity: 1; }
.scm-discard:hover:not(:disabled) { color: var(--vm-red-ink); background: var(--vm-surface); }
.scm-discard :deep(svg), .scm-stage :deep(svg) { width: 14px; height: 14px; }
.scm-stage:hover:not(:disabled) { color: var(--vm-green-ink); background: var(--vm-surface); }
.scm-badge { flex: 0 0 auto; width: 16px; text-align: center; font: 700 11px var(--vm-font-mono); border-radius: 4px; color: var(--vm-ink-soft); }
.scm-badge.modified { color: color-mix(in srgb, var(--vm-amber) 70%, var(--vm-ink)); }
.scm-badge.added, .scm-badge.untracked { color: color-mix(in srgb, var(--vm-green) 65%, var(--vm-ink)); }
.scm-badge.deleted { color: var(--vm-red-ink); }
.scm-badge.renamed { color: var(--vm-violet); }
.scm-path { flex: 1 1 auto; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--vm-ink); font-family: var(--vm-font-mono); font-size: 12px; }
.scm-foot { display: flex; align-items: flex-start; gap: 6px; margin: 8px 12px 12px; font-size: 12px; line-height: 1.5; color: var(--vm-ink-soft); }
.scm-foot :deep(svg) { width: 12px; height: 12px; flex: 0 0 auto; margin-top: 3px; }
.scm-keep .scm-foot { margin-bottom: 8px; }
.scm-backup { margin: 0 12px 12px 30px; }
.spin { animation: scm-spin 1s linear infinite; } @keyframes scm-spin { to { transform: rotate(360deg); } }
/* Stashes and tags (ADM-1321) */
.scm-section { display: flex; flex-direction: column; gap: 4px; padding-bottom: 8px; border-bottom: 1px solid var(--vm-line); }
.scm-sectionform { display: flex; flex-direction: column; gap: 6px; padding: 10px 10px 4px; }
.scm-plain { list-style: none; margin: 0; padding: 0; }
.scm-item { gap: 4px; padding: 2px 4px 2px 10px; }
.scm-item-ic { width: 13px; height: 13px; flex: 0 0 auto; color: var(--vm-ink-faint); }
.scm-item-t { flex: 1 1 auto; min-width: 0; display: flex; flex-direction: column; padding: 3px 0; }
.scm-item-name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--vm-ink); }
.scm-item-meta { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 11px; color: var(--vm-ink-faint); }
.scm-item-meta code { font: 11px var(--vm-font-mono); }
.scm-icon { flex: 0 0 auto; display: grid; place-items: center; width: 28px; height: 28px; border: none; border-radius: 6px; background: transparent; color: var(--vm-ink-soft); cursor: pointer; transition: color .15s, background-color .15s; }
.scm-icon:hover:not(:disabled) { color: var(--vm-ink); background: var(--vm-surface); }
.scm-icon.danger:hover:not(:disabled) { color: var(--vm-red-ink); }
.scm-icon:disabled { opacity: .55; cursor: not-allowed; }
.scm-icon:focus-visible, .scm-linkbtn:focus-visible, .scm-mergeopen:focus-visible { outline: 2px solid var(--vm-violet); outline-offset: 1px; }
.scm-icon :deep(svg) { width: 14px; height: 14px; }
.scm-linkbtn { align-self: flex-start; display: inline-flex; align-items: center; gap: 4px; padding: 3px 0; border: none; background: transparent; color: var(--vm-violet-ink); font: 600 12px var(--vm-font-sans); cursor: pointer; }
.scm-linkbtn:hover { text-decoration: underline; }
.scm-linkbtn :deep(svg) { width: 12px; height: 12px; }
.scm-cfiles .scm-linkbtn { margin: 2px 0 2px 10px; }
.scm-mergeopen { flex: 0 0 auto; display: inline-flex; align-items: center; gap: 4px; padding: 2px 8px; border: 1px solid var(--vm-violet); border-radius: 6px; background: var(--vm-violet-soft); color: var(--vm-violet-ink); font: 600 11.5px var(--vm-font-sans); cursor: pointer; }
.scm-mergeopen:hover { background: var(--vm-surface); }
.scm-mergeopen :deep(svg) { width: 12px; height: 12px; }
/* The commit graph: one 12 px lane per branch line; the lines stretch to the row's height. */
.scm-allbranches { margin-left: auto; font-weight: 400; font-size: 12px; }
.scm-commitbtn { min-height: 28px; padding-top: 0; padding-bottom: 0; align-items: stretch; }
.scm-commitbtn > :not(.scm-graph) { align-self: center; }
.scm-graph { position: relative; flex: 0 0 auto; align-self: stretch; margin: 0 2px 0 -4px; }
.scm-graph svg { position: absolute; inset: 0; width: 100%; height: 100%; overflow: visible; }
.scm-graph path { fill: none; stroke-width: 2px; vector-effect: non-scaling-stroke; stroke: currentColor; }
.scm-dot { position: absolute; top: 50%; width: 9px; height: 9px; margin: -4.5px 0 0 -4.5px; border-radius: 50%; background: currentColor; box-shadow: 0 0 0 2px var(--vm-surface); }
.scm-dot.merge { background: var(--vm-surface); border: 2px solid currentColor; box-sizing: border-box; }
.lane-c0 { color: var(--vm-violet); } .lane-c1 { color: var(--vm-teal); } .lane-c2 { color: var(--vm-amber); }
.lane-c3 { color: var(--vm-pink); } .lane-c4 { color: var(--vm-sky); } .lane-c5 { color: var(--vm-green); } .lane-c6 { color: var(--vm-lime); }
.scm-ref { flex: 0 1 auto; min-width: 0; max-width: 40%; display: inline-flex; align-items: center; gap: 3px; padding: 0 5px; border: 1px solid var(--vm-line-2); border-radius: 8px; font: 600 10.5px/16px var(--vm-font-mono); color: var(--vm-ink-soft); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.scm-ref.current { border-color: var(--vm-violet); color: var(--vm-violet-ink); background: var(--vm-violet-soft); }
.scm-ref.tag { color: var(--vm-amber-ink); border-color: color-mix(in srgb, var(--vm-amber) 50%, transparent); }
.scm-ref.remote { color: var(--vm-ink-faint); }
.scm-ref :deep(svg) { width: 10px; height: 10px; flex: 0 0 auto; }
@media (max-width: 640px) {
  .scm-row { min-height: 44px; } .scm-refresh, .scm-discard, .scm-stage, .scm-icon { width: 44px; height: 44px; } .scm-discard, .scm-stage { opacity: 1; }
  .scm-btn, .scm-linkbtn, .scm-mergeopen, .scm-resolve, .scm-commitbtn { min-height: 44px; } .scm-input { font-size: 16px; }
}
@media (hover: none) { .scm-discard, .scm-stage { opacity: 1; } }
@media (prefers-reduced-motion: reduce) { .spin { animation: none; } }
</style>
