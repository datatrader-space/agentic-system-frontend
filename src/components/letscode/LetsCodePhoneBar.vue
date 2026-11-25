<!--
  LetsCodePhoneBar: the Let's Code editor's ONE header row on a phone (640 px and less; ADM-1330, live at 375 px
  2026-11-25). Above the chat the editor drew about 270 px of bars: the app's bar, the editor's two header rows, the
  sidebar's tab row and the editor's tab strip. Here they are one 48 px row, as in Claude Code's phone app:

    [ ‹ ] project · status          [pill] [Files] [Chats ▾] [⋯]

  Nothing is removed, only moved. Back goes to the projects (and the app's own bar). The background-tasks pill is the
  chat's own (UnifiedAgentChat teleports it into `#lc-phone-pill`). Files opens the files and the editor as their own
  pane. Chats switches chats in one menu: the open chats, a new one, and the project's other chats. More (⋯) holds what
  the editor's bar holds on a wide screen (branch, Commands, Variables, pull request tasks, Deploy, GitHub, light or
  dark, the simple phone view), the bottom panel's tabs, Source control and Search, and the app's own menu.

  The menus are the app's menu component (Reka UI's DropdownMenu, as the Workflow Builder's): arrow keys, Enter, Esc,
  type-ahead, focus returned to the button, menuitem roles; every item is 44 px tall. Hidden above 640 px.
