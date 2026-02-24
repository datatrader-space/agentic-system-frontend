<template>
  <div class="invite-page">
    <div class="invite-container">
      <!-- Loading -->
      <div v-if="loading" class="invite-card invite-loading">
        <div class="spinner-lg"></div>
        <p>Loading invitation…</p>
      </div>

      <!-- Error: not found -->
      <div v-else-if="error" class="invite-card invite-error">
        <div class="invite-icon invite-icon--error">✕</div>
        <h2>Invitation Not Found</h2>
        <p>This invitation link is invalid or has been removed.</p>
        <router-link to="/dashboard" class="btn-primary">Go to Dashboard</router-link>
      </div>

      <!-- Expired -->
      <div v-else-if="invite?.is_expired || invite?.status === 'expired'" class="invite-card invite-expired">
        <div class="invite-icon invite-icon--expired">⏰</div>
        <h2>Invitation Expired</h2>
        <p>This invitation to <strong>{{ invite.organization_name }}</strong> has expired. Ask the admin to send a new invite.</p>
        <router-link to="/dashboard" class="btn-primary">Go to Dashboard</router-link>
      </div>

      <!-- Already accepted -->
      <div v-else-if="invite?.status === 'accepted'" class="invite-card invite-accepted">
        <div class="invite-icon invite-icon--success">✓</div>
        <h2>Already Accepted</h2>
        <p>You've already joined <strong>{{ invite.organization_name }}</strong>.</p>
        <router-link :to="`/org/${invite.organization_slug}`" class="btn-primary">Go to Organisation</router-link>
      </div>

      <!-- Declined -->
      <div v-else-if="invite?.status === 'declined'" class="invite-card">
        <div class="invite-icon">🔕</div>
        <h2>Invitation Declined</h2>
        <p>This invitation has been declined.</p>
        <router-link to="/dashboard" class="btn-primary">Go to Dashboard</router-link>
      </div>

      <!-- Pending: show accept/decline -->
      <div v-else-if="invite?.status === 'pending'" class="invite-card invite-pending">
        <div class="invite-org-badge">{{ invite.organization_name?.charAt(0)?.toUpperCase() }}</div>
        <h2>You're Invited!</h2>
        <p class="invite-detail">
          <strong>{{ invite.invited_by_username || 'Someone' }}</strong> has invited you to join
          <strong>{{ invite.organization_name }}</strong> as a
          <span class="role-chip">{{ invite.role }}</span>.
        </p>
        <p v-if="invite.message" class="invite-message">"{{ invite.message }}"</p>

        <!-- Not logged in -->
        <div v-if="!isLoggedIn" class="invite-auth-notice">
          <p>You need to sign in or create an account to accept this invitation.</p>
          <div class="invite-actions">
            <router-link :to="`/login?next=/invite/accept/${token}`" class="btn-primary">Sign In</router-link>
            <router-link :to="`/login?mode=signup&next=/invite/accept/${token}`" class="btn-ghost">Create Account</router-link>
          </div>
        </div>

        <!-- Logged in but wrong email -->
        <div v-else-if="emailMismatch" class="invite-auth-notice invite-auth-notice--warn">
          <p>This invite was sent to <strong>{{ invite.email }}</strong> but you are logged in as <strong>{{ currentEmail }}</strong>.</p>
          <p>Please log in with the correct account.</p>
          <router-link :to="`/login?next=/invite/accept/${token}`" class="btn-primary">Switch Account</router-link>
        </div>

        <!-- Ready to accept -->
        <div v-else class="invite-actions">
          <button class="btn-accept" @click="accept" :disabled="accepting">
            {{ accepting ? 'Joining…' : 'Accept Invitation' }}
          </button>
          <button class="btn-decline" @click="decline" :disabled="declining">
            {{ declining ? '…' : 'Decline' }}
          </button>
        </div>

        <p class="invite-expires">Expires {{ formatDate(invite.expires_at) }}</p>
      </div>

      <!-- Success: just accepted -->
      <div v-else-if="acceptedOrg" class="invite-card invite-accepted">
        <div class="invite-icon invite-icon--success">✓</div>
        <h2>Welcome to {{ acceptedOrg.name }}!</h2>
        <p>You've successfully joined the organisation.</p>
        <router-link :to="`/org/${acceptedOrg.slug}`" class="btn-primary">Go to Organisation</router-link>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import tenancyApi from '../services/tenancyApi'

const route = useRoute()
const token = computed(() => route.params.token)

const loading     = ref(true)
const error       = ref(false)
const invite      = ref(null)
const accepting   = ref(false)
const declining   = ref(false)
const acceptedOrg = ref(null)

// Check if user is logged in via session cookie presence
const isLoggedIn  = ref(false)
const currentEmail = ref('')

async function checkAuth() {
  try {
    const r = await fetch('/api/auth/me', { credentials: 'include' })
    if (r.ok) {
      const data = await r.json()
      const user = data.user || data
      isLoggedIn.value = true
      currentEmail.value = user.email || ''
    }
  } catch {}
}

const emailMismatch = computed(() =>
  isLoggedIn.value && invite.value &&
  currentEmail.value.toLowerCase() !== invite.value.email?.toLowerCase()
)

