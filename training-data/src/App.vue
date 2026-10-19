<script setup>
import { watch, ref, computed, inject, onMounted, onUnmounted, provide } from 'vue';
import { signOut } from './api/session.js';
import { trashProject, getProject, listProjects, createProject, createFolder, moveProject, renameProject, saveDataUse, listKinds, dataUseAnswers, TYPE_KIND, toCard } from './api/training.js';
import ConnectApp from './components/ConnectApp.vue';
import { Aperture, FolderOpen, Box, Layers, ArrowUpRight, Plus, Search, LayoutGrid, List, Menu, X, ArrowLeft, Upload, ScanLine, Images, Tags, ChartNoAxesCombined, GitBranch, LockKeyhole, ArrowRight, Check, Sparkles, Network, Server, Orbit, Bell, Settings, ChevronLeft, ChevronRight, CircleArrowUp, KeyRound, Users , Trash2 } from 'lucide-vue-next';
import SidebarUtilities from './components/SidebarUtilities.vue';
import BackendConnection from './components/BackendConnection.vue';
import UiButton from './components/UiButton.vue';
import UiDialog from './components/UiDialog.vue';
import UiBadge from './components/UiBadge.vue';
import ProjectCreate from './components/ProjectCreate.vue';
import ProjectUpload from './components/ProjectUpload.vue';
import WorkspaceExtras from './components/WorkspaceExtras.vue';
import ProjectStudio from './components/ProjectStudio.vue';
import WorkspaceModels from './components/WorkspaceModels.vue';
import ProjectCardMenu from './components/ProjectCardMenu.vue';
import { getPreview, addPreviewBatch } from './previewState.js';
import RoomArt from './components/RoomArt.vue';
import TrainingNotifications from './components/TrainingNotifications.vue';
import TeamMembers from './components/TeamMembers.vue';
import TrashPage from './components/TrashPage.vue';
import ProjectSettings from './components/ProjectSettings.vue';
import WorkspaceSwitcher from './components/WorkspaceSwitcher.vue';
import JoinByLink from './components/JoinByLink.vue';
import { joinToken } from './api/members.js';
import { selectWorkspace } from './api/workspaces.js';
import { listNotifications, readDeepLink, findProject } from './api/notifications.js';
const sections = [{id:'agent',name:'Agent',icon:Sparkles},{id:'assets',name:'Asset Library',icon:Images},{id:'workflows',name:'Workflows',icon:GitBranch},{id:'events',name:'Vision events',icon:ChartNoAxesCombined},{id:'discover',name:'Universe',icon:Orbit},{id:'notifications',name:'Notifications',icon:Bell},{id:'members',name:'Team Members',icon:Users},{id:'trash',name:'Trash',icon:Trash2},{ id: 'projects', name: 'Projects', icon: FolderOpen }, { id: 'models', name: 'Models', icon: Network }, {id:'deployments',name:'Deployments',icon:Server}, { id: 'components', name: 'UI foundation', icon: Layers }];
const projectSections = [{id:'settings',name:'Settings',icon:Settings},{id:'train',name:'Train',icon:Box},{id:'models',name:'Models',icon:Box},{id:'nas',name:'NAS',icon:Layers},{id:'test',name:'Test',icon:ScanLine},{id:'deploy',name:'Deployments',icon:Upload},{id:'active',name:'Active learning',icon:GitBranch},{ id: 'upload', name: 'Upload data', icon: Upload }, { id: 'connect', name: 'Connect app', icon: KeyRound }, { id: 'annotate', name: 'Annotate', icon: ScanLine }, { id: 'dataset', name: 'Dataset', icon: Images }, { id: 'versions', name: 'Versions', icon: GitBranch }, { id: 'analytics', name: 'Analytics', icon: ChartNoAxesCombined }, { id: 'classes', name: 'Classes & tags', icon: Tags }];
sections.sort((a,b)=>['agent','projects','assets','workflows','models','deployments','events','discover','notifications','components'].indexOf(a.id)-['agent','projects','assets','workflows','models','deployments','events','discover','notifications','components'].indexOf(b.id));
projectSections.sort((a,b)=>['upload','connect','annotate','dataset','versions','analytics','classes','train','models','nas','test','deploy','active','settings'].indexOf(a.id)-['upload','connect','annotate','dataset','versions','analytics','classes','train','models','nas','test','deploy','active','settings'].indexOf(b.id));
// Who is signed in to AADML and the workspace selected there (main.js loads both before the page shows).
const session = inject('session');
const signingOut = ref(false);
async function leave() { if (signingOut.value) return; signingOut.value = true; try { await signOut(); } catch (error) { sidebarDialog.value = ''; notice.value = `Sign out did not finish: ${error.message}`; signingOut.value = false; } }
const folders=ref([]);const folderRows=ref([]);const folderName=ref('');const folderDialog=ref(false);const folderFilter=ref('All folders');const typeFilter=ref('All types');
// The projects and folders of the workspace selected in AADML, from the backend.
const loadingProjects=ref(true);
// Notifications: the unread count beside the sidebar item, and a link "#project/<ref>/<page>[/<assignment>]" (an e-mail's button)
// opening that project's page, once the projects are loaded.
// Workspace settings: Team Members is a page of its own; the others are not built yet.
// Project settings: a new name shows everywhere; a deleted project leaves the list.
async function projectRenamed(name){ const ref=selected.value?.ref; await loadProjects(); selected.value=projects.value.find(p=>p.ref===ref)||selected.value; }
// A project moved to the Trash leaves the list; its Owner restores it from Workspace Settings → Trash within 30 days.
async function projectTrashed(name){ selected.value=null; navigate('projects'); await loadProjects(); notice.value=`“${name}” is in the Trash. Restore it from Workspace Settings → Trash within 30 days.`; }
async function trash(project){ try { await trashProject(project.ref); await projectTrashed(project.name); } catch (error) { notice.value=error.message; } }
function openSetting(name){ if(name==='Team Members'){ selected.value=null; navigate('members'); } else if(name==='Trash'){ selected.value=null; navigate('trash'); } else sidebarDialog.value=name; }
// An invite link (`?join=…`): the person sees what it gives and joins; the address loses the token at once.
const joining=ref(joinToken());
function leaveJoin(){ joining.value=''; const url=new URL(location.href); url.searchParams.delete('join'); history.replaceState(null,'',url.pathname+url.search+url.hash); }
function joined(answer){ leaveJoin(); if(answer.workspace) selectWorkspace(answer.workspace); location.assign(answer.landing||'/dashboard/training-data/#projects'); location.reload(); }
const unreadCount=ref(0); const deepLink=ref(null); const openAssignment=ref(null); const openUpload=ref(null); let unreadTimer;
async function loadUnread(){ try { unreadCount.value=(await listNotifications()).unread; } catch { /* the count waits for the next try */ } }
// A link to a project of another workspace of this person (an accepted invitation, a notification): the page selects
// that workspace, as the AADML switcher does, and opens the link again in it. Nobody reaches a project without a role.
async function openElsewhere(d){ try { const body=await getProject(d.ref); const once=`tmd.switched.${d.ref}`; let switched=''; try { switched=sessionStorage.getItem(once)||''; } catch { /* no storage: switch once anyway */ }
  if(body?.workspace?.id && String(body.workspace.id)!==String(session.workspace?.id) && switched!==String(body.workspace.id)){ try { sessionStorage.setItem(once,String(body.workspace.id)); } catch { /* ignore */ } selectWorkspace(body.workspace); location.hash=`project/${d.ref}/${d.page}${d.assignment?`/${d.assignment}`:''}`; location.reload(); return; } } catch { /* no role in it: said below */ } notice.value='That project is not one you have a role in.'; navigate('projects'); }
