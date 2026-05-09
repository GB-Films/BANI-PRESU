import { ballparkPresets, rolePresets } from '../data/presets'

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
  sourceType: preset.sourceType ?? '',
  sourceKey: preset.sourceKey ?? '',
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

export const createCalendarItem = (preset = {}) => ({
  id: uid(),
  area: preset.area ?? 'POST',
  date: preset.date ?? '',
  task: preset.task ?? preset.phase ?? '',
  notes: preset.notes ?? '',
  included: preset.included ?? true,
})

export const createBudget = () => ({
  id: uid(),
  projectName: 'Nuevo presupuesto BANI VFX',
  client: '',
  finalClient: '',
  clientProposalName: '',
  clientLogo: '',
  agency: '',
  productionCompany: '',
  date: new Date().toISOString().slice(0, 10),
  budgetNumber: `BANI-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 900) + 100)}`,
  version: 'v1',
  owner: '',
  currency: 'USD',
  language: 'es',
  budgetMode: 'Ambos',
  productionSpecs: {
    flowType: '',
    commercialTitle: '',
    development: '',
    projectDescription: '',
    includedWorks: [
      { id: 'modelado-3d', text: 'Modelado 3D realista', included: false },
      { id: 'trackeo-3d', text: 'Trackeo 3D', included: false },
      { id: 'invisible-vfx', text: 'Invisible VFX', included: false },
      { id: 'composicion', text: 'Composicion', included: false },
      { id: 'renders-3d', text: 'Renders 3D', included: false },
      { id: 'sonido', text: 'Diseno de sonido', included: false },
      { id: 'color', text: 'Color', included: false },
    ],
    pieceSummary: '',
    paymentTerms: 'Contemplamos el pago a 30 dias de entregado el contenido terminado.',
    billingInfo: 'El proyecto es facturado por Gran Berta SRL.',
    videoDuration: '',
    shotCount: '',
    deliveryFormats: '',
    complexity: 'Media',
  },
  calendarSettings: {
    title: '',
    startDate: new Date().toISOString().slice(0, 10),
    month: new Date().toISOString().slice(0, 7),
    weeks: 2,
    areas: ['POST', 'VFX', '3D', 'ENTREGAS'],
    language: 'es',
    considerations: [
      { id: 'calendar-validity-es', text: 'El calendario es orientativo y queda sujeto a la entrega de materiales, aprobaciones y feedback en tiempo.', included: true },
      { id: 'calendar-review-es', text: 'Las fechas pueden ajustarse si cambia el alcance, los entregables o la complejidad de las tareas.', included: true },
      { id: 'calendar-client-es', text: 'Los envios y revisiones con cliente se coordinan segun disponibilidad de ambas partes.', included: false },
    ],
    taskPresets: [
      'Descarga de material',
      'Organizacion del proyecto',
      'Montaje',
      'Revision interna',
      'Envio al cliente',
      'Feedback cliente',
      'Composicion',
      'Tracking de la escena',
      'Layout 3D',
      'Modelado de elementos',
      'Animacion',
      'Render',
      'Color',
      'Sonido',
      'Entrega final',
    ],
  },
  teamMembers: [
    createTeamMember({ role: 'VFX Supervisor', area: 'Supervision', dayRate: 650, days: 2 }),
    createTeamMember({ role: 'Compositor', area: 'VFX', dayRate: 440, days: 5 }),
  ],
  ballparkItems: [],
  calendarItems: [],
  detailedTasks: rolePresets.slice(0, 4).map((role) => createDetailedTask({
    area: role.area,
    taskName: role.role,
    description: `Trabajo de ${role.role}`,
    unit: 'Dia',
    unitValue: role.dayRate,
  })),
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
    considerations: [
      { id: 'validity', text: 'Validez de la cotizacion: 15 dias.', included: true },
      { id: 'scope-review', text: 'Alcance sujeto a revision de materiales finales.', included: true },
      { id: 'changes', text: 'Cambios fuera del alcance cotizado se presupuestan por separado.', included: false },
      { id: 'materials', text: 'El cronograma queda sujeto a la entrega de materiales y feedback en tiempo.', included: false },
      { id: 'taxes', text: 'Impuestos, medios y costos de terceros no incluidos salvo indicacion expresa.', included: false },
      { id: 'script-by-sport', text: 'Contemplamos que se nos entrega el guion correspondiente a cada deporte para poder realizar nuestro trabajo.', included: false },
      { id: 'music-library', text: 'No esta contemplado componer musica; se usaran canciones de biblioteca provista.', included: false },
      { id: 'voiceover', text: 'No esta contemplado grabar locuciones.', included: false },
      { id: 'delivery-date', text: 'La fecha de entrega de las piezas es la que figura en el cronograma previsto.', included: false },
      { id: 'payment-detail', text: 'Contemplamos en el precio el pago tal como se detalla en la seccion del presupuesto.', included: false },
      { id: 'deliverables-16-9', text: 'Se entregaran videos en formato 16:9, uno por cada deporte.', included: false },
      { id: 'deliverables-9-16', text: 'Se entregaran piezas verticales en formato 9:16.', included: false },
      { id: 'full-hd', text: 'El formato de entrega sera .mov y .mp4, ambos en Full HD.', included: false },
    ],
    clientNotes: '',
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
  const isPureBallpark = budget.budgetMode === 'Ballpark'
  const hasDayRateBallpark = budget.ballparkItems.some((item) => item.sourceType === 'ballparkDayRate')
  const shouldUseOnlyDayRateBallpark = isPureBallpark && hasDayRateBallpark && !budget.productionSpecs?.presetName
  const ballparkRows = shouldUseOnlyDayRateBallpark
    ? budget.ballparkItems.filter((item) => item.sourceType === 'ballparkDayRate')
    : budget.ballparkItems
  const subtotalTeam = isPureBallpark ? 0 : budget.teamMembers.reduce((sum, item) => sum + teamSubtotal(item), 0)
  const subtotalBallpark = isBallpark ? ballparkRows.reduce((sum, item) => sum + lineSubtotal(item), 0) : 0
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
