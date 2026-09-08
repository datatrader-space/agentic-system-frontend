<template>
  <div class="sn">
    <header class="sn-hero">
      <div class="sn-hero-copy">
        <div class="sn-eyebrow">Platform policy</div>
        <h1>Sandbox Network</h1>
        <p>
          Decide what agent sandboxes may reach on the internet. Changes take effect on the next
          sandbox — no deploy, no engineer.
        </p>
      </div>
    </header>

    <div v-if="loading" class="sn-loading">
      <div v-for="n in 5" :key="n" class="sn-skeleton"></div>
    </div>

    <template v-else>
      <!-- What is in force right now, including profiles nobody has configured. This is the
           question an admin actually arrives with, so it is answered first. -->
      <section class="sn-card">
        <h2>In force right now</h2>
        <p class="sn-sub">
          Every sandbox profile and the policy it would be created with today.
        </p>

        <table class="sn-table">
          <thead>
            <tr>
              <th>Profile</th>
              <th>Can reach</th>
              <th>Set by</th>
              <th>Running now</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in effective" :key="row.profile_id">
              <td class="mono">{{ row.profile_id }}</td>
              <td>
                <span class="sn-pill" :class="pillClass(row.mode)">{{ modeLabel(row.mode) }}</span>
                <div v-if="row.domain_allow_list && row.domain_allow_list !== '*'" class="sn-domains">
                  {{ row.domain_allow_list }}
                </div>
              </td>
              <td>
                <span class="sn-source" :class="row.source">{{ sourceLabel(row.source) }}</span>
              </td>
              <td>
                <!-- Stated because a policy change does not reach these. -->
                <span :class="{ 'sn-stale': row.running_sandboxes > 0 }">{{ row.running_sandboxes }}</span>
              </td>
              <td class="right">
                <button class="sn-link" @click="editProfile(row.profile_id)">Edit</button>
              </td>
            </tr>
          </tbody>
        </table>

        <p v-if="anyRunning" class="sn-note">
          Sandboxes already running keep the policy they started with. Only new ones pick up a change.
        </p>
      </section>

      <!-- Editor -->
      <section class="sn-card">
        <h2>{{ editing.id ? 'Edit policy' : 'Add a policy' }}</h2>

        <div class="sn-grid">
          <label class="sn-field">
            <span>Applies to</span>
            <select v-model="editing.profile_id">
              <option :value="allProfilesToken">Every profile</option>
              <option v-for="p in profiles" :key="p.id" :value="p.id">{{ p.id }}</option>
            </select>
            <small>A specific profile overrides the “every profile” rule.</small>
          </label>

          <label class="sn-field">
            <span>Workspace</span>
            <input v-model.trim="editing.workspace_id" placeholder="Leave blank for platform-wide" />
            <small>A workspace rule overrides the platform default for that workspace only.</small>
          </label>
        </div>

        <div class="sn-modes">
          <label
            v-for="m in modes"
            :key="m.value"
            class="sn-mode"
            :class="{ active: editing.mode === m.value }"
          >
            <input type="radio" :value="m.value" v-model="editing.mode" />
            <div>
              <strong>{{ m.label }}</strong>
              <p>{{ m.summary }}</p>
              <div class="sn-protects">
                Blocked either way:
                <span v-for="p in m.protects" :key="p">{{ p }}</span>
              </div>
            </div>
          </label>
        </div>

        <div class="sn-grid">
          <label class="sn-field" v-if="editing.mode === 'allowlist'">
            <span>Approved domains</span>
            <textarea
              v-model="editing.allow_domains"
              rows="6"
              placeholder="pypi.org&#10;files.pythonhosted.org&#10;*.github.com"
            ></textarea>
            <small>One per line. <code>*.github.com</code> covers subdomains; a bare name matches exactly.</small>
          </label>

          <label class="sn-field" v-if="editing.mode !== 'block_all'">
            <span>Always blocked</span>
            <textarea
              v-model="editing.deny_domains"
              rows="6"
              placeholder="ads.example.com&#10;*.tracker.test"
            ></textarea>
            <small>Checked first, so a block always wins — even on the public internet.</small>
          </label>
        </div>

        <label class="sn-field">
          <span>Why (optional)</span>
          <input v-model.trim="editing.note" maxlength="255" placeholder="e.g. finance workspace: vendor APIs only" />
        </label>

        <label class="sn-check">
          <input type="checkbox" v-model="editing.enabled" />
          <span>Enabled — turning this off falls back to the next rule instead of opening the sandbox.</span>
        </label>

        <div v-if="error" class="sn-banner danger">{{ error }}</div>

        <div class="sn-actions">
          <button class="sn-save" :disabled="saving" @click="save">
            {{ saving ? 'Saving…' : 'Save policy' }}
          </button>
          <button class="sn-link" @click="resetEditor">Clear</button>
        </div>
      </section>

      <!-- Configured rows -->
      <section class="sn-card" v-if="policies.length">
        <h2>Configured policies</h2>
        <table class="sn-table">
          <thead>
            <tr>
              <th>Scope</th><th>Profile</th><th>Mode</th><th>Domains</th><th>Updated</th><th></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="p in policies" :key="p.id" :class="{ off: !p.enabled }">
              <td>{{ p.workspace_id || 'Platform' }}</td>
              <td class="mono">{{ p.profile_id }}</td>
              <td><span class="sn-pill" :class="pillClass(p.mode)">{{ modeLabel(p.mode) }}</span></td>
              <td class="sn-domains">
                <span v-if="p.allow_domains.length">{{ p.allow_domains.join(', ') }}</span>
                <span v-if="p.deny_domains.length" class="deny">
                  blocked: {{ p.deny_domains.join(', ') }}
                </span>
              </td>
              <td>
                <span v-if="p.updated_at">{{ new Date(p.updated_at).toLocaleString() }}</span>
                <small v-if="p.updated_by"> by {{ p.updated_by }}</small>
              </td>
              <td class="right">
                <button class="sn-link" @click="loadRow(p)">Edit</button>
                <button class="sn-link danger" @click="remove(p)">Delete</button>
              </td>
            </tr>
          </tbody>
        </table>
      </section>

      <!-- What this does and does not buy. Stated on the page rather than in a design doc, because
           the person setting the policy is the person who needs to know its limits. -->
      <section class="sn-card sn-caveats">
        <h2>What this does and does not do</h2>
        <ul>
          <li v-for="c in caveats" :key="c">{{ c }}</li>
        </ul>
      </section>
    </template>
  </div>
