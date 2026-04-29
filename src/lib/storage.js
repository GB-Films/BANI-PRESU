const STORAGE_KEY = 'bani-vfx-budgets'
const CURRENT_KEY = 'bani-vfx-current-budget'

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
