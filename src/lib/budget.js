import { ballparkPresets, taskPresets } from '../data/presets'

const uid = () => crypto.randomUUID?.() ?? `${Date.now()}-${Math.random()}`

export const createTeamMember = (preset = {}) => ({
  id: uid(),
  name: '',
  role: preset.role ?? '',
  area: preset.area ?? 'VFX',
  dayRate: Number(preset.dayRate ?? 0),
  days: Number(preset.days ?? 1),
  notes: '',
  included: true,
})

export const createBallparkItem = (preset = {}) => ({
  id: uid(),
  name: preset.name ?? 'Nueva partida',
  description: preset.description ?? '',
  quantity: Number(preset.quantity ?? 1),
  unitValue: Number(preset.unitValue ?? 0),
  notes: '',
  included: true,
})

export const createDetailedTask = (preset = {}) => ({
  id: uid(),
  area: preset.area ?? 'VFX',
  taskName: preset.taskName ?? 'Nueva tarea',
  description: preset.description ?? '',
  assignee: '',
  quantity: Number(preset.quantity ?? 1),
  unit: preset.unit ?? 'Dia',
  unitValue: Number(preset.unitValue ?? 0),
  status: 'Estimado',
  notes: '',
  included: true,
})

export const createBudget = () => ({
  id: uid(),
  projectName: 'Nuevo presupuesto BANI VFX',
  client: '',
  agency: '',
  productionCompany: '',
  date: new Date().toISOString().slice(0, 10),
  budgetNumber: `BANI-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 900) + 100)}`,
  version: 'v1',
  owner: '',
  currency: 'USD',
  budgetMode: 'Ambos',
  productionSpecs: {
    videoDuration: '',
    shotCount: '',
    deliveryFormats: '',
    complexity: 'Media',
  },
  teamMembers: [
    createTeamMember({ role: 'VFX Supervisor', area: 'Supervision', dayRate: 650, days: 2 }),
    createTeamMember({ role: 'Compositor', area: 'VFX', dayRate: 440, days: 5 }),
  ],
  ballparkItems: ballparkPresets.slice(3, 6).map(createBallparkItem),
  detailedTasks: taskPresets
    .filter((task) => ['Supervision VFX', 'Tracking', 'Rotoscopia', 'Cleanup', 'Compositing', 'Revision y ajustes'].includes(task.taskName))
    .map(createDetailedTask),
  fees: {
    productionFeePercent: 12,
    contingencyPercent: 10,
    discountPercent: 0,
    taxPercent: 21,
    productionFeeEnabled: true,
    contingencyEnabled: true,
    discountEnabled: false,
    taxEnabled: false,
  },
  brandSettings: {
    logo: '',
    referenceImage: '',
    primaryColor: '#e61e6e',
    secondaryColor: '#ffffff',
    backgroundColor: '#080808',
    darkMode: true,
    technicalGrid: true,
    textureEnabled: true,
  },
  notes: {
    clientNotes: 'Validez de la cotizacion: 15 dias. Alcance sujeto a revision de materiales finales.',
    internalNotes: '',
  },
  exportOptions: {
    cover: true,
    projectData: true,
    executiveSummary: true,
    team: true,
    ballpark: true,
    detailed: true,
    totals: true,
    notes: true,
    view: 'Cliente',
  },
  updatedAt: new Date().toISOString(),
})

export const money = (value, currency = 'USD') =>
  new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency,
    maximumFractionDigits: currency === 'ARS' ? 0 : 2,
  }).format(Number(value || 0))

export const lineSubtotal = (row, qtyKey = 'quantity', valueKey = 'unitValue') =>
  Number(row.included ? Number(row[qtyKey] || 0) * Number(row[valueKey] || 0) : 0)

export const teamSubtotal = (member) => lineSubtotal(member, 'days', 'dayRate')

export const calculateBudget = (budget) => {
  const isBallpark = budget.budgetMode === 'Ballpark' || budget.budgetMode === 'Ambos'
  const isDetailed = budget.budgetMode === 'Detallado' || budget.budgetMode === 'Ambos'
  const subtotalTeam = budget.teamMembers.reduce((sum, item) => sum + teamSubtotal(item), 0)
  const subtotalBallpark = isBallpark ? budget.ballparkItems.reduce((sum, item) => sum + lineSubtotal(item), 0) : 0
  const subtotalDetailed = isDetailed ? budget.detailedTasks.reduce((sum, item) => sum + lineSubtotal(item), 0) : 0
  const base = subtotalTeam + subtotalBallpark + subtotalDetailed
  const productionFee = budget.fees.productionFeeEnabled ? base * Number(budget.fees.productionFeePercent || 0) / 100 : 0
  const contingency = budget.fees.contingencyEnabled ? base * Number(budget.fees.contingencyPercent || 0) / 100 : 0
  const discount = budget.fees.discountEnabled ? base * Number(budget.fees.discountPercent || 0) / 100 : 0
  const taxableBase = Math.max(base + productionFee + contingency - discount, 0)
  const tax = budget.fees.taxEnabled ? taxableBase * Number(budget.fees.taxPercent || 0) / 100 : 0
  const totalFinal = taxableBase + tax

  return {
    isBallpark,
    isDetailed,
    subtotalTeam,
    subtotalBallpark,
    subtotalDetailed,
    base,
    productionFee,
    contingency,
    discount,
    tax,
    totalFinal,
    ballparkDetailedDiff: Math.abs(subtotalBallpark - subtotalDetailed),
  }
}

export const groupTotals = (budget, rows, groupKey, subtotalFn = lineSubtotal) =>
  rows
    .filter((row) => row.included)
    .reduce((acc, row) => {
      const key = row[groupKey] || 'Sin asignar'
      acc[key] = (acc[key] || 0) + subtotalFn(row)
      return acc
    }, {})

export const chartDataFromTotals = (totals) =>
  Object.entries(totals)
    .filter(([, value]) => value > 0)
    .map(([name, value]) => ({ name, value }))