</template>

<script setup>
/**
 * Sandbox Network — admin-dashboard page for the egress policy applied to agent sandboxes.
 *
 * The runner already enforces three postures (block-all, approved domains, public internet) and takes the
 * policy as data on every sandbox create. This page only decides which of those the next sandbox gets, so
 * a change here is a row edit rather than a release.
 */
import { ref, reactive, computed, onMounted } from 'vue'
import api from '../../services/api'
import { notify } from '@/composables/useNotify'

const loading = ref(true)
const saving = ref(false)
const error = ref('')

const policies = ref([])
const effective = ref([])
const profiles = ref([])
const modes = ref([])
const caveats = ref([])
const allProfilesToken = ref('*')

const editing = reactive({
  id: null,
  profile_id: '*',
  workspace_id: '',
  mode: 'allowlist',
  allow_domains: '',
  deny_domains: '',
  note: '',
  enabled: true,
})

const anyRunning = computed(() => effective.value.some((r) => r.running_sandboxes > 0))

function modeLabel(mode) {
  return modes.value.find((m) => m.value === mode)?.label || mode
}
function pillClass(mode) {
  return { block_all: 'red', allowlist: 'amber', public_internet: 'green' }[mode] || ''
}
function sourceLabel(source) {
  return { workspace: 'Workspace rule', platform: 'Platform rule', 'code-default': 'Built-in default' }[source] || source
}

function resetEditor() {
  Object.assign(editing, {
    id: null, profile_id: allProfilesToken.value, workspace_id: '',
    mode: 'allowlist', allow_domains: '', deny_domains: '', note: '', enabled: true,
  })
  error.value = ''
}

function editProfile(profileId) {
  const existing = policies.value.find((p) => p.profile_id === profileId && !p.workspace_id)
  if (existing) return loadRow(existing)
  resetEditor()
  editing.profile_id = profileId
}

function loadRow(row) {
  Object.assign(editing, {
    id: row.id,
    profile_id: row.profile_id,
    workspace_id: row.workspace_id,
    mode: row.mode,
    allow_domains: (row.allow_domains || []).join('\n'),
    deny_domains: (row.deny_domains || []).join('\n'),
    note: row.note || '',
    enabled: row.enabled,
  })
  error.value = ''
}

async function load() {
  loading.value = true
  try {
    const { data } = await api.getSandboxNetworkPolicies()
    policies.value = data.policies || []
    effective.value = data.effective || []
    profiles.value = data.profiles || []
    modes.value = data.modes || []
    caveats.value = data.caveats || []
    allProfilesToken.value = data.all_profiles_token || '*'
    if (!editing.profile_id) editing.profile_id = allProfilesToken.value
  } catch (e) {
    notify?.error?.('Could not load sandbox network policy')
  } finally {
    loading.value = false
  }
}

async function save() {
  saving.value = true
  error.value = ''
  try {
    const { data } = await api.saveSandboxNetworkPolicy({
      profile_id: editing.profile_id,
      workspace_id: editing.workspace_id,
      mode: editing.mode,
      allow_domains: editing.allow_domains,
      deny_domains: editing.deny_domains,
      note: editing.note,
      enabled: editing.enabled,
    })
    notify?.success?.(data.note || 'Policy saved')
    resetEditor()
    await load()
  } catch (e) {
    // The API refuses the misconfigurations that would fail open (an empty approved list, a value that
    // is not a domain) and says why. Surfacing that verbatim is more useful than a generic failure.
    error.value = e?.response?.data?.error || 'Could not save the policy'
  } finally {
    saving.value = false
  }
}