-->
<template>
  <header class="lpb" data-test="lc-phonebar">
    <button type="button" class="lpb-btn" :aria-label="t('phone.projects')" :title="t('phone.projects')" data-test="lpb-back"
            @click="emit('back')">
      <Icon icon="lucide:chevron-left" aria-hidden="true" />
    </button>
    <div class="lpb-id">
      <span class="lpb-name" :title="project.name" translate="no">{{ project.name }}</span>
      <!-- While the project opens: what it waits for (ADM-1326), here instead of over the chat. -->
      <span v-if="openLabel" class="lpb-status" role="status" aria-live="polite" data-test="lpb-opening">
        <Icon icon="lucide:loader-2" class="lpb-spin" aria-hidden="true" />
        <span class="lpb-status-t">{{ openLabel }}</span>
        <!-- The seconds tick: shown, not read out every second. -->
        <span class="lpb-secs" aria-hidden="true">{{ openSeconds }}&nbsp;s</span>
      </span>
      <span v-else class="lpb-status" :class="`t-${tone}`" data-test="lpb-status">
        <span class="lpb-dot" aria-hidden="true"></span><span class="lpb-status-t">{{ statusLabel }}</span>
      </span>
    </div>
    <!-- The chat's background-tasks pill lands here (a Teleport in UnifiedAgentChat). -->
    <span id="lc-phone-pill" class="lpb-pill"></span>
    <button type="button" class="lpb-btn" :class="{ on: view === 'files' }" :aria-pressed="view === 'files' ? 'true' : 'false'"
            :aria-label="t('phone.files')" :title="t('phone.files')" data-test="lpb-files" @click="emit('files')">
      <Icon icon="lucide:folder-tree" aria-hidden="true" />
    </button>

    <!-- Chats: the open ones, a new one, the project's others. -->
    <DropdownMenuRoot v-model:open="chatsOpen">
      <DropdownMenuTrigger class="lpb-btn" :aria-label="needYou ? t('phone.chatsNeedYou') : t('phone.chats')" :title="t('phone.chats')"
                           data-test="lpb-chats">
        <Icon icon="lucide:messages-square" aria-hidden="true" />
        <span v-if="needYou" class="lpb-badge" aria-hidden="true"></span>
      </DropdownMenuTrigger>
      <DropdownMenuPortal>
        <DropdownMenuContent class="lpb-menu" :data-theme="theme" align="end" :side-offset="4" :collision-padding="8">
          <DropdownMenuLabel class="lpb-menu-label">{{ t('phone.openChats') }}</DropdownMenuLabel>
          <DropdownMenuRadioGroup :model-value="activeKey">
            <DropdownMenuRadioItem v-for="tab in openChats" :key="tab.key" :value="tab.key" class="lpb-item"
                                   data-test="lpb-chat" @select="emit('chat', tab)">
              <DropdownMenuItemIndicator class="lpb-check"><Icon icon="lucide:check" aria-hidden="true" /></DropdownMenuItemIndicator>
              <span class="lpb-item-t">{{ chatTitle(tab) }}</span>
              <span v-if="chatState(tab)" class="lpb-item-meta">{{ chatState(tab) }}</span>
            </DropdownMenuRadioItem>
          </DropdownMenuRadioGroup>
          <DropdownMenuItem class="lpb-item" data-test="lpb-new-chat" @select="emit('new-chat')">
            <Icon icon="lucide:plus" class="lpb-item-ic" aria-hidden="true" /><span class="lpb-item-t">{{ t('phone.newChat') }}</span>
          </DropdownMenuItem>
          <DropdownMenuSeparator class="lpb-sep" />
          <DropdownMenuLabel class="lpb-menu-label">{{ t('phone.recentChats') }}</DropdownMenuLabel>
          <p v-if="historyLoading" class="lpb-menu-note" role="status">{{ t('phone.loadingChats') }}</p>
          <p v-else-if="!otherChats.length" class="lpb-menu-note">{{ t('phone.noRecentChats') }}</p>
          <DropdownMenuItem v-for="c in otherChats" :key="c.id" class="lpb-item" data-test="lpb-recent"
                            @select="emit('open-conversation', c)">
            <Icon icon="lucide:message-square" class="lpb-item-ic" aria-hidden="true" /><span class="lpb-item-t">{{ c.title }}</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenuPortal>
    </DropdownMenuRoot>

    <!-- More: what the wide editor's bar holds, the bottom panel's tabs, and the app's menu. -->
    <DropdownMenuRoot v-model:open="moreOpen">
      <DropdownMenuTrigger class="lpb-btn" :aria-label="moreLabel" :title="t('phone.more')" data-test="lpb-more"
                           :data-focus-fallback="FOCUS_FALLBACK">
        <Icon icon="lucide:ellipsis-vertical" aria-hidden="true" />
        <!-- Something in the menu needs a look: a pull request task waits, or a deploy runs or failed (its words are
             in the button's name). -->
        <span v-if="moreDot" class="lpb-badge" :class="`t-${moreDot}`" aria-hidden="true" data-test="lpb-more-dot"></span>
      </DropdownMenuTrigger>
      <DropdownMenuPortal>
        <DropdownMenuContent class="lpb-menu" :data-theme="theme" align="end" :side-offset="4" :collision-padding="8">
          <DropdownMenuGroup>
            <DropdownMenuLabel class="lpb-menu-label">{{ t('phone.project') }}</DropdownMenuLabel>
            <DropdownMenuSub v-if="!project.is_new">
              <DropdownMenuSubTrigger class="lpb-item" :disabled="!ready || switchingBranch" data-test="lpb-branch">
                <Icon icon="lucide:git-branch" class="lpb-item-ic" aria-hidden="true" />
                <span class="lpb-item-t">{{ t('phone.branch', { branch: project.branch || 'main' }) }}</span>
                <Icon icon="lucide:chevron-right" class="lpb-item-end" aria-hidden="true" />
              </DropdownMenuSubTrigger>
              <DropdownMenuPortal>
                <DropdownMenuSubContent class="lpb-menu" :data-theme="theme" :side-offset="2" :collision-padding="8">
                  <DropdownMenuRadioGroup :model-value="project.branch">
                    <DropdownMenuRadioItem v-for="b in branchList" :key="b" :value="b" class="lpb-item" translate="no"
                                           @select="emit('branch', b)">
                      <DropdownMenuItemIndicator class="lpb-check"><Icon icon="lucide:check" aria-hidden="true" /></DropdownMenuItemIndicator>
                      <span class="lpb-item-t">{{ b }}</span>
                    </DropdownMenuRadioItem>
                  </DropdownMenuRadioGroup>
                </DropdownMenuSubContent>
              </DropdownMenuPortal>
            </DropdownMenuSub>
            <DropdownMenuItem v-else class="lpb-item" disabled>
              <Icon icon="lucide:git-branch" class="lpb-item-ic" aria-hidden="true" />
              <span class="lpb-item-t">{{ t('phone.branchesNeedGithub') }}</span>
            </DropdownMenuItem>
            <DropdownMenuItem class="lpb-item" :disabled="!ready" data-test="lpb-commands" @select="emit('commands')">
              <Icon icon="lucide:square-terminal" class="lpb-item-ic" aria-hidden="true" /><span class="lpb-item-t">{{ t('phone.commands') }}</span>
            </DropdownMenuItem>
            <DropdownMenuItem class="lpb-item" data-test="lpb-variables" @select="emit('variables')">
              <Icon icon="lucide:key-round" class="lpb-item-ic" aria-hidden="true" /><span class="lpb-item-t">{{ t('phone.variables') }}</span>
            </DropdownMenuItem>
            <DropdownMenuItem class="lpb-item" data-test="lpb-tasks" @select="emit('tasks')">
              <Icon icon="lucide:git-pull-request" class="lpb-item-ic" aria-hidden="true" /><span class="lpb-item-t">{{ t('phone.prTasks') }}</span>
              <span v-if="tasksWaiting" class="lpb-state t-wait" data-test="lpb-tasks-waiting">{{ t('phone.prWaiting', { n: tasksWaiting }) }}</span>
            </DropdownMenuItem>
            <DropdownMenuItem class="lpb-item" :disabled="!ready" data-test="lpb-deploy" @select="emit('deploy')">
              <Icon icon="lucide:triangle" class="lpb-item-ic" aria-hidden="true" /><span class="lpb-item-t">{{ t('phone.deploy') }}</span>
              <span v-if="deploy && deploy.label" class="lpb-state" :class="`t-${deploy.tone}`" data-test="lpb-deploy-state">
                <span class="lpb-state-dot" aria-hidden="true"></span>{{ deploy.label }}
              </span>
            </DropdownMenuItem>
            <DropdownMenuItem v-if="githubUrl" as-child class="lpb-item">
              <a :href="githubUrl" target="_blank" rel="noopener noreferrer" data-test="lpb-github">
                <Icon icon="lucide:github" class="lpb-item-ic" aria-hidden="true" /><span class="lpb-item-t">{{ t('ide.openOnGithub') }}</span>
                <Icon icon="lucide:external-link" class="lpb-item-end" aria-hidden="true" />
              </a>
            </DropdownMenuItem>
          </DropdownMenuGroup>
          <DropdownMenuSeparator class="lpb-sep" />
          <DropdownMenuGroup v-if="ready">
            <DropdownMenuLabel class="lpb-menu-label">{{ t('phone.views') }}</DropdownMenuLabel>
            <DropdownMenuItem class="lpb-item" data-test="lpb-scm" @select="emit('side', 'scm')">
              <Icon icon="lucide:git-compare" class="lpb-item-ic" aria-hidden="true" /><span class="lpb-item-t">{{ t('phone.sourceControl') }}</span>
            </DropdownMenuItem>
            <DropdownMenuItem class="lpb-item" data-test="lpb-search" @select="emit('side', 'search')">
              <Icon icon="lucide:search" class="lpb-item-ic" aria-hidden="true" /><span class="lpb-item-t">{{ t('phone.search') }}</span>
            </DropdownMenuItem>
          </DropdownMenuGroup>
          <DropdownMenuSeparator v-if="ready" class="lpb-sep" />
          <DropdownMenuGroup v-if="panelTabs.length">
            <DropdownMenuLabel class="lpb-menu-label">{{ t('phone.panels') }}</DropdownMenuLabel>
            <DropdownMenuItem v-for="p in panelTabs" :key="p.id" class="lpb-item" data-test="lpb-panel" @select="emit('panel', p.id)">
              <Icon :icon="p.icon" class="lpb-item-ic" aria-hidden="true" /><span class="lpb-item-t">{{ p.label }}</span>
            </DropdownMenuItem>
          </DropdownMenuGroup>
          <DropdownMenuSeparator v-if="panelTabs.length" class="lpb-sep" />
          <DropdownMenuGroup>
            <DropdownMenuLabel class="lpb-menu-label">{{ t('phone.display') }}</DropdownMenuLabel>
            <DropdownMenuItem class="lpb-item" data-test="lpb-theme" @select="emit('theme')">
              <Icon :icon="dark ? 'lucide:sun' : 'lucide:moon'" class="lpb-item-ic" aria-hidden="true" />
              <span class="lpb-item-t">{{ dark ? t('phone.toLight') : t('phone.toDark') }}</span>
            </DropdownMenuItem>
            <DropdownMenuItem class="lpb-item" data-test="lpb-phone-view" @select="emit('phone-view')">
              <Icon icon="lucide:monitor-smartphone" class="lpb-item-ic" aria-hidden="true" /><span class="lpb-item-t">{{ t('phone.phoneView') }}</span>
            </DropdownMenuItem>
            <DropdownMenuItem class="lpb-item" data-test="lpb-app-menu" @select="emit('app-menu')">
              <Icon icon="lucide:menu" class="lpb-item-ic" aria-hidden="true" /><span class="lpb-item-t">{{ t('phone.appMenu') }}</span>
            </DropdownMenuItem>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenuPortal>
    </DropdownMenuRoot>
  </header>
</template>

<script setup>
import { ref, computed, inject, watch } from 'vue'
import { Icon } from '@iconify/vue'
import {
  DropdownMenuRoot, DropdownMenuTrigger, DropdownMenuPortal, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuGroup, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuItemIndicator,
  DropdownMenuSub, DropdownMenuSubTrigger, DropdownMenuSubContent,
} from 'reka-ui'
import { CODING_CHAT_TABS } from '@/stores/useCodingChatTabs'
import { phaseLabel, phaseTone } from './projectStatus'
import { t, tn } from './messages'
import { FOCUS_FALLBACK } from './returnFocus'

const props = defineProps({
  project: { type: Object, required: true },
  ready: { type: Boolean, default: false },
  // While the project opens (ADM-1326): what it waits for, and for how long.
  openLabel: { type: String, default: '' },
  openSeconds: { type: Number, default: 0 },
  // The pane on screen: 'chat' | 'files' | 'panel'.
  view: { type: String, default: 'chat' },
  branches: { type: Array, default: () => [] },
  switchingBranch: { type: Boolean, default: false },
  // The bottom panel's tabs ({ id, label, icon }), each opened as its own pane.
  panelTabs: { type: Array, default: () => [] },
  // The project's other chats ({ id, title }), read when the Chats menu opens.
  history: { type: Array, default: () => [] },
  historyLoading: { type: Boolean, default: false },
  githubUrl: { type: String, default: '' },
  dark: { type: Boolean, default: false },
  // The editor's own light or dark: the menus are drawn outside it (ADM-1205).
  theme: { type: String, default: 'light' },
  // What the wide bar's buttons say, read from them (ProjectTasks' waiting count, DeployButton's `status`:
  // { label, tone: 'run' | 'ok' | 'bad' | 'off', active }), shown on More's items and its button.
  tasksWaiting: { type: Number, default: 0 },
  deploy: { type: Object, default: null },
})
const emit = defineEmits(['back', 'files', 'chat', 'new-chat', 'open-conversation', 'load-history', 'branch', 'commands',
  'variables', 'tasks', 'deploy', 'side', 'panel', 'theme', 'phone-view', 'app-menu'])

const chatsOpen = ref(false)
const moreOpen = ref(false)
watch(chatsOpen, (open) => { if (open) emit('load-history') })

const statusLabel = computed(() => phaseLabel(props.project))
const tone = computed(() => phaseTone(props.project))

// The chats come from the page's chat-tab controller, the same list the wide editor's tab strip draws.
const tabs = inject(CODING_CHAT_TABS, null)
const openChats = computed(() => (tabs ? tabs.tabs : []))
const activeKey = computed(() => openChats.value.find((x) => tabs.isActive(x))?.key || '')
const chatTitle = (tab) => tabs.title(tab)
const chatState = (tab) => tabs.stateLabel(tab)
const needYou = computed(() => openChats.value.some((x) => tabs.state(x) === 'needs_input'))
const otherChats = computed(() => {
  const open = new Set(openChats.value.map((x) => String(x.id || '')))
  return props.history.filter((c) => !open.has(String(c.id)))
})
// The dot on More: a failed deploy first, then a task waiting for the person, then a deploy running.
const deployFailed = computed(() => !!props.deploy && !props.deploy.active && props.deploy.tone === 'bad')
const deployRunning = computed(() => !!props.deploy && props.deploy.active)
const moreDot = computed(() => {
  if (deployFailed.value) return 'bad'
  if (props.tasksWaiting) return 'wait'
  if (deployRunning.value) return 'run'
  return ''
})
const moreLabel = computed(() => {
  const parts = [t('phone.more')]
  if (props.tasksWaiting) parts.push(tn('phone.moreWaiting', props.tasksWaiting))
  if (deployFailed.value || deployRunning.value) parts.push(t('phone.moreDeploy', { state: props.deploy.label }))
  return parts.join('. ')
})
// The current branch first, then the others.
const branchList = computed(() => {
  const cur = props.project.branch
  return [...(cur ? [cur] : []), ...props.branches.filter((b) => b !== cur)]
})
</script>

<style scoped>
/* Hidden above 640 px: the wide editor keeps its own bar. */
.lpb { display: none; }
@media (max-width: 640px) {
  .lpb {
    flex: 0 0 auto; display: flex; align-items: center; gap: 2px; box-sizing: border-box;
    height: calc(48px + env(safe-area-inset-top, 0px)); padding: env(safe-area-inset-top, 0px) 4px 0;
    border-bottom: 1px solid var(--vm-line); background: var(--vm-surface); color: var(--vm-ink);
  }
}
.lpb-btn {
  position: relative; flex: 0 0 auto; display: grid; place-items: center; width: 44px; height: 44px; padding: 0;
  border: none; border-radius: 10px; background: transparent; color: var(--vm-ink-soft); cursor: pointer;
  touch-action: manipulation; -webkit-tap-highlight-color: transparent; transition: background-color .15s, color .15s;
}
.lpb-btn:hover, .lpb-btn[data-state="open"] { background: var(--vm-surface-soft); color: var(--vm-ink); }
.lpb-btn.on { background: var(--vm-violet-soft); color: var(--vm-violet); }
.lpb-btn:focus-visible { outline: 2px solid var(--vm-focus, var(--vm-violet)); outline-offset: -2px; }
.lpb-btn :deep(svg) { width: 20px; height: 20px; }
.lpb-badge { position: absolute; top: 9px; right: 9px; width: 8px; height: 8px; border-radius: 50%; background: var(--vm-amber); box-shadow: 0 0 0 2px var(--vm-surface); }
.lpb-badge.t-bad { background: var(--vm-danger); }
.lpb-badge.t-run { background: var(--vm-violet); }

.lpb-id { flex: 1 1 auto; min-width: 0; display: flex; flex-direction: column; justify-content: center; gap: 1px; padding: 0 4px; }
.lpb-name { min-width: 0; font: 700 14.5px/1.25 var(--vm-font-display, var(--vm-font-sans)); color: var(--vm-ink); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.lpb-status {
  --tone: var(--vm-ink-faint); min-width: 0; display: flex; align-items: center; gap: 5px;
  font: 600 11.5px/1.3 var(--vm-font-sans); color: var(--vm-ink-soft); white-space: nowrap;
}
.lpb-status.t-ok { --tone: var(--vm-green); }
.lpb-status.t-run { --tone: var(--vm-amber); }
.lpb-status.t-err { --tone: var(--vm-danger); }
.lpb-status-t { min-width: 0; overflow: hidden; text-overflow: ellipsis; }
.lpb-dot { width: 7px; height: 7px; flex: 0 0 auto; border-radius: 50%; background: var(--tone); }
.lpb-secs { flex: 0 0 auto; font-variant-numeric: tabular-nums; }
.lpb-status :deep(svg) { width: 12px; height: 12px; flex: 0 0 auto; color: var(--vm-violet); }
.lpb-spin { animation: lpb-spin 1s linear infinite; }
@keyframes lpb-spin { to { transform: rotate(360deg); } }

.lpb-pill { flex: 0 1 auto; min-width: 0; display: flex; }
/* The pill here is its icon and its count; its words stay in it for a screen reader (visually hidden) and its title. */
.lpb-pill :deep(.uac-bg-pill) { min-height: 44px; min-width: 44px; justify-content: center; padding: 0 12px; }
.lpb-pill :deep(.uac-bg-pill > span) {
  position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0 0 0 0);
  white-space: nowrap; border: 0;
}
.lpb-pill :deep(.uac-bg-pill)::after { content: attr(data-count); content: attr(data-count) / ""; font-variant-numeric: tabular-nums; }

@media (prefers-reduced-motion: reduce) {
  .lpb-spin { animation: none; }
}
</style>

<!-- NOT scoped: the menus are drawn in a portal on the body, where this component's scoped rules do not reach them.
     Every class here starts with `lpb-`, so nothing leaks. -->
<style>
.lpb-menu {
  z-index: 70; min-width: 232px; max-width: calc(100vw - 16px); max-height: min(var(--reka-dropdown-menu-content-available-height, 70dvh), 560px); overflow-y: auto;
  overscroll-behavior: contain; padding: 6px; border: 1px solid var(--vm-line-2); border-radius: 12px;
  background: var(--vm-surface); color: var(--vm-ink); box-shadow: var(--vm-shadow-l, 0 14px 34px rgba(0, 0, 0, .18));
  font: 14px var(--vm-font-sans);
}
.lpb-menu-label { padding: 8px 10px 4px; font: 600 12px var(--vm-font-sans); color: var(--vm-ink-soft); }
.lpb-menu-note { margin: 0; padding: 8px 10px 10px; font-size: 13px; color: var(--vm-ink-soft); }
.lpb-sep { height: 1px; margin: 6px 4px; background: var(--vm-line); }
.lpb-item {
  position: relative; display: flex; align-items: center; gap: 10px; min-height: 44px; padding: 0 10px 0 36px;
  border-radius: 8px; color: var(--vm-ink); text-decoration: none; cursor: pointer; outline: none; user-select: none;
  touch-action: manipulation; -webkit-tap-highlight-color: transparent;
}
.lpb-item[data-highlighted] { background: var(--vm-violet-soft); }
.lpb-item[data-disabled] { color: var(--vm-ink-faint); cursor: not-allowed; }
.lpb-item:focus-visible { outline: 2px solid var(--vm-focus, var(--vm-violet)); outline-offset: -2px; }
.lpb-item-ic, .lpb-check { position: absolute; left: 10px; width: 17px; height: 17px; color: var(--vm-ink-soft); }
.lpb-check { display: grid; place-items: center; color: var(--vm-violet); }
.lpb-check svg { width: 17px; height: 17px; }
.lpb-item-t { flex: 1 1 auto; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.lpb-item-meta { flex: 0 0 auto; font-size: 12px; color: var(--vm-ink-soft); }
.lpb-item-end { flex: 0 0 auto; width: 15px; height: 15px; color: var(--vm-ink-faint); }
/* A state beside an item: its word, and a tint that repeats it (never the colour alone). */
.lpb-state {
  --tone: var(--vm-ink-faint); flex: 0 0 auto; display: inline-flex; align-items: center; gap: 5px; padding: 2px 8px;
  border-radius: 999px; font: 600 12px/1.4 var(--vm-font-sans); white-space: nowrap;
  color: color-mix(in srgb, var(--tone) 62%, var(--vm-ink)); background: color-mix(in srgb, var(--tone) 13%, transparent);
}
.lpb-state.t-ok { --tone: var(--vm-green); }
.lpb-state.t-bad { --tone: var(--vm-danger); }
.lpb-state.t-run { --tone: var(--vm-violet); }
.lpb-state.t-wait { --tone: var(--vm-amber); }
.lpb-state-dot { width: 7px; height: 7px; border-radius: 50%; background: var(--tone); }
</style>
