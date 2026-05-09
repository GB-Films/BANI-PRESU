const STORAGE_KEY = 'bani-vfx-budgets'
const CURRENT_KEY = 'bani-vfx-current-budget'
export const PRICING_KEY = 'bani-vfx-pricing-catalog'
const USER_ROLE_KEY = 'bani-vfx-user-role'
const SESSION_KEY = 'bani-vfx-session'
const CLOUD_TABLE = 'app_state'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const isCloudStorageEnabled = () => Boolean(supabaseUrl && supabaseAnonKey)

const cloudHeaders = {
  apikey: supabaseAnonKey,
  Authorization: `Bearer ${supabaseAnonKey}`,
  'Content-Type': 'application/json',
}

const cloudEndpoint = (query = '') => `${supabaseUrl}/rest/v1/${CLOUD_TABLE}${query}`

const loadCloudValue = async (key, fallback) => {
  if (!isCloudStorageEnabled()) return fallback
  const response = await fetch(cloudEndpoint(`?key=eq.${encodeURIComponent(key)}&select=data&limit=1`), {
    headers: cloudHeaders,
    cache: 'no-store',
  })
  if (!response.ok) throw new Error(`Supabase load failed: ${response.status}`)
  const rows = await response.json()
  return rows[0]?.data ?? fallback
}

const saveCloudValue = async (key, value) => {
  if (!isCloudStorageEnabled()) return
  const response = await fetch(cloudEndpoint('?on_conflict=key'), {
    method: 'POST',
    headers: {
      ...cloudHeaders,
      Prefer: 'resolution=merge-duplicates,return=minimal',
    },
    body: JSON.stringify({
      key,
      data: value,
      updated_at: new Date().toISOString(),
    }),
  })
  if (!response.ok) throw new Error(`Supabase save failed: ${response.status}`)
}

export const loadBudgets = () => {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) ?? []
  } catch {
    return []
  }
}

export const saveBudgets = (budgets) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(budgets))
}

export const loadCurrentId = () => localStorage.getItem(CURRENT_KEY)
export const saveCurrentId = (id) => localStorage.setItem(CURRENT_KEY, id)

export const loadPricingCatalog = (fallback) => {
  try {
    return JSON.parse(localStorage.getItem(PRICING_KEY)) ?? fallback
  } catch {
    return fallback
  }
}

export const savePricingCatalog = (catalog) => {
  localStorage.setItem(PRICING_KEY, JSON.stringify(catalog))
}

export const loadSharedBudgets = () => loadCloudValue(STORAGE_KEY, null)
export const saveSharedBudgets = (budgets) => saveCloudValue(STORAGE_KEY, budgets)
export const loadSharedPricingCatalog = () => loadCloudValue(PRICING_KEY, null)
export const saveSharedPricingCatalog = (catalog) => saveCloudValue(PRICING_KEY, catalog)

export const loadUserRole = () => localStorage.getItem(USER_ROLE_KEY) || 'producer'
export const saveUserRole = (role) => localStorage.setItem(USER_ROLE_KEY, role)

export const loadSession = () => {
  try {
    return JSON.parse(localStorage.getItem(SESSION_KEY))
  } catch {
    return null
  }
}

export const saveSession = (session) => localStorage.setItem(SESSION_KEY, JSON.stringify(session))
export const clearSession = () => localStorage.removeItem(SESSION_KEY)