async function remove(row) {
  if (!confirm(`Delete the policy for ${row.workspace_id || 'platform'}/${row.profile_id}?\n\n` +
               'Resolution falls through to the next rule — this does not open the sandbox.')) return
  try {
    await api.deleteSandboxNetworkPolicy(row.id)
    notify?.success?.('Policy deleted')
    await load()
  } catch (e) {
    notify?.error?.('Could not delete the policy')
  }
}

onMounted(load)
</script>

<style scoped>
.sn { padding: 24px; max-width: 1100px; margin: 0 auto; }
.sn-hero { margin-bottom: 20px; }
.sn-eyebrow { font-size: 12px; letter-spacing: .08em; text-transform: uppercase; color: #6b7280; }
.sn-hero h1 { margin: 4px 0 6px; font-size: 26px; }
.sn-hero p { margin: 0; color: #4b5563; max-width: 68ch; }

.sn-card { background: #fff; border: 1px solid #e5e7eb; border-radius: 12px; padding: 20px; margin-bottom: 18px; }
.sn-card h2 { margin: 0 0 4px; font-size: 16px; }
.sn-sub { margin: 0 0 14px; color: #6b7280; font-size: 13px; }

.sn-table { width: 100%; border-collapse: collapse; font-size: 13px; }
.sn-table th { text-align: left; color: #6b7280; font-weight: 600; padding: 8px 10px; border-bottom: 1px solid #e5e7eb; }
.sn-table td { padding: 10px; border-bottom: 1px solid #f3f4f6; vertical-align: top; }
.sn-table tr.off { opacity: .5; }
.sn-table .right { text-align: right; white-space: nowrap; }
.mono { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }

.sn-pill { display: inline-block; padding: 2px 8px; border-radius: 999px; font-size: 12px; font-weight: 600; }
.sn-pill.red { background: #fee2e2; color: #991b1b; }
.sn-pill.amber { background: #fef3c7; color: #92400e; }
.sn-pill.green { background: #d1fae5; color: #065f46; }

.sn-source { font-size: 12px; color: #6b7280; }
.sn-source.workspace { color: #6d28d9; }
.sn-source.platform { color: #1d4ed8; }

.sn-domains { font-size: 12px; color: #6b7280; margin-top: 4px; word-break: break-word; }
.sn-domains .deny { display: block; color: #b91c1c; }
.sn-stale { color: #b45309; font-weight: 600; }
.sn-note { margin: 12px 0 0; font-size: 12px; color: #6b7280; }

.sn-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 16px; }
.sn-field { display: flex; flex-direction: column; gap: 6px; margin-bottom: 14px; }
.sn-field > span { font-size: 13px; font-weight: 600; }
.sn-field input, .sn-field select, .sn-field textarea {
  border: 1px solid #d1d5db; border-radius: 8px; padding: 8px 10px; font: inherit; font-size: 13px;
}
.sn-field textarea { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; resize: vertical; }
.sn-field small { color: #6b7280; font-size: 12px; }

.sn-modes { display: grid; gap: 10px; margin: 8px 0 18px; }
.sn-mode { display: flex; gap: 10px; border: 1px solid #e5e7eb; border-radius: 10px; padding: 12px; cursor: pointer; }
.sn-mode.active { border-color: #2563eb; background: #eff6ff; }
.sn-mode p { margin: 4px 0; font-size: 13px; color: #4b5563; }
.sn-protects { font-size: 12px; color: #6b7280; }
.sn-protects span { display: inline-block; background: #f3f4f6; border-radius: 4px; padding: 1px 6px; margin: 2px 4px 0 0; }

.sn-check { display: flex; align-items: flex-start; gap: 8px; font-size: 13px; color: #4b5563; margin-bottom: 14px; }
.sn-actions { display: flex; gap: 10px; align-items: center; }
.sn-save { background: #2563eb; color: #fff; border: 0; border-radius: 8px; padding: 9px 16px; font-weight: 600; cursor: pointer; }
.sn-save:disabled { opacity: .6; cursor: default; }
.sn-link { background: none; border: 0; color: #2563eb; cursor: pointer; font: inherit; padding: 0 6px; }
.sn-link.danger { color: #b91c1c; }

.sn-banner { border-radius: 8px; padding: 10px 12px; font-size: 13px; margin-bottom: 12px; }
.sn-banner.danger { background: #fee2e2; color: #991b1b; }

.sn-caveats ul { margin: 8px 0 0; padding-left: 18px; color: #4b5563; font-size: 13px; }
.sn-caveats li { margin-bottom: 6px; }

.sn-loading { display: grid; gap: 10px; }
.sn-skeleton { height: 56px; border-radius: 10px; background: linear-gradient(90deg, #f3f4f6, #e5e7eb, #f3f4f6); }
</style>