async function loadInvite() {
  loading.value = true
  error.value = false
  try {
    const r = await tenancyApi.getInviteByToken(token.value)
    invite.value = r.data
  } catch {
    error.value = true
  }
  loading.value = false
}

async function accept() {
  accepting.value = true
  try {
    const r = await tenancyApi.acceptInvite(token.value)
    acceptedOrg.value = r.data.organization
    invite.value = null // hide the pending card
  } catch (err) {
    const msg = err?.response?.data?.detail || err?.response?.data?.error || 'Failed to accept'
    alert(msg)
  }
  accepting.value = false
}

async function decline() {
  if (!confirm('Are you sure you want to decline this invitation?')) return
  declining.value = true
  try {
    await tenancyApi.declineInvite(token.value)
    invite.value.status = 'declined'
  } catch {}
  declining.value = false
}

function formatDate(d) {
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

onMounted(async () => {
  await checkAuth()
  await loadInvite()
})
</script>

<style scoped>
.invite-page {
  min-height: 100vh;
  display: flex; align-items: center; justify-content: center;
  background: linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #0f172a 100%);
  padding: 32px;
}
.invite-container { width: 100%; max-width: 480px; }
.invite-card {
  background: rgba(30,27,75,0.6);
  backdrop-filter: blur(20px);
  border: 1px solid rgba(139,92,246,0.2);
  border-radius: 20px;
  padding: 40px;
  text-align: center;
}
.invite-org-badge {
  width: 64px; height: 64px; border-radius: 50%;
  background: linear-gradient(135deg, #6366f1, #8b5cf6);
  display: flex; align-items: center; justify-content: center;
  font-size: 28px; font-weight: 800; color: #fff;
  margin: 0 auto 20px;
}
.invite-icon {
  width: 56px; height: 56px; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  font-size: 24px; margin: 0 auto 16px;
  background: rgba(255,255,255,0.05);
}
.invite-icon--success { background: rgba(16,185,129,0.15); color: #34d399; }
.invite-icon--error   { background: rgba(239,68,68,0.15); color: #f87171; }
.invite-icon--expired { background: rgba(251,146,60,0.15); color: #fb923c; }
h2 { color: #f9fafb; font-size: 22px; font-weight: 700; margin: 0 0 12px; }
p  { color: #9ca3af; font-size: 14px; line-height: 1.6; margin: 0 0 8px; }
.invite-detail { font-size: 15px; color: #d1d5db; }
.role-chip {
  display: inline-block;
  background: rgba(139,92,246,0.15); color: #a78bfa;
  padding: 2px 10px; border-radius: 20px;
  font-size: 13px; font-weight: 600;
}
.invite-message {
  font-style: italic; color: #d1d5db;
  background: rgba(255,255,255,0.03);
  border-left: 3px solid rgba(139,92,246,0.4);
  padding: 12px 16px; margin: 16px 0;
  border-radius: 0 8px 8px 0;
  text-align: left;
}
.invite-auth-notice {
  margin-top: 20px; padding: 16px;
  background: rgba(255,255,255,0.03);
  border-radius: 12px;
  border: 1px solid rgba(255,255,255,0.06);
}
.invite-auth-notice--warn { border-color: rgba(251,146,60,0.3); }
.invite-actions { display: flex; gap: 12px; justify-content: center; margin-top: 20px; }
.btn-accept {
  padding: 12px 28px; border-radius: 10px; border: none;
  background: linear-gradient(135deg, #6366f1, #8b5cf6);
  color: #fff; font-size: 15px; font-weight: 600;
  cursor: pointer; transition: all 0.12s ease;
}
.btn-accept:hover { opacity: 0.9; transform: translateY(-1px); }
.btn-accept:disabled { opacity: 0.5; cursor: not-allowed; }
.btn-decline {
  padding: 12px 28px; border-radius: 10px;
  background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1);
  color: #9ca3af; font-size: 14px; font-weight: 500;
  cursor: pointer; transition: all 0.12s ease;
}
.btn-decline:hover { background: rgba(239,68,68,0.1); color: #f87171; border-color: rgba(239,68,68,0.2); }
.btn-primary {
  display: inline-block;
  padding: 10px 24px; border-radius: 10px; border: none;
  background: linear-gradient(135deg, #6366f1, #8b5cf6);
  color: #fff; font-size: 14px; font-weight: 600;
  cursor: pointer; text-decoration: none;
  margin-top: 16px;
}
.btn-ghost {
  display: inline-block;
  padding: 10px 24px; border-radius: 10px;
  background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1);
  color: #d1d5db; font-size: 14px; font-weight: 500;
  cursor: pointer; text-decoration: none;
  margin-top: 16px;
}
.invite-expires { color: #6b7280; font-size: 12px; margin-top: 20px; }
.spinner-lg {
  width: 36px; height: 36px; border-radius: 50%;
  border: 3px solid rgba(139,92,246,0.2);
  border-top-color: #a78bfa;
  animation: spin 0.8s linear infinite;
  margin: 0 auto 16px;
}
@keyframes spin { to { transform: rotate(360deg) } }
</style>