function applyDeep(){ const d=deepLink.value; if(!d||loadingProjects.value) return; deepLink.value=null; const project=findProject(projects.value,d.ref); if(!project){ openElsewhere(d); return; } selected.value=project; savedBatch.value=null; openAssignment.value=d.assignment; const target=projectSections.some(s=>s.id===d.page)?d.page:'annotate'; page.value=target; drawer.value=false; history.replaceState(null,'',`#${target}`); }
async function loadProjects(){
  try { const body=await listProjects(); projects.value=body.projects.map(toCard); folderRows.value=body.folders; folders.value=body.folders.map(f=>f.name); }
  catch (error) { notice.value=`Projects could not be loaded: ${error.message}`; }
  finally { loadingProjects.value=false; applyDeep(); }
  if (!selected.value && projectSections.some(s=>s.id===page.value) && page.value!=='models') selected.value=projects.value[0]||null;
}
async function addFolder(){const name=folderName.value.trim(); if(!name) return; try { await createFolder(name); folderDialog.value=false; folderName.value=''; await loadProjects(); } catch (error) { notice.value=error.message; folderDialog.value=false; }}
async function moveTo(project, name){const folder=folderRows.value.find(f=>f.name===name); try { await moveProject(project.ref, folder?folder.id:null); project.folder=folder?.name; project.folderId=folder?.id??null; } catch (error) { notice.value=error.message; await loadProjects(); }}
async function rename(project, name){try { const row=await renameProject(project.ref, name); project.name=row.name; } catch (error) { notice.value=error.message; }}
// New project: create it, then save its data policy as the project's data-use answers. Returns the new card.
async function submitProject(form){
  const kind=TYPE_KIND[form.task]; const task=kinds.value.find(k=>k.key===kind)?.task||'';
  const row=await createProject({name:form.name, description:form.purpose, task});
  await saveDataUse(row.ref, dataUseAnswers(form));
  const card=toCard({...row, visibility: dataUseAnswers(form).viewers==='me'?'private':'shared'}, projects.value.length);
  projects.value.unshift(card);
  return card;
}
function finishCreate(where, card){ dialog.value=false; selected.value=where==='projects'?null:card; navigate(where); }
const kinds=ref([]);
provide('kinds', kinds);
const mobile = ref(false);const navCollapsed=ref(false);const sidebarDialog=ref('');
let media;
function syncMobile() { mobile.value = media.matches; }
function onKey(event) { if (event.key === 'Escape') drawer.value = false; }
function skipToMain() { (document.getElementById('main') || document.getElementById('create-heading'))?.focus(); }
const page = ref('projects'); const drawer = ref(false); const selected = ref(null);
const search = ref(''); const sort = ref('recent'); const view = ref('grid'); const dialog = ref(false);
const notice = ref(''); const projectFlyout = ref(false); const savedBatch = ref(null);
// After an upload: the real photo counts again, then the annotation board.
// After an upload: the real photo counts again, then Annotate on what was just uploaded: the assignment it was given
// as (an instant assignment), else the batch, on "Choose how to label this batch".
async function receiveBatch(outcome) { savedBatch.value = outcome; const ref = selected.value?.ref; await loadProjects(); if (ref) selected.value = projects.value.find(p => p.ref === ref) || selected.value; openAssignment.value = outcome?.assignment?.number || null; openUpload.value = outcome?.assignment ? null : (outcome?.batch?.id || null); navigate('annotate'); }
const projects = ref([]);
const filtered = computed(() => { const result = projects.value.filter(p => (typeFilter.value==='All types'||p.type===typeFilter.value)&&(folderFilter.value==='All folders'||p.folder===folderFilter.value)&&`${p.name} ${p.type}`.toLowerCase().includes(search.value.toLowerCase())); return sort.value === 'name' ? result.toSorted((a,b) => a.name.localeCompare(b.name)) : result; });
const title = computed(() => [...sections, ...projectSections].find(s => s.id === page.value)?.name || 'Projects');
function readHash() { const deep = readDeepLink(location.hash); if (deep) { deepLink.value = deep; applyDeep(); return; } const id = location.hash.slice(1); if (projectSections.some(s=>s.id===id) && !selected.value && id!=='models') selected.value=projects.value[0]; page.value = [...sections, ...projectSections].some(s => s.id === id) ? id : 'projects'; drawer.value = false; }
function navigate(id) { location.hash = id; page.value = id; drawer.value = false; }
// A message belongs to the page it was shown on: it is cleared once the person is on another page.
let noticePage = '';
watch(notice, text => { if (text) noticePage = page.value; });
watch(page, now => { if (notice.value && now !== noticePage) notice.value = ''; });
function openProject(project) { selected.value = project; savedBatch.value = null; projectFlyout.value = false; navigate('upload'); }
onMounted(() => { media = window.matchMedia('(max-width: 700px)'); syncMobile(); media.addEventListener('change', syncMobile); window.addEventListener('keydown', onKey); readHash(); window.addEventListener('hashchange', readHash); loadProjects(); loadUnread(); unreadTimer=setInterval(loadUnread,60000); listKinds().then(body => { kinds.value = body.kinds; }).catch(() => {}); });
onUnmounted(() => { clearInterval(unreadTimer); window.removeEventListener('hashchange', readHash); window.removeEventListener('keydown', onKey); media?.removeEventListener('change', syncMobile); });
</script>
<template>
  <a class="skip-link" href="#main" @click.prevent="skipToMain">Skip to content</a>
  <UiDialog :open="!!sidebarDialog" :title="sidebarDialog" @close="sidebarDialog=''"><p class="dialog-description">{{sidebarDialog==='Workspace'?`Current workspace: ${session.workspace.name}.`:'This section is part of the frontend preview.'}}</p><div class="dialog-info"><UiBadge tone="purple">Coming soon</UiBadge></div><div class="dialog-actions"><UiButton @click="sidebarDialog=''">Close</UiButton><UiButton v-if="sidebarDialog==='Account'" variant="primary" :disabled="signingOut" @click="leave">{{ signingOut ? 'Signing out…' : 'Sign out' }}</UiButton></div></UiDialog>
  <JoinByLink v-if="joining" :token="joining" @close="leaveJoin" @joined="joined" />
  <ProjectCreate v-if="dialog" :submit="submitProject" @cancel="dialog = false" @done="finishCreate" />
  <div v-else :class="['workspace', {'with-project': selected,'nav-collapsed':navCollapsed}]">
    <button v-if="drawer" class="nav-backdrop" aria-label="Close navigation" @click="drawer = false"></button>
    <aside @mouseleave="projectFlyout = false" :inert="mobile && !drawer" :class="['sidebar', { 'sidebar--open': drawer }]">
      <WorkspaceSwitcher :session="session" />
      <nav aria-label="Workspace"><a v-for="item in sections.filter(s=>!['components','members','trash'].includes(s.id))" :key="item.id" :href="`#${item.id}`" :title="item.name" @mouseenter="projectFlyout = item.id === 'projects'" @focus="projectFlyout = item.id === 'projects'" :class="['nav-link', { active: selected ? item.id==='projects' : page === item.id }]" :aria-current="page === item.id ? 'page' : undefined" @click="selected = null; drawer = false"><component :is="item.icon" :size="15" /><span class="nav-text">{{ item.name }}</span><span v-if="item.id==='notifications'&&unreadCount" class="nav-count" :aria-label="`${unreadCount} unread`">{{ unreadCount }}</span></a></nav>
      <div v-if="projectFlyout && !mobile" class="project-flyout" @mouseenter="projectFlyout = true"><div class="flyout-workspace">{{ session.workspace.name }}<small>Local frontend preview</small></div><h3>Projects</h3><UiButton @click="dialog = true; projectFlyout = false"><Plus :size="16" /> New project</UiButton><div class="flyout-recent">RECENT <a href="#projects" @click="selected = null; projectFlyout = false">View all</a></div><button v-for="project in projects.slice(0,5)" :key="project.id" @click="openProject(project)"><strong>{{ project.name }}</strong><small>{{ project.type }} / {{ project.date }}</small></button></div>

      <button class="sidebar-collapse" :aria-label="navCollapsed?'Expand navigation':'Collapse navigation'" @click="navCollapsed=!navCollapsed;projectFlyout=false"><ChevronRight v-if="navCollapsed" :size="14"/><ChevronLeft v-else :size="14"/></button>
      <div class="sidebar-bottom"><button class="sidebar-upgrade" title="Upgrade" @click="sidebarDialog='Upgrade'"><CircleArrowUp :size="14"/><span class="nav-text">Upgrade</span></button><SidebarUtilities @select="openSetting"/><button class="sidebar-profile" :title="`${session.user.name} account`" @click="sidebarDialog='Account'"><span>{{ session.user.initials.slice(0,1) }}</span><strong class="nav-text">{{ session.user.name.toUpperCase() }}</strong></button><a class="sidebar-wordmark" href="#projects" @click="selected=null"><Aperture :size="15"/><span class="nav-text">AADML workspace</span></a></div>
    </aside>
    <aside v-if="selected" class="project-sidebar"><button class="project-back" @click="selected = null; navigate('projects')"><ArrowLeft :size="13" /> MY WORKSPACE</button><div class="project-context"><span>{{ selected.type }}</span><RoomArt :variant="selected.variant" /><h3>{{ selected.name }}</h3></div><div class="nav-label">DATA</div><nav aria-label="Project"><a v-for="item in projectSections" :key="item.id" :href="`#${item.id}`" :class="['project-nav-link', {active:page === item.id}]" :aria-current="page === item.id ? 'page' : undefined"><component :is="item.icon" :size="15" />{{ item.name }}</a></nav></aside>
    <div class="main-shell">
      <header class="topbar"><div class="breadcrumb"><button class="icon-button mobile-menu" aria-label="Open navigation" @click="drawer = true"><Menu :size="21" /></button><span>Workspace</span><span class="breadcrumb-slash">/</span><strong>{{ title }}</strong></div><div class="topbar-right"><BackendConnection/><UiBadge tone="purple"><span class="live-dot"></span> Phase 2 preview</UiBadge><span class="avatar" :title="session.user.name">{{ session.user.initials.slice(0,1) }}</span></div></header>
      <main id="main" tabindex="-1">
        <div class="page-heading"><div><div class="eyebrow">TRAINING DATA</div><h1>{{ title }}</h1><p>{{ page === 'projects' ? 'Great models start with well-organized data.' : page === 'components' ? 'One consistent visual language for your entire workflow.' : page === 'members' ? 'Invite your team and manage project access.' : selected?.name || (page === 'models' ? 'Manage, deploy, and monitor models in your workspace.' : 'Your independent vision workspace.') }}</p></div><UiButton v-if="page === 'projects'" variant="primary" @click="dialog = true"><Plus :size="17" /> New project</UiButton></div>
        <div v-if="notice" class="notice" role="status"><Check :size="18" /><span>{{ notice }}</span><button class="icon-button" aria-label="Dismiss notification" @click="notice = ''"><X :size="17" /></button></div>
        <ProjectUpload v-if="page === 'upload'" :key="selected?.id || 'default'" :project="selected" @continue="receiveBatch" @navigate="navigate" />
        <WorkspaceExtras v-else-if="['agent','assets','workflows','events','discover'].includes(page)" :page="page" @navigate="navigate" @create="dialog=true" />
        <section v-else-if="page==='deployments'" class="panel screen-placeholder"><Server :size="36"/><h2>Deployments</h2><UiBadge tone="purple">Coming soon</UiBadge><p>Workspace deployment management will be available when the backend is connected.</p></section>
        <WorkspaceModels v-else-if="page === 'models' && !selected" @create="dialog = true" />
        <ConnectApp v-else-if="page === 'connect'" :key="selected?.ref" :project="selected" @navigate="navigate" />
        <TeamMembers v-else-if="page==='members'" />
        <TrashPage v-else-if="page==='trash'" @restored="loadProjects" />
        <ProjectSettings v-else-if="page==='settings'&&selected" :key="selected.ref" :project="selected" @navigate="navigate" @renamed="projectRenamed" @trashed="projectTrashed" />
        <TrainingNotifications v-else-if="page==='notifications'" @changed="n=>unreadCount=n" />
        <ProjectStudio v-else-if="!['projects','components'].includes(page)" :page="page" :project="selected" :open-assignment="openAssignment" :open-upload="openUpload" @opened="openAssignment=null" @opened-upload="openUpload=null" @navigate="navigate" @create="dialog = true" />
        <template v-else-if="page === 'projects'">
          <section class="welcome-panel"><div class="welcome-copy"><UiBadge tone="purple">YOUR DATA → YOUR MODEL</UiBadge><h2>Build with a clearer view.</h2><p>Bring your images together, refine your labels,<br class="desktop-break"> and prepare a dataset you can trust.</p><a href="#components" class="text-link">Explore the UI foundation <ArrowRight :size="16" /></a></div><div class="workflow-preview" aria-label="Workflow preview"><div><span class="step-icon"><Upload :size="20" /></span><strong>Upload</strong><small>Collect your images</small></div><span class="connector"></span><div><span class="step-icon"><ScanLine :size="20" /></span><strong>Annotate</strong><small>Make every label count</small></div><span class="connector"></span><div><span class="step-icon"><Layers :size="20" /></span><strong>Prepare</strong><small>Ready for training</small></div></div></section>
          <section class="projects-section" aria-labelledby="projects-title"><div class="section-heading"><div><h2 id="projects-title">Your projects <span class="count">{{ projects.length }}</span></h2><p>The projects you have a role in, in this workspace.</p></div></div>
            <div class="toolbar"><label class="search-field"><Search :size="18" /><input v-model="search" aria-label="Search projects" placeholder="Search projects…"></label><div class="toolbar-end"><select v-model="typeFilter" class="text-input" aria-label="Project type"><option>All types</option><option v-for="t in [...new Set(projects.map(p=>p.type))]" :key="t">{{t}}</option></select><select v-model="folderFilter" class="text-input" aria-label="Project folder"><option>All folders</option><option v-for="f in folders" :key="f">{{f}}</option></select><UiButton @click="folderDialog=true">New folder</UiButton><label class="sort-field"><span>Sort by</span><select v-model="sort" aria-label="Sort projects"><option value="recent">Recently added</option><option value="name">Name A–Z</option></select></label><div class="view-switch" aria-label="Project display"><button class="icon-button" :aria-pressed="view === 'grid'" aria-label="Grid view" @click="view = 'grid'"><LayoutGrid :size="17" /></button><button class="icon-button" :aria-pressed="view === 'list'" aria-label="List view" @click="view = 'list'"><List :size="18" /></button></div></div></div>
            <div v-if="filtered.length" :class="['project-grid', { 'project-list': view === 'list' }]"><article v-for="project in filtered" :key="project.id" class="project-card"><ProjectCardMenu @trash="trash(project)" :project="project" :projects="projects" :folders="folders" @rename="rename(project, $event)" @move="moveTo(project, $event)"/><button class="project-open" @click="openProject(project)"><div :class="['project-image', { 'project-image--empty': !project.images }]"><RoomArt v-if="project.images" :variant="project.variant" /><div v-else class="empty-image"><Images :size="28" /></div></div><div class="project-body"><span class="compact-project-type"><ScanLine :size="12" />{{ project.type }}</span><h3><LockKeyhole v-if="project.details?.visibility !== 'Public'" :size="13" />{{ project.name }}</h3><p class="compact-edited">Edited {{ project.date }}</p><p class="compact-project-meta">{{ project.details?.visibility || 'Private' }} &#183; {{ project.images }} {{ project.images === 1 ? 'Image' : 'Images' }} &#183; {{ project.models }} {{ project.models === 1 ? 'Model' : 'Models' }}</p></div></button></article></div>
            <div v-else class="empty-state"><Search :size="32" /><h2>{{ loadingProjects ? 'Loading projects…' : projects.length ? 'No matching projects' : 'No projects yet' }}</h2><p>{{ loadingProjects ? '' : projects.length ? 'Try a different project name or task type.' : 'Create your first project to start collecting photos.' }}</p><UiButton @click="search = '';typeFilter='All types';folderFilter='All folders'">Clear search</UiButton></div>
          <section v-if="folders.length" class="panel folder-organizer"><h3>Organize projects</h3><label v-for="p in projects" :key="p.id">{{p.name}} <select :value="p.folder || ''" :disabled="!p.rights.includes('manage')" aria-label="Move project to folder" @change="moveTo(p, $event.target.value)"><option value="">No folder</option><option v-for="f in folders" :key="f">{{f}}</option></select></label></section></section>
        </template>
        <template v-else-if="page === 'components'">
          <div class="foundation-grid"><section class="panel"><div class="eyebrow">01 / ACTIONS</div><h2>Clear action hierarchy</h2><p>One primary action, with quieter supporting controls.</p><div class="component-row"><UiButton variant="primary" @click="dialog = true"><Plus :size="16" /> New project</UiButton><UiButton @click="notice = 'This is a local feedback preview.'">Show feedback</UiButton><UiButton disabled>Unavailable</UiButton></div></section><section class="panel"><div class="eyebrow">02 / STATUS</div><h2>Readable at a glance</h2><p>Color supports the label; it never replaces it.</p><div class="component-row"><UiBadge tone="green">Ready for review</UiBadge><UiBadge tone="purple">Annotating</UiBadge><UiBadge>Not connected</UiBadge></div></section><section class="panel"><div class="eyebrow">03 / INPUTS</div><h2>Focused, accessible forms</h2><label class="field-label" for="sample-name">Dataset name</label><input id="sample-name" class="text-input" placeholder="e.g. Interior walls"><p class="field-help">Use a short name your team can recognize.</p></section><section class="panel"><div class="eyebrow">04 / FEEDBACK</div><h2>Honest empty states</h2><div class="mini-empty"><Box :size="28" /><strong>No models yet</strong><span>Explore the Models tab to configure a local training preview.</span></div></section></div>
        </template>
        <section v-else class="screen-placeholder panel"><span class="placeholder-icon"><component :is="[...sections, ...projectSections].find(s => s.id === page)?.icon || Layers" :size="32" /></span><UiBadge tone="purple">Screen planned · Phase 3</UiBadge><h2>{{ title === 'Upload data' ? 'A dedicated space for your data' : `${title}, with room to focus` }}</h2><p>The navigation and workspace foundation are ready.<br>This screen’s full interactive prototype is the next phase.</p><p v-if="selected" class="selected-project">Project preview: <strong>{{ selected.name }}</strong></p><UiButton @click="selected = null; navigate('projects')"><ArrowLeft :size="16" /> Back to projects</UiButton></section>
      </main>
    </div>
  </div>

  <UiDialog :open="folderDialog" title="New folder" @close="folderDialog=false"><label class="field-label">Folder name<input v-model="folderName" class="text-input" maxlength="60"></label><p class="dialog-description">Folders arrange the projects of this workspace. They grant nobody access.</p><div class="dialog-actions"><UiButton @click="folderDialog=false">Cancel</UiButton><UiButton variant="primary" :disabled="!folderName.trim()" @click="addFolder">Create folder</UiButton></div></UiDialog>
</template>
