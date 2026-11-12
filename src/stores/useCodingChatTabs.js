// The Coding Agent's chats as EDITOR tabs (ADM-1221, owner 2026-11-12: "want claude code chats as editor tabs"), as
// Claude Code's chats are in VS Code: they sit in the Let's Code editor's tab bar beside the project's files.
//
// The Let's Code page creates one controller and provides it (CODING_CHAT_TABS). Two components share it: the chat
// panel (UnifiedAgentChat) owns what a chat tab does (open a chat, start one, close one, what it is called and what
// it is doing) and binds those here; the editor (CodeBrowser) draws the tabs in its own bar and shows the chat when a
// chat tab is in front. Nothing else provides it, so no other page that shows the editor has chat tabs.
import { reactive, markRaw } from 'vue'

export const CODING_CHAT_TABS = 'codingChatTabs'

export function createCodingChatTabs() {
  const ctl = reactive({
    // One per chat: { key, id, label }. `key` never changes (the editor's front tab is named by it); `id` is the
    // conversation's, or null for a new chat not sent yet; `label` its first message.
    tabs: [],
    // A chat tab is the editor's front tab (else a file is).
    front: false,
    // Set while the chat panel is bound: the editor shows chat tabs only then.
    bound: false,
  })
  let handlers = null
  Object.assign(ctl, markRaw({
    bind(h) { handlers = h; ctl.bound = true },
    unbind(h) {
      if (handlers !== h) return
      handlers = null
      ctl.bound = false
      ctl.tabs = []
      ctl.front = false
    },
    // The person picks a chat tab: it comes to the front and its chat opens.
    select(tab) { ctl.front = true; return handlers?.select(tab) },
    newChat() { ctl.front = true; return handlers?.newChat() },
    close(tab) { return handlers?.close(tab) },
    showChat() {
      if (!ctl.tabs.length) return ctl.newChat()
      ctl.front = true
      return null
    },
    showFiles() { ctl.front = false },
    title(tab) { return handlers?.title(tab) || 'Chat' },
    state(tab) { return handlers?.state(tab) || 'idle' },
    stateLabel(tab) { return handlers?.stateLabel(tab) || '' },
    isActive(tab) { return !!handlers?.isActive(tab) },
  }))
  return ctl
}
