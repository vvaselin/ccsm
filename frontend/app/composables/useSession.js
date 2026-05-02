// composables/useSession.js
// セッションID管理（localStorage で永続化）

import { ref, onMounted } from 'vue'

export function useSession() {
  const sessionId = ref('')

  onMounted(() => {
    const key = 'cssm_session_id'
    let id = localStorage.getItem(key)
    if (!id) {
      id = crypto.randomUUID()
      localStorage.setItem(key, id)
    }
    sessionId.value = id
  })

  return { sessionId }
}
