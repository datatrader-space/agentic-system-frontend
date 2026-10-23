<script setup>
import { watch, ref, computed, inject, onMounted, onUnmounted, provide } from 'vue';
import { signOut } from './api/session.js';
import { trashProject, getProject, listProjects, createProject, createFolder, moveProject, renameProject, saveDataUse, saveLlmDataUse, listKinds, dataUseAnswers, llmDataUseAnswers, TYPE_KIND, toCard } from './api/training.js';
import ConnectApp from './components/ConnectApp.vue';
import LlmUpload from './components/LlmUpload.vue';
import LlmExamples from './components/LlmExamples.vue';
import LlmReview from './components/LlmReview.vue';
import LlmVersions from './components/LlmVersions.vue';
import LlmTrain from './components/LlmTrain.vue';
import LlmModels from './components/LlmModels.vue';
import LlmTest from './components/LlmTest.vue';
import LlmAnalytics from './components/LlmAnalytics.vue';
import LlmDeploy from './components/LlmDeploy.vue';
import { NOT_FOR_LLM, LATER_FOR_LLM } from './api/llm.js';
import { Aperture, FolderOpen, Box, Layers, ArrowUpRight, Plus, Search, LayoutGrid, List, Menu, X, ArrowLeft, Upload, ScanLine, Images, Tags, ChartNoAxesCombined, GitBranch, LockKeyhole, Check, Sparkles, Network, Server, Orbit, Bell, Settings, ChevronLeft, ChevronRight, CircleArrowUp, KeyRound, Users , Trash2, ClipboardList } from 'lucide-vue-next';
import SidebarUtilities from './components/SidebarUtilities.vue';
import UiButton from './components/UiButton.vue';
import UiDialog from './components/UiDialog.vue';
import UiBadge from './components/UiBadge.vue';
import ProjectCreate from './components/ProjectCreate.vue';
import ProjectUpload from './components/ProjectUpload.vue';
import WorkspaceAssets from './components/WorkspaceAssets.vue';
import ProjectStudio from './components/ProjectStudio.vue';
import WorkspaceModels from './components/WorkspaceModels.vue';
import WorkspaceDeployments from './components/WorkspaceDeployments.vue';
import WorkspaceEvents from './components/WorkspaceEvents.vue';
import WorkspaceAgent from './components/WorkspaceAgent.vue';
import WorkspaceWorkflows from './components/WorkspaceWorkflows.vue';
import WorkspaceAudit from './components/WorkspaceAudit.vue';
import { SETTINGS_PAGES } from './api/workspace.js';
import ProjectCardMenu from './components/ProjectCardMenu.vue';
import TrainingNotifications from './components/TrainingNotifications.vue';
import TeamMembers from './components/TeamMembers.vue';
import TrashPage from './components/TrashPage.vue';
import ProjectSettings from './components/ProjectSettings.vue';
import WorkspaceSwitcher from './components/WorkspaceSwitcher.vue';
import JoinByLink from './components/JoinByLink.vue';
import { joinToken } from './api/members.js';
import { selectWorkspace } from './api/workspaces.js';
import { listNotifications, readDeepLink, findProject } from './api/notifications.js';
const sections = [{id:'agent',name:'Agent',icon:Sparkles},{id:'assets',name:'Asset Library',icon:Images},{id:'workflows',name:'Workflows',icon:GitBranch},{id:'events',name:'Vision events',icon:ChartNoAxesCombined},{id:'discover',name:'Universe',icon:Orbit},{id:'notifications',name:'Notifications',icon:Bell},{id:'members',name:'Team Members',icon:Users},{id:'trash',name:'Trash',icon:Trash2},{id:'audit',name:'Audit log',icon:ClipboardList},{ id: 'projects', name: 'Projects', icon: FolderOpen }, { id: 'models', name: 'Models', icon: Network }, {id:'deployments',name:'Deployments',icon:Server}];
const PAGE_LINES = { assets: 'Your photos and videos, ready to add to your projects.', discover: 'Public datasets for your projects.', deployments: 'Where the models of your projects answer, and how often they are asked.', events: 'What your apps sent to your projects, and what they asked their models.', agent: 'An assistant that does Training work for you, with your own role in each project.', workflows: 'Your workflows in AADML.', audit: 'Who did what in this workspace, and whether it was allowed.' };
const projectSections = [{id:'settings',name:'Settings',icon:Settings},{id:'train',name:'Train',icon:Box},{id:'models',name:'Models',icon:Box},{id:'nas',name:'NAS',icon:Layers},{id:'test',name:'Test',icon:ScanLine},{id:'deploy',name:'Deployments',icon:Upload},{id:'active',name:'Active learning',icon:GitBranch},{ id: 'upload', name: 'Upload data', icon: Upload }, { id: 'connect', name: 'Connect app', icon: KeyRound }, { id: 'annotate', name: 'Annotate', icon: ScanLine }, { id: 'dataset', name: 'Dataset', icon: Images }, { id: 'versions', name: 'Versions', icon: GitBranch }, { id: 'analytics', name: 'Analytics', icon: ChartNoAxesCombined }, { id: 'classes', name: 'Classes & tags', icon: Tags }];
sections.sort((a,b)=>['agent','projects','assets','workflows','models','deployments','events','discover','notifications'].indexOf(a.id)-['agent','projects','assets','workflows','models','deployments','events','discover','notifications'].indexOf(b.id));
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
// Workspace settings: Team Members, Trash and the Audit log are pages here; Plan & Billing and Credit Usage are AADML's own
// pages (SETTINGS_PAGES); API Keys and Datasources say where those things are.
// Project settings: a new name shows everywhere; a deleted project leaves the list.
async function projectRenamed(name){ const ref=selected.value?.ref; await loadProjects(); selected.value=projects.value.find(p=>p.ref===ref)||selected.value; }
// A project moved to the Trash leaves the list; its Owner restores it from Workspace Settings → Trash within 30 days.
async function projectTrashed(name){ selected.value=null; navigate('projects'); await loadProjects(); notice.value=`“${name}” is in the Trash. Restore it from Workspace Settings → Trash within 30 days.`; }
async function trash(project){ try { await trashProject(project.ref); await projectTrashed(project.name); } catch (error) { notice.value=error.message; } }
function openSetting(name){ const here={'Team Members':'members','Trash':'trash','Audit Logs':'audit','Notifications':'notifications'}[name]; if(here){ selected.value=null; navigate(here); } else if(SETTINGS_PAGES[name]) location.assign(SETTINGS_PAGES[name]); else sidebarDialog.value=name; }
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
  if (!selected.value && projectSections.some(s=>s.id===page.value) && page.value!=='models') selected.value=lastProject();
}
async function addFolder(){const name=folderName.value.trim(); if(!name) return; try { await createFolder(name); folderDialog.value=false; folderName.value=''; await loadProjects(); } catch (error) { notice.value=error.message; folderDialog.value=false; }}
async function moveTo(project, name){const folder=folderRows.value.find(f=>f.name===name); try { await moveProject(project.ref, folder?folder.id:null); project.folder=folder?.name; project.folderId=folder?.id??null; } catch (error) { notice.value=error.message; await loadProjects(); }}
async function rename(project, name){try { const row=await renameProject(project.ref, name); project.name=row.name; } catch (error) { notice.value=error.message; }}
// New project: create it, then save its data policy as the project's data-use answers. Returns the new card.
async function submitProject(form){
  const kind=TYPE_KIND[form.task]; const chosen=kinds.value.find(k=>k.key===kind); const task=chosen?.task||'';
  // A language-model project names its kind too: the kind sets where its training starts.
  const row=await createProject({name:form.name, description:form.purpose, task, ...(chosen?.family==='llm'?{kind}:{})});
  await saveDataUse(row.ref, dataUseAnswers(form));
  if (row.family==='llm') await saveLlmDataUse(row.ref, llmDataUseAnswers(form));
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
// A project page opened without a project in its address (a reload of #annotate) is the project this tab had open,
// never simply the first one: that once showed another project's photos under the same page. None remembered: the
// page asks which project.
const LAST_PROJECT = 'tmd.project';
function lastProject() { let ref = ''; try { ref = sessionStorage.getItem(LAST_PROJECT) || ''; } catch { /* no storage */ } return ref ? findProject(projects.value, ref) : null; }
watch(selected, project => { try { if (project?.ref) sessionStorage.setItem(LAST_PROJECT, project.ref); } catch { /* no storage */ } });
function readHash() { const deep = readDeepLink(location.hash); if (deep) { deepLink.value = deep; applyDeep(); return; } const id = location.hash.slice(1); if (projectSections.some(s=>s.id===id) && !selected.value && id!=='models') selected.value=lastProject(); page.value = [...sections, ...projectSections].some(s => s.id === id) ? id : 'projects'; drawer.value = false; }
function navigate(id) { location.hash = id; page.value = id; drawer.value = false; }
// A message belongs to the page it was shown on: it is cleared once the person is on another page.
let noticePage = '';
watch(notice, text => { if (text) noticePage = page.value; });
watch(page, now => { if (notice.value && now !== noticePage) notice.value = ''; });
// Back on Projects from another page: the cards are read again, so what was done there (photos, models) shows.
watch(page, (now, before) => { if (now === 'projects' && before && before !== 'projects') loadProjects(); });
function openProject(project) { selected.value = project; savedBatch.value = null; projectFlyout.value = false; navigate('upload'); }
onMounted(() => { media = window.matchMedia('(max-width: 700px)'); syncMobile(); media.addEventListener('change', syncMobile); window.addEventListener('keydown', onKey); readHash(); window.addEventListener('hashchange', readHash); loadProjects(); loadUnread(); unreadTimer=setInterval(loadUnread,60000); listKinds().then(body => { kinds.value = body.kinds; }).catch(() => {}); });
onUnmounted(() => { clearInterval(unreadTimer); window.removeEventListener('hashchange', readHash); window.removeEventListener('keydown', onKey); media?.removeEventListener('change', syncMobile); });
</script>
<template>
  <a class="skip-link" href="#main" @click.prevent="skipToMain">Skip to content</a>
  <UiDialog :open="!!sidebarDialog" :title="sidebarDialog" @close="sidebarDialog=''">
    <template v-if="sidebarDialog==='API Keys'"><p class="dialog-description">Keys belong to a project. The keys an app sends photos and events with are on the project's Connect app page. The apps that ask a deployed model for predictions, with their keys, are on the project's Deployments page.</p><div class="dialog-actions"><UiButton @click="sidebarDialog=''">Close</UiButton><UiButton variant="primary" @click="sidebarDialog='';selected=null;navigate('deployments')">Open Deployments</UiButton></div></template>
    <template v-else-if="sidebarDialog==='Datasources'"><p class="dialog-description">Importing photos from cloud storage, such as Amazon S3, Google Cloud Storage or Azure Blob Storage, is not available yet. Upload photos on a project's Upload page, or let an app send them with a key from the project's Connect app page.</p><div class="dialog-info"><UiBadge tone="purple">Coming soon</UiBadge></div><div class="dialog-actions"><UiButton @click="sidebarDialog=''">Close</UiButton></div></template>
    <template v-else-if="sidebarDialog==='Account'"><p class="dialog-description">Signed in to AADML as {{ session.user.name }}.</p><div class="dialog-actions"><a class="button" href="/dashboard/settings/general">Account settings</a><UiButton variant="primary" :disabled="signingOut" @click="leave">{{ signingOut ? 'Signing out…' : 'Sign out' }}</UiButton></div></template>
    <template v-else><p class="dialog-description">{{sidebarDialog==='Workspace'?`Current workspace: ${session.workspace.name}.`:'This section is not available yet.'}}</p><div class="dialog-info"><UiBadge tone="purple">Coming soon</UiBadge></div><div class="dialog-actions"><UiButton @click="sidebarDialog=''">Close</UiButton></div></template>
  </UiDialog>
  <JoinByLink v-if="joining" :token="joining" @close="leaveJoin" @joined="joined" />
  <ProjectCreate v-if="dialog" :submit="submitProject" @cancel="dialog = false" @done="finishCreate" />
  <div v-else :class="['workspace', {'with-project': selected,'nav-collapsed':navCollapsed}]">
    <button v-if="drawer" class="nav-backdrop" aria-label="Close navigation" @click="drawer = false"></button>
    <aside @mouseleave="projectFlyout = false" :inert="mobile && !drawer" :class="['sidebar', { 'sidebar--open': drawer }]">
      <WorkspaceSwitcher :session="session" />
      <nav aria-label="Workspace"><a v-for="item in sections.filter(s=>!['members','trash','audit'].includes(s.id))" :key="item.id" :href="`#${item.id}`" :title="item.name" @mouseenter="projectFlyout = item.id === 'projects'" @focus="projectFlyout = item.id === 'projects'" :class="['nav-link', { active: selected ? item.id==='projects' : page === item.id }]" :aria-current="page === item.id ? 'page' : undefined" @click="selected = null; drawer = false"><component :is="item.icon" :size="15" /><span class="nav-text">{{ item.name }}</span><span v-if="item.id==='notifications'&&unreadCount" class="nav-count" :aria-label="`${unreadCount} unread`">{{ unreadCount }}</span></a></nav>
      <div v-if="projectFlyout && !mobile" class="project-flyout" @mouseenter="projectFlyout = true"><div class="flyout-workspace">{{ session.workspace.name }}<small>{{ projects.length }} project{{ projects.length === 1 ? '' : 's' }}</small></div><h3>Projects</h3><UiButton @click="dialog = true; projectFlyout = false"><Plus :size="16" /> New project</UiButton><div class="flyout-recent">RECENT <a href="#projects" @click="selected = null; projectFlyout = false">View all</a></div><button v-for="project in projects.slice(0,5)" :key="project.id" @click="openProject(project)"><strong>{{ project.name }}</strong><small>{{ project.type }} / {{ project.date }}</small></button></div>

      <button class="sidebar-collapse" :aria-label="navCollapsed?'Expand navigation':'Collapse navigation'" @click="navCollapsed=!navCollapsed;projectFlyout=false"><ChevronRight v-if="navCollapsed" :size="14"/><ChevronLeft v-else :size="14"/></button>
      <div class="sidebar-bottom"><button class="sidebar-upgrade" title="Upgrade" @click="openSetting('Plan & Billing')"><CircleArrowUp :size="14"/><span class="nav-text">Upgrade</span></button><SidebarUtilities @select="openSetting" @unread="n=>unreadCount=n"/><button class="sidebar-profile" :title="`${session.user.name} account`" @click="sidebarDialog='Account'"><span>{{ session.user.initials.slice(0,1) }}</span><strong class="nav-text">{{ session.user.name.toUpperCase() }}</strong></button><a class="sidebar-wordmark" href="#projects" @click="selected=null"><Aperture :size="15"/><span class="nav-text">AADML workspace</span></a></div>
    </aside>
    <aside v-if="selected" class="project-sidebar"><button class="project-back" @click="selected = null; navigate('projects')"><ArrowLeft :size="13" /> MY WORKSPACE</button><div class="project-context"><span>{{ selected.type }}</span><img v-if="selected.thumbnail" :src="selected.thumbnail" alt=""><span v-else class="project-context-empty"><Images :size="22" /></span><h3>{{ selected.name }}</h3></div><div class="nav-label">DATA</div><nav aria-label="Project"><a v-for="item in projectSections.filter(s=>!(selected.family==='llm'&&NOT_FOR_LLM.includes(s.id)))" :key="item.id" :href="`#${item.id}`" :class="['project-nav-link', {active:page === item.id}]" :aria-current="page === item.id ? 'page' : undefined"><component :is="item.icon" :size="15" />{{ item.name }}</a></nav></aside>
    <div class="main-shell">
      <header class="topbar"><div class="breadcrumb"><button class="icon-button mobile-menu" aria-label="Open navigation" @click="drawer = true"><Menu :size="21" /></button><span>Workspace</span><span class="breadcrumb-slash">/</span><strong>{{ title }}</strong></div><div class="topbar-right"><a class="dashboard-back" href="/dashboard/"><ArrowLeft :size="16" aria-hidden="true" />Back to dashboard</a><span class="avatar" :title="session.user.name">{{ session.user.initials.slice(0,1) }}</span></div></header>
      <main id="main" tabindex="-1">
        <div class="page-heading"><div><div class="eyebrow">TRAINING DATA</div><h1>{{ title }}</h1><p>{{ page === 'projects' ? 'Great models start with well-organized data.' : page === 'members' ? 'Invite your team and manage project access.' : selected?.name || (page === 'models' ? 'Manage, deploy, and monitor models in your workspace.' : PAGE_LINES[page] || 'Your training-data workspace.') }}</p></div><UiButton v-if="page === 'projects'" variant="primary" @click="dialog = true"><Plus :size="17" /> New project</UiButton></div>
        <div v-if="notice" class="notice" role="status"><Check :size="18" /><span>{{ notice }}</span><button class="icon-button" aria-label="Dismiss notification" @click="notice = ''"><X :size="17" /></button></div>
        <LlmUpload v-if="page === 'upload' && selected?.family === 'llm'" :key="selected.ref" :project="selected" @navigate="navigate" />
        <ProjectUpload v-else-if="page === 'upload'" :key="selected?.id || 'default'" :project="selected" @continue="receiveBatch" @navigate="navigate" />
        <WorkspaceAgent v-else-if="page==='agent'" />
        <WorkspaceWorkflows v-else-if="page==='workflows'" />
        <WorkspaceEvents v-else-if="page==='events'" />
        <WorkspaceAudit v-else-if="page==='audit'" />
        <WorkspaceAssets v-else-if="page==='assets'" @navigate="navigate" />
        <section v-else-if="page==='discover'" class="panel screen-placeholder"><span class="placeholder-icon"><Orbit :size="32" /></span><UiBadge tone="purple">Coming soon</UiBadge><h2>Universe</h2><p>Public datasets you could add to your projects. Each dataset's licence has to be checked before its photos can train a model, so this is not available yet.</p></section>
        <WorkspaceDeployments v-else-if="page==='deployments'" @navigate="id => { selected = null; navigate(id); }" @create="dialog = true" />
        <WorkspaceModels v-else-if="page === 'models' && !selected" @create="dialog = true" @navigate="navigate" />
        <ConnectApp v-else-if="page === 'connect'" :key="selected?.ref" :project="selected" @navigate="navigate" />
        <TeamMembers v-else-if="page==='members'" />
        <TrashPage v-else-if="page==='trash'" @restored="loadProjects" />
        <ProjectSettings v-else-if="page==='settings'&&selected" :key="selected.ref" :project="selected" @navigate="navigate" @renamed="projectRenamed" @trashed="projectTrashed" />
        <TrainingNotifications v-else-if="page==='notifications'" @changed="n=>unreadCount=n" />
        <LlmExamples v-else-if="selected?.family==='llm' && page==='dataset'" :key="`d-${selected.ref}`" :project="selected" @navigate="navigate" />
        <LlmReview v-else-if="selected?.family==='llm' && page==='annotate'" :key="`a-${selected.ref}`" :project="selected" :open-assignment="openAssignment" @opened="openAssignment=null" @navigate="navigate" />
        <LlmTrain v-else-if="selected?.family==='llm' && page==='train'" :key="`t-${selected.ref}`" :project="selected" @navigate="navigate" />
        <LlmModels v-else-if="selected?.family==='llm' && page==='models'" :key="`m-${selected.ref}`" :project="selected" @navigate="navigate" />
        <LlmVersions v-else-if="selected?.family==='llm' && page==='versions'" :key="`v-${selected.ref}`" :project="selected" @navigate="navigate" />
        <LlmTest v-else-if="selected?.family==='llm' && page==='test'" :key="`te-${selected.ref}`" :project="selected" :open-assignment="openAssignment" @opened="openAssignment=null" @navigate="navigate" />
        <LlmAnalytics v-else-if="selected?.family==='llm' && page==='analytics'" :key="`an-${selected.ref}`" :project="selected" @navigate="navigate" />
        <LlmDeploy v-else-if="selected?.family==='llm' && page==='deploy'" :key="`de-${selected.ref}`" :project="selected" @navigate="navigate" />
        <section v-else-if="selected?.family==='llm' && (LATER_FOR_LLM[page] || NOT_FOR_LLM.includes(page))" class="panel screen-placeholder"><Layers :size="32" /><UiBadge tone="purple">{{ LATER_FOR_LLM[page] ? `Language models · phase ${LATER_FOR_LLM[page]}` : 'Vision projects only' }}</UiBadge><h2>{{ title }}</h2><p>{{ LATER_FOR_LLM[page] ? `The language-model form of this page is built in phase ${LATER_FOR_LLM[page]} of the plan.` : 'This page is for vision projects. A language-model project does not use it.' }}</p></section>
        <ProjectStudio v-else-if="page !== 'projects'" :page="page" :project="selected" :open-assignment="openAssignment" :open-upload="openUpload" @opened="openAssignment=null" @opened-upload="openUpload=null" @navigate="navigate" @create="dialog = true" />
        <template v-else-if="page === 'projects'">
          <section class="welcome-panel"><div class="welcome-copy"><UiBadge tone="purple">YOUR DATA → YOUR MODEL</UiBadge><h2>Build with a clearer view.</h2><p>Bring your data together, refine your labels,<br class="desktop-break"> and prepare a dataset you can trust.</p></div><div class="workflow-preview" aria-label="Workflow preview"><div><span class="step-icon"><Upload :size="20" /></span><strong>Upload</strong><small>Collect your images</small></div><span class="connector"></span><div><span class="step-icon"><ScanLine :size="20" /></span><strong>Annotate</strong><small>Make every label count</small></div><span class="connector"></span><div><span class="step-icon"><Layers :size="20" /></span><strong>Prepare</strong><small>Ready for training</small></div></div></section>
          <section class="projects-section" aria-labelledby="projects-title"><div class="section-heading"><div><h2 id="projects-title">Your projects <span class="count">{{ projects.length }}</span></h2><p>The projects you have a role in, in this workspace.</p></div></div>
            <div class="toolbar"><label class="search-field"><Search :size="18" /><input v-model="search" aria-label="Search projects" placeholder="Search projects…"></label><div class="toolbar-end"><select v-model="typeFilter" class="text-input" aria-label="Project type"><option>All types</option><option v-for="t in [...new Set(projects.map(p=>p.type))]" :key="t">{{t}}</option></select><select v-model="folderFilter" class="text-input" aria-label="Project folder"><option>All folders</option><option v-for="f in folders" :key="f">{{f}}</option></select><UiButton @click="folderDialog=true">New folder</UiButton><label class="sort-field"><span>Sort by</span><select v-model="sort" aria-label="Sort projects"><option value="recent">Recently added</option><option value="name">Name A–Z</option></select></label><div class="view-switch" aria-label="Project display"><button class="icon-button" :aria-pressed="view === 'grid'" aria-label="Grid view" @click="view = 'grid'"><LayoutGrid :size="17" /></button><button class="icon-button" :aria-pressed="view === 'list'" aria-label="List view" @click="view = 'list'"><List :size="18" /></button></div></div></div>
            <div v-if="filtered.length" :class="['project-grid', { 'project-list': view === 'list' }]"><article v-for="project in filtered" :key="project.id" class="project-card"><ProjectCardMenu @trash="trash(project)" @done="said => { notice = said; loadProjects(); }" :project="project" :projects="projects" :folders="folders" @rename="rename(project, $event)" @move="moveTo(project, $event)"/><button class="project-open" @click="openProject(project)"><div :class="['project-image', { 'project-image--empty': !project.thumbnail }]"><img v-if="project.thumbnail" :src="project.thumbnail" alt="" loading="lazy" decoding="async"><div v-else class="empty-image"><Images :size="28" /></div></div><div class="project-body"><span class="compact-project-type"><ScanLine :size="12" />{{ project.type }}</span><h3><LockKeyhole v-if="project.details?.visibility !== 'Public'" :size="13" />{{ project.name }}</h3><p class="compact-edited">Edited {{ project.date }}</p><p class="compact-project-meta">{{ project.details?.visibility || 'Private' }} &#183; {{ project.data }} &#183; {{ project.models }} {{ project.models === 1 ? 'Model' : 'Models' }}</p></div></button></article></div>
            <div v-else class="empty-state"><Search :size="32" /><h2>{{ loadingProjects ? 'Loading projects…' : projects.length ? 'No matching projects' : 'No projects yet' }}</h2><p>{{ loadingProjects ? '' : projects.length ? 'Try a different project name or task type.' : 'Create your first project to start collecting photos.' }}</p><UiButton @click="search = '';typeFilter='All types';folderFilter='All folders'">Clear search</UiButton></div>
          <section v-if="folders.length" class="panel folder-organizer"><h3>Organize projects</h3><label v-for="p in projects" :key="p.id">{{p.name}} <select :value="p.folder || ''" :disabled="!p.rights.includes('manage')" aria-label="Move project to folder" @change="moveTo(p, $event.target.value)"><option value="">No folder</option><option v-for="f in folders" :key="f">{{f}}</option></select></label></section></section>
        </template>
      </main>
    </div>
  </div>

  <UiDialog :open="folderDialog" title="New folder" @close="folderDialog=false"><label class="field-label">Folder name<input v-model="folderName" class="text-input" maxlength="60"></label><p class="dialog-description">Folders arrange the projects of this workspace. They grant nobody access.</p><div class="dialog-actions"><UiButton @click="folderDialog=false">Cancel</UiButton><UiButton variant="primary" :disabled="!folderName.trim()" @click="addFolder">Create folder</UiButton></div></UiDialog>
</template>

<style scoped>
.dashboard-back { display: inline-flex; align-items: center; gap: 6px; padding: 8px; border-radius: 6px; color: var(--aadml-primary); white-space: nowrap; }
.dashboard-back:hover { background: var(--aadml-tint); }
.topbar { gap: 12px; }
@media (max-width: 700px) {
  .topbar { height: auto; min-height: 62px; padding-block: 10px; flex-wrap: wrap; }
}
</style>
