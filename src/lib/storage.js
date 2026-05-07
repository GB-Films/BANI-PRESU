const STORAGE_KEY = 'bani-vfx-budgets'
const CURRENT_KEY = 'bani-vfx-current-budget'
export const PRICING_KEY = 'bani-vfx-pricing-catalog'
const USER_ROLE_KEY = 'bani-vfx-user-role'
const SESSION_KEY = 'bani-vfx-session'

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
