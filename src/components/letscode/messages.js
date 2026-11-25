// The Let's Code editor's words, in one message catalogue (ADM-1330, LETS_CODE_EDITOR_GAPS_2026_PLAN.md G17), so a
// second language can be added later by adding its catalogue: no word is translated yet, English is the only one.
//
// A plain module on purpose: Let's Code is a lazily loaded page, and this file is imported only by its components,
// so it is part of the editor's chunks and never of the first-load bundle (vue-i18n would put its runtime there).
//
//   t('light.openPort', { port: 3000 })   -> "Open port 3000"        ({name} is replaced by params.name)
//   tn('light.needYou', 2)                -> "2 chats need you"     (the `.one` / `.other` form, by Intl.PluralRules;
//                                                                     `{n}` is the count)
// A key a catalogue does not have falls back to English, and a key English does not have is returned as it is, so a
// missing word shows plainly in the page and in a test.
import { ref } from 'vue'

const en = {
  // ── The landing page: the person's projects and GitHub ──
  'landing.title': "Let's Code",
  'landing.sub': 'Start a new project or clone a GitHub repository, and build it with the coding agent.',
  'landing.projects': 'Your projects',
  'landing.projectsCount': '{n} projects',
  'landing.newProject': 'New project',
  'landing.create': 'Create',
  'landing.creating': 'Creating',
  'landing.newHint': 'Starts empty. No GitHub repository needed; publish it later from Source control.',
  'landing.loadingProjects': 'Loading projects',
  'landing.noProjects': 'No projects yet. Name one above to start empty, or clone a repository.',
  'landing.openProject': 'Open {name}',
  'landing.notOnGithub': 'Not on GitHub',
  'landing.notOnGithubTitle': 'Not on GitHub yet: publish it from Source control',
  'landing.removeNamed': 'Remove {name}',
  'landing.removeProjectTitle': 'Remove project',
  'landing.preparingStopped': 'Preparing stopped without a reason. Retry to run it again.',
  'landing.startAgainEmpty': 'Start again empty',
  'landing.retry': 'Retry',
  'landing.remove': 'Remove',
  'landing.cloneFromGithub': 'Clone from GitHub',
  'landing.reposCount': '{n} repositories',
  'landing.connectTitle': 'Connect GitHub to see your repositories',
  'landing.connectText': "Let's Code lists the repositories of the account you connect, private ones included. You can disconnect at any time.",
  'landing.connect': 'Connect GitHub',
  'landing.connecting': 'Connecting',
  'landing.connectedAs': 'Connected as',
  'landing.switchAccount': 'Switch account',
  'landing.switching': 'Switching',
  'landing.disconnect': 'Disconnect',
  'landing.disconnecting': 'Disconnecting',
  'landing.cloneByAddress': 'Clone by address',
  'landing.branchOptional': 'Branch (optional)',
  'landing.clone': 'Clone',
  'landing.cloning': 'Cloning',
  'landing.searchRepos': 'Search repositories',
  'landing.loadingRepos': 'Loading repositories',
  'landing.noRepos': 'This GitHub account has no repositories.',
  'landing.noReposMatch': 'No repositories match "{q}".',
  'landing.private': 'Private',
  'landing.updated': 'Updated {when}',
  'landing.cloneNamed': 'Clone {name}',

  // ── What the landing page says after an action ──
  'landing.createFailed': 'Could not create the project',
  'landing.reposFailed': 'Could not load your GitHub repositories',
  'landing.switchedTo': 'Switched to {account}',
  'landing.stillConnectedAs': 'Still connected as {account}',
  'landing.connectedAsNamed': 'GitHub connected as {account}',
  'landing.connected': 'GitHub connected',
  'landing.connectFailed': 'GitHub connection failed',
  'landing.disconnectTitle': 'Disconnect GitHub?',
  'landing.disconnectMessage': "Let's Code stops using {account}: no repository list, and the coding agent cannot push or open pull requests until you connect again. Your projects and their files stay.",
  'landing.thisAccount': 'this account',
  'landing.disconnected': 'GitHub disconnected',
  'landing.disconnectFailed': 'Could not disconnect GitHub',
  'landing.connectFirst': 'Connect GitHub first.',
  'landing.connectFirstShort': 'Connect GitHub first',
  'landing.cloneFailed': 'The repository could not be cloned.',
  'landing.cloneRepoFailed': 'Could not clone the repository',
  'landing.startEmptyTitle': 'Start {name} again empty?',
  'landing.startEmptyMessage': 'Its files are gone and cannot be brought back. The project starts again with no files.',
  'landing.startingAgain': 'Starting {name} again',
  'landing.retrying': 'Retrying {name}',
  'landing.retryFailed': 'Retry failed',
  'landing.removeTitle': 'Remove project?',
  'landing.removeNewMessage': 'Remove "{name}"? It is not on GitHub, so its files are deleted for good.',
  'landing.removeMessage': 'Remove "{name}" and its copy in your workspace? The GitHub repository is not affected.',
  'landing.removed': 'Project removed',
  'landing.removeFailed': 'Could not remove the project',
  'landing.projectGone': "That project is not in your Let's Code projects any more.",
  'common.cancel': 'Cancel',

  // ── The editor's bar ──
  'ide.projects': 'Projects',
  'ide.branchesNeedGithub': 'Branches come with GitHub: publish the project from Source control',
  'ide.branch': 'Branch',
  'ide.darkEditor': 'Dark editor (switch to light)',
  'ide.lightEditor': 'Light editor (switch to dark)',
  'ide.toLight': 'Switch the editor to light',
  'ide.toDark': 'Switch the editor to dark',
  'ide.openOnGithub': 'Open on GitHub',
  'ide.phoneView': 'Phone view',
  'ide.phoneViewTitle': 'Follow the agent and answer it, without the editor',
  'ide.resizeBottom': 'Resize the bottom panel',
  'ide.backToChat': 'Back to the chat',
  'ide.backToEditor': 'Back to the editor',
  'ide.switchBranchTitle': 'Switch to "{branch}"?',
  'ide.switchBranchMessage': 'This checks out the branch in your workspace and indexes it again. Unsaved edits and pending agent changes are discarded.',
  'ide.switchBranch': 'Switch branch',
  'ide.switchingTo': 'Switching to {branch}',
  'ide.switchFailed': 'Could not switch the branch',
  'ide.job.check': 'Check project',
  'ide.job.commit': 'The commit',
  'ide.job.push': 'The push',
  'ide.job.pull': 'The pull',
  'ide.job.publish': 'Publishing',
  'ide.job.pull_request': 'The pull request',
  'ide.job.download': 'The download',
  'ide.job.backup': 'The backup',
  'ide.job.other': 'A job',
  'ide.jobStillRunning': '{label} is still running. You will be told when it ends.',
  'ide.jobFinished': '{label} finished.',
  'ide.jobFailed': '{label} did not finish.',

  // ── The Coding Agent's chat panel ──
  'chat.title': 'Coding agent',
  'chat.history': 'Chat history',
  'chat.loading': 'Loading…',
  'chat.noHistory': 'No previous chats yet.',
  'chat.messages.one': '{n} message',
  'chat.messages.other': '{n} messages',
  'chat.conversation': 'Coding agent conversation',
  'chat.empty': "Describe a change or ask about the code. The agent reads, edits and runs it in the project's sandbox. Review its changes in Source control, then commit, push or discard them.",
  'chat.restoreWait': 'Wait for the agent to finish, then restore',
  'chat.restoreTitle': 'Put the files back to how they were before this message',
  'chat.restoring': 'Restoring',
  'chat.restore': 'Restore to before this message',
  'chat.reviewTitle': 'Go through the changes since this message, one at a time',
  'chat.review': 'Review changes',
  'chat.viewChanges': 'View changes',
  'chat.appRunning': 'The app is running on port {port}',
  'chat.openPreview': 'Open preview',
  'chat.recentFiles': 'Recently opened files',
  'chat.typeFileName': 'Type a file name.',
  'chat.searching': 'Searching…',
  'chat.files.one': '{n} file',
  'chat.files.other': '{n} files',
  'chat.noSuchFile': 'No file has that name.',
  'chat.filesToMention': 'Files to mention',
  'chat.removeNamed': 'Remove {name}',
  'chat.remove': 'Remove',
  'chat.inputLabel': 'Message the coding agent',
  'chat.placeholder': 'Describe a change or ask about the code (@ adds a file)',
  'chat.preparing': 'Preparing the project',
  'chat.attach': 'Attach files or images',
  'chat.stop': 'Stop',
  'chat.send': 'Send',
  'chat.reconnecting': 'Reconnecting',
  'chat.connected': 'Connected',
  'chat.keys': 'Enter to send, Shift+Enter for a new line',
  // The count pill above the composer (ADM-1360 release): the chat's background tasks, like Claude Code's footer.
  'chat.bgTasks.one': '{n} background task',
  'chat.bgTasks.other': '{n} background tasks',
  'chat.bgRunning': '{n} running',
  'chat.bgRunningTasks.one': '{n} background task running',
  'chat.bgRunningTasks.other': '{n} background tasks running',
  'chat.bgScheduledTasks.one': '{n} background task scheduled',
  'chat.bgScheduledTasks.other': '{n} background tasks scheduled',
  'chat.bgRunningScheduled': '{running} running · {scheduled} scheduled',
  'chat.bgNeedsYou': '{n} needs you',
  'chat.bgOpen': 'Show the background tasks',
  'chat.restoreAskTitle': 'Restore to before this message?',
  'chat.restoreAskMessage': "Restore the project's files to how they were before this message? Changes made after it are discarded. Files that git ignores are not touched.",
  'chat.restoreConfirm': 'Restore',
  'chat.restored': 'Restored',
  'chat.restoreFailed': 'The files were not restored. Try again.',
  'chat.tabChat': 'Chat',
  'chat.tabNew': 'New chat',
  'chat.state.working': 'Working',
  'chat.state.needs_input': 'Needs your answer',
  'chat.state.done': 'Finished',
  'chat.state.failed': 'Failed',
  'chat.state.idle': 'Idle',
  'chat.untitled': 'Untitled chat',
  'chat.justNow': 'just now',
  'chat.minutesAgo': '{n}m ago',
  'chat.hoursAgo': '{n}h ago',
  'chat.daysAgo': '{n}d ago',
  'chat.changed': 'Changed {n} {files}: {names}',
  'chat.changedMore': ', +{n} more',
  'chat.word.file': 'file',
  'chat.word.files': 'files',
  'chat.noFilesChanged': 'No files changed in this turn',
  'chat.moreChanges.one': '{head} · {n} more change not committed',
  'chat.moreChanges.other': '{head} · {n} more changes not committed',
  'chat.notSavedYet': 'This message is not saved yet, so its changes cannot be reviewed. Try again in a moment.',

  // ── The editor's one header row on a phone (ADM-1330) ──
  'phone.projects': 'Back to the projects',
  'phone.files': 'Files and editor',
  'phone.chats': 'Chats',
  'phone.chatsNeedYou': 'Chats: a chat needs you',
  'phone.openChats': 'Open chats',
  'phone.recentChats': 'Recent chats',
  'phone.loadingChats': 'Loading the chats…',
  'phone.noRecentChats': 'No other chats yet.',
  'phone.newChat': 'New chat',
  'phone.more': 'More: project, panels and display',
  'phone.views': 'Views',
  'phone.sourceControl': 'Source control',
  'phone.search': 'Search in files',
  'phone.panels': 'Panels',
  'phone.project': 'Project',
  'phone.branch': 'Branch: {branch}',
  'phone.branchesNeedGithub': 'Branches come with GitHub',
  'phone.commands': 'Commands',
  'phone.variables': 'Variables',
  'phone.prTasks': 'Pull request tasks',
  'phone.prWaiting': '{n} waiting',
  'phone.moreWaiting.one': '{n} pull request task waiting for you',
  'phone.moreWaiting.other': '{n} pull request tasks waiting for you',
  'phone.moreDeploy': 'Deploy: {state}',
  'phone.deploy': 'Deploy',
  'phone.display': 'Display',
  'phone.toDark': 'Dark editor',
  'phone.toLight': 'Light editor',
  'phone.phoneView': 'Simple phone view',
  'phone.appMenu': 'AADML menu',
  'phone.backToChat': 'Back to the chat',
  'phone.filesPane': 'Files',

  // ── The light project view for a phone (ADM-1330) ──
  'light.backToProjects': 'Projects',
  'light.backToChats': 'Back to the chats',
  'light.fullEditor': 'Full editor',
  'light.preparing': 'Preparing the project. The chats open when it is ready.',
  'light.needYou.one': '{n} chat needs you',
  'light.needYou.other': '{n} chats need you',
  'light.othersNeedYou.one': '{n} other chat needs you',
  'light.othersNeedYou.other': '{n} other chats need you',
  'light.chats': 'Chats',
  'light.newChat': 'New chat',
  'light.notifyAsk': 'Get a notification on this device when a chat needs you.',
  'light.notifyTurnOn': 'Turn on',
  'light.notifyTitle': 'The Coding Agent needs you',
  'light.loadingChats': 'Loading chats',
  'light.loadError': "The chats couldn't be loaded.",
  'light.retry': 'Try again',
  'light.noChats': 'No chats yet. Start one to give the Coding Agent a task.',
  'light.openChat': 'Open {title}',
  'light.untitled': 'Untitled chat',
  'light.answer': 'Answer',
  'light.stop': 'Stop',
  'light.stopping': 'Stopping',
  'light.cancel': 'Cancel',
  'light.stopTitle': 'Stop this run?',
  'light.stopMessage': 'The Coding Agent stops in "{title}". What it has done so far is kept.',
  'light.state.needs_input': 'Needs you',
  'light.state.working': 'Working',
  'light.state.done': 'Finished',
  'light.state.failed': 'Failed',
  'light.state.stopped': 'Stopped',
  'light.state.idle': 'Idle',
  'light.preview': 'Preview',
  'light.refreshPorts': 'Refresh the running ports',
  'light.portsWhenReady': 'The running app shows here once the project is ready.',
  'light.readingPorts': 'Reading the ports…',
  'light.noPorts': 'No app is running. Ask the Coding Agent to start it.',
  'light.openPort': 'Open port {port}',
  'light.portsStarting': 'The sandbox is starting. Try again in a moment.',
  'light.portsError': 'The ports could not be listed. Try again.',
}

const catalogues = { en }

// The language the editor speaks. Only 'en' exists; a later item adds catalogues and the person's choice.
export const locale = ref('en')

export function addCatalogue(code, messages) {
  if (code && messages && typeof messages === 'object') catalogues[code] = { ...(catalogues[code] || {}), ...messages }
}

function lookup(key) {
  const own = catalogues[locale.value]
  if (own && own[key] != null) return own[key]
  return en[key]
}

export function has(key) { return lookup(key) != null }

export function t(key, params) {
  const s = lookup(key)
  if (s == null) return key
  if (!params) return s
  return s.replace(/\{(\w+)\}/g, (m, k) => (params[k] != null ? String(params[k]) : m))
}

const _rules = {}
function pluralForm(n) {
  const code = locale.value
  try {
    if (!_rules[code]) _rules[code] = new Intl.PluralRules(code)
    return _rules[code].select(n)
  } catch {
    return n === 1 ? 'one' : 'other'
  }
}

export function tn(key, n, params = {}) {
  const form = `${key}.${pluralForm(Number(n))}`
  return t(has(form) ? form : `${key}.other`, { n, ...params })
}
