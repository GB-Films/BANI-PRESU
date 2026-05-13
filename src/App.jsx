import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import html2canvas from 'html2canvas'
import jsPDF from 'jspdf'
import {
  BarChart3,
  CalendarDays,
  Copy,
  Download,
  Edit3,
  FileImage,
  FileText,
  Grid3X3,
  Globe,
  GripVertical,
  Lock,
  LogOut,
  Mail,
  MessageSquareText,
  Plus,
  RotateCcw,
  Send,
  Settings,
  ShieldCheck,
  Sparkles,
  Trash2,
} from 'lucide-react'
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'
import './index.css'
import { areaOptions, ballparkPresets, rolePresets, statusOptions, unitOptions } from './data/presets'
import {
  calculateBudget,
  chartDataFromTotals,
  createBallparkItem,
  createBudget,
  createCalendarItem,
  createDetailedTask,
  createTeamMember,
  groupTotals,
  lineSubtotal,
  money,
  teamSubtotal,
} from './lib/budget'
import {
  PRICING_KEY,
  clearSession,
  isCloudStorageEnabled,
  loadBudgets,
  loadCurrentId,
  loadMessagesState,
  loadPricingCatalog,
  loadSession,
  loadSharedBudgets,
  loadSharedMessagesState,
  loadSharedPricingCatalog,
  saveBudgets,
  saveCurrentId,
  saveMessagesState,
  savePricingCatalog,
  saveSession,
  saveSharedBudgets,
  saveSharedMessagesState,
  saveSharedPricingCatalog,
} from './lib/storage'

const navItems = [
  ['projects', 'Proyectos'],
  ['dashboard', 'Presupuestos'],
  ['calendars', 'Calendarios'],
  ['messages', 'Mensajes'],
  ['brand', 'Marca'],
  ['admin', 'Admin'],
]

const chartColors = ['#e61e6e', '#ffffff', '#22c55e', '#71717a', '#a1a1aa', '#f43f5e', '#52525b']
const assetBase = import.meta.env.BASE_URL
const defaultPricingCatalog = {
  roles: rolePresets,
  ballpark: ballparkPresets,
  ballparkDayRates: [
    { key: 'gestion', name: 'Gestion de proyecto', description: 'Jornadas de gestion, coordinacion y seguimiento', unitValue: 420 },
    { key: 'montaje', name: 'Montaje', description: 'Jornadas de montaje / edicion', unitValue: 380 },
    { key: 'sonido', name: 'Sonido', description: 'Jornadas de sonido', unitValue: 360 },
    { key: 'color', name: 'Color', description: 'Jornadas de color', unitValue: 520 },
    { key: 'vfx', name: 'VFX', description: 'Jornadas de VFX', unitValue: 440 },
    { key: '3d', name: '3D', description: 'Jornadas de 3D', unitValue: 430 },
    { key: 'ia', name: 'IA', description: 'Jornadas de IA', unitValue: 440 },
  ],
}
const messageStatusOptions = [
  { key: 'post', es: 'en proceso de postproduccion', en: 'in postproduction' },
  { key: 'offline', es: 'en edicion offline', en: 'in offline edit' },
  { key: 'color', es: 'en color', en: 'in color' },
  { key: 'sound', es: 'en sonido', en: 'in sound' },
  { key: 'vfx', es: 'en VFX', en: 'in VFX' },
  { key: 'internal', es: 'en revision interna', en: 'in internal review' },
  { key: 'client-review', es: 'listo para revision del cliente', en: 'ready for client review' },
  { key: 'masters', es: 'aprobado y preparando masters', en: 'approved and preparing masters' },
]
const defaultMessageFields = {
  client: 'Cliente',
  project: 'Proyecto',
  piece: 'Video principal',
  statusKey: 'post',
  deliveryDate: 'viernes',
  reviewRound: 'primera vuelta',
  link: '',
  notes: 'Estamos cuidando ritmo, color y terminacion general.',
  nextStep: 'Nos avisan cualquier ajuste y avanzamos con la siguiente version.',
  sender: 'Equipo BANI',
}
const defaultMessageTemplates = [
  {
    id: 'estado-video',
    title: 'Estado de video',
    category: 'Seguimiento',
    channel: 'WhatsApp',
    tone: 'Claro y profesional',
    body: 'Hola {client}, como estas?\n\nLes compartimos una actualizacion de {project} / {piece}. El material esta {status} y venimos trabajando sobre la {reviewRound}.\n\nFecha estimada: {deliveryDate}.\n\n{notes}\n\n{nextStep}\n\nLink: {link}\n\n{sender}',
  },
  {
    id: 'envio-revision',
    title: 'Envio para revision',
    category: 'Revision cliente',
    channel: 'WhatsApp',
    tone: 'Directo',
    body: 'Hola {client}, como estas?\n\nLes dejamos el envio de {project} / {piece} para revision:\n{link}\n\nQuedamos atentos a comentarios para avanzar con la proxima version.\n\n{sender}',
  },
  {
    id: 'aprobacion-final',
    title: 'Aprobacion final',
    category: 'Cierre',
    channel: 'Mail',
    tone: 'Formal',
    body: 'Hola {client},\n\nConfirmamos que {project} / {piece} queda aprobado y estamos preparando los masters finales.\n\n{nextStep}\n\nGracias,\n{sender}',
  },
]
const defaultMessagesState = {
  selectedId: defaultMessageTemplates[0].id,
  fields: defaultMessageFields,
  templates: defaultMessageTemplates,
  history: [],
}
const normalizeMessagesState = (state) => ({
  ...defaultMessagesState,
  ...(state || {}),
  fields: { ...defaultMessageFields, ...(state?.fields || {}) },
  templates: state?.templates?.length ? state.templates : defaultMessageTemplates,
  selectedId: state?.selectedId || defaultMessageTemplates[0].id,
  history: state?.history || [],
})
const mergeDayRates = (rates = []) => {
  if (!rates.length) return defaultPricingCatalog.ballparkDayRates
  const existingKeys = new Set(rates.map((rate) => String(rate.key || '').toLowerCase()))
  const missingDefaults = defaultPricingCatalog.ballparkDayRates.filter((rate) => !existingKeys.has(rate.key))
  return [...rates, ...missingDefaults]
}

const mergeRoles = (roles = []) => {
  return roles.length ? roles : defaultPricingCatalog.roles
}

const mergePricingCatalog = (catalog) => ({
  ...defaultPricingCatalog,
  ...(catalog || {}),
  roles: mergeRoles(catalog?.roles),
  ballparkDayRates: mergeDayRates(catalog?.ballparkDayRates),
})
const defaultConsiderations = [
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
]
const defaultIncludedWorks = [
  { id: 'modelado-3d', text: 'Modelado 3D realista', included: false },
  { id: 'trackeo-3d', text: 'Trackeo 3D', included: false },
  { id: 'invisible-vfx', text: 'Invisible VFX', included: false },
  { id: 'composicion', text: 'Composicion', included: false },
  { id: 'renders-3d', text: 'Renders 3D', included: false },
  { id: 'sonido', text: 'Diseno de sonido', included: false },
  { id: 'color', text: 'Color', included: false },
]
const ballparkConsiderations = [
  {
    id: 'ballpark-not-final',
    text: 'Este presupuesto es orientativo. Una vez confirmado el proyecto, se entregara una propuesta integral con el detalle de los trabajos a realizar. Por lo tanto, el presupuesto final puede modificarse.',
    included: true,
  },
  { id: 'ballpark-scope', text: 'El alcance queda sujeto a revision de materiales finales, cronograma y entregables confirmados.', included: true },
  { id: 'ballpark-validity', text: 'Propuesta valida por 15 dias corridos desde la entrega.', included: true },
]
const englishBallparkConsiderations = [
  {
    id: 'ballpark-not-final-en',
    text: 'This budget is an estimate. Once the project is confirmed, a full proposal will be delivered with the detailed scope of work. Therefore, the final budget may change.',
    included: true,
  },
  { id: 'ballpark-scope-en', text: 'Scope is subject to review of final materials, schedule and confirmed deliverables.', included: true },
  { id: 'ballpark-validity-en', text: 'Proposal valid for 15 calendar days from delivery.', included: true },
]
const defaultEnglishConsiderations = [
  { id: 'validity-en', text: 'Quote valid for 15 days.', included: true },
  { id: 'scope-review-en', text: 'Scope subject to review of final materials.', included: true },
  { id: 'changes-en', text: 'Changes outside the quoted scope will be budgeted separately.', included: false },
  { id: 'materials-en', text: 'Schedule is subject to timely delivery of materials and feedback.', included: false },
]
const textByLanguage = {
  es: {
    language: 'Idioma',
    spanish: 'Castellano',
    english: 'Ingles',
    projectData: 'Datos del proyecto',
    client: 'Cliente',
    finalClient: 'Cliente final',
    currency: 'Moneda',
    type: 'Tipo',
    pieces: 'Piezas / duracion',
    proposal: 'Propuesta',
    executiveSummary: 'Resumen ejecutivo',
    subtotalTeam: 'Subtotal equipo',
    subtotalBallpark: 'Subtotal ballpark',
    subtotalDetailed: 'Subtotal detallado',
    totalFinal: 'Total final',
    team: 'Equipo involucrado',
    detailed: 'Presupuesto detallado',
    notes: 'Consideraciones',
    billing: 'Facturacion y pago',
  },
  en: {
    language: 'Language',
    spanish: 'Spanish',
    english: 'English',
    projectData: 'Project details',
    client: 'Client',
    finalClient: 'Final client',
    currency: 'Currency',
    type: 'Type',
    pieces: 'Pieces / duration',
    proposal: 'Proposal',
    executiveSummary: 'Executive summary',
    subtotalTeam: 'Team subtotal',
    subtotalBallpark: 'Ballpark subtotal',
    subtotalDetailed: 'Detailed subtotal',
    totalFinal: 'Final total',
    team: 'Team involved',
    detailed: 'Detailed budget',
    notes: 'Considerations',
    billing: 'Billing and payment',
  },
}
const getLanguage = (budget) => budget.language === 'en' ? 'en' : 'es'
const t = (budget, key) => textByLanguage[getLanguage(budget)]?.[key] || textByLanguage.es[key] || key
const appUsers = {
  admin: { password: 'admin', role: 'admin', label: 'Administrador' },
  crew: { password: 'crew', role: 'producer', label: 'Crew / Productor' },
}

let requestDeleteConfirmation = null
const confirmDelete = (label = 'este item') => (
  requestDeleteConfirmation
    ? requestDeleteConfirmation(label)
    : Promise.resolve(window.confirm(`Seguro que queres eliminar ${label}?`))
)

function App() {
  const [budgets, setBudgets] = useState(() => {
    const saved = loadBudgets()
    return saved.length ? saved : [createBudget()]
  })
  const [currentId, setCurrentId] = useState(() => loadCurrentId() || budgets[0]?.id)
  const [section, setSection] = useState('projects')
  const [wizardActive, setWizardActive] = useState(false)
  const [wizardStep, setWizardStep] = useState(0)
  const [session, setSession] = useState(() => loadSession())
  const [loginError, setLoginError] = useState('')
  const [pricingCatalog, setPricingCatalog] = useState(() => mergePricingCatalog(loadPricingCatalog(null) || defaultPricingCatalog))
  const [messagesState, setMessagesState] = useState(() => normalizeMessagesState(loadMessagesState(defaultMessagesState)))
  const [pricingDirty, setPricingDirty] = useState(false)
  const [pricingStatus, setPricingStatus] = useState(() => loadPricingCatalog(null) ? 'Valores guardados' : 'Valores base publicados')
  const [pricingPrompt, setPricingPrompt] = useState(null)
  const [deletePrompt, setDeletePrompt] = useState(null)
  const [cloudLoaded, setCloudLoaded] = useState(!isCloudStorageEnabled())
  const [cloudStatus, setCloudStatus] = useState(isCloudStorageEnabled() ? 'Conectando nube...' : 'Modo local')
  const pricingPromptResolver = useRef(null)
  const deletePromptResolver = useRef(null)
  const savedPricingCatalog = useRef(mergePricingCatalog(loadPricingCatalog(null) || defaultPricingCatalog))
  const exportRef = useRef(null)

  const budget = budgets.find((item) => item.id === currentId) || budgets[0]
  const totals = useMemo(() => calculateBudget(budget), [budget])
  const userRole = session?.role || 'producer'
  const isAdmin = userRole === 'admin'
  const visibleNavItems = isAdmin ? navItems : navItems.filter(([id]) => ['projects', 'dashboard', 'calendars', 'messages'].includes(id))

  useEffect(() => {
    saveBudgets(budgets)
    if (cloudLoaded && isCloudStorageEnabled()) {
      saveSharedBudgets(budgets).catch(() => setCloudStatus('No se pudo guardar en nube'))
    }
  }, [budgets, cloudLoaded])

  useEffect(() => {
    saveMessagesState(messagesState)
    if (cloudLoaded && isCloudStorageEnabled()) {
      saveSharedMessagesState(messagesState).catch(() => setCloudStatus('No se pudo guardar en nube'))
    }
  }, [messagesState, cloudLoaded])

  useEffect(() => {
    if (currentId) saveCurrentId(currentId)
  }, [currentId])

  useEffect(() => {
    if (!isCloudStorageEnabled()) return undefined
    let cancelled = false
    const hydrateCloudState = async () => {
      try {
        const [sharedBudgets, sharedPricing, sharedMessages] = await Promise.all([
          loadSharedBudgets(),
          loadSharedPricingCatalog(),
          loadSharedMessagesState(),
        ])
        if (cancelled) return
        if (sharedBudgets?.length) {
          setBudgets(sharedBudgets)
          setCurrentId((current) => sharedBudgets.some((item) => item.id === current) ? current : sharedBudgets[0].id)
        } else {
          await saveSharedBudgets(budgets)
        }
        if (sharedPricing) {
          const merged = mergePricingCatalog(sharedPricing)
          setPricingCatalog(merged)
          savedPricingCatalog.current = merged
          savePricingCatalog(merged)
          setPricingStatus('Valores sincronizados')
        } else {
          await saveSharedPricingCatalog(pricingCatalog)
        }
        if (sharedMessages) {
          setMessagesState(normalizeMessagesState(sharedMessages))
        } else {
          await saveSharedMessagesState(messagesState)
        }
        setCloudStatus('Nube sincronizada')
      } catch {
        if (!cancelled) setCloudStatus('Sin conexion a nube')
      } finally {
        if (!cancelled) setCloudLoaded(true)
      }
    }
    hydrateCloudState()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!isAdmin && !['projects', 'dashboard', 'calendars', 'messages'].includes(section) && !wizardActive) setSection('projects')
    if (isAdmin && !['projects', 'dashboard', 'calendars', 'messages', 'brand', 'admin'].includes(section)) setSection('projects')
  }, [isAdmin, section, wizardActive])

  useEffect(() => {
    if (loadPricingCatalog(null)) return undefined
    let cancelled = false
    fetch(`${assetBase}pricing-catalog.json?ts=${Date.now()}`, { cache: 'no-store' })
      .then((response) => (response.ok ? response.json() : null))
      .then((catalog) => {
        if (!cancelled && catalog) {
          const merged = mergePricingCatalog(catalog)
          setPricingCatalog(merged)
          savedPricingCatalog.current = merged
          setPricingStatus('Valores base publicados')
        }
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    const syncPricingCatalog = (event) => {
      if (event.key !== PRICING_KEY || !event.newValue) return
      try {
        const merged = mergePricingCatalog(JSON.parse(event.newValue))
        setPricingCatalog(merged)
        savedPricingCatalog.current = merged
        setPricingDirty(false)
        setPricingStatus('Valores sincronizados')
      } catch {
        // Ignore malformed storage events.
      }
    }
    window.addEventListener('storage', syncPricingCatalog)
    return () => window.removeEventListener('storage', syncPricingCatalog)
  }, [])

  useEffect(() => {
    const warnBeforeUnload = (event) => {
      if (!pricingDirty) return
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', warnBeforeUnload)
    return () => window.removeEventListener('beforeunload', warnBeforeUnload)
  }, [pricingDirty])

  useEffect(() => {
    requestDeleteConfirmation = (label) => new Promise((resolve) => {
      deletePromptResolver.current = resolve
      setDeletePrompt({
        title: 'Eliminar',
        body: `Seguro que queres eliminar ${label}?`,
      })
    })
    return () => {
      requestDeleteConfirmation = null
    }
  }, [])

  const handleSavePricingCatalog = () => {
    savePricingCatalog(pricingCatalog)
    savedPricingCatalog.current = pricingCatalog
    setPricingDirty(false)
    setPricingStatus(`Guardado ${new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}`)
    if (isCloudStorageEnabled()) {
      saveSharedPricingCatalog(pricingCatalog)
        .then(() => setCloudStatus('Nube sincronizada'))
        .catch(() => setCloudStatus('No se pudo guardar en nube'))
    }
  }

  const resolvePricingPrompt = (result) => {
    pricingPromptResolver.current?.(result)
    pricingPromptResolver.current = null
    setPricingPrompt(null)
  }

  const requestPricingPrompt = () => new Promise((resolve) => {
    pricingPromptResolver.current = resolve
    setPricingPrompt({
      title: 'Cambios sin guardar',
      body: 'Aceptar guarda los cambios y continua. Cancelar descarta los ajustes nuevos, vuelve a los valores anteriores y continua.',
    })
  })

  const confirmPricingNavigation = async () => {
    if (!pricingDirty) return true
    const action = await requestPricingPrompt()
    if (action === 'save') {
      handleSavePricingCatalog()
      return true
    }
    if (action === 'discard') {
      setPricingCatalog(savedPricingCatalog.current)
      setPricingDirty(false)
      setPricingStatus('Cambios descartados')
      return true
    }
    return false
  }

  const resolveDeletePrompt = (result) => {
    deletePromptResolver.current?.(result)
    deletePromptResolver.current = null
    setDeletePrompt(null)
  }

  const goToSection = async (nextSection) => {
    if (section === 'admin' && nextSection !== 'admin' && !(await confirmPricingNavigation())) return
    setWizardActive(false)
    setSection(nextSection)
  }

  const handleLogin = (username, password) => {
    const normalized = username.trim().toLowerCase()
    const credentials = appUsers[normalized]
    if (!credentials || credentials.password !== password.trim().toLowerCase()) {
      setLoginError('Credenciales invalidas para BANI PRESU.')
      return
    }
    const nextSession = {
      username: normalized,
      role: credentials.role,
      label: credentials.label,
      loggedAt: new Date().toISOString(),
    }
    setLoginError('')
    setSession(nextSession)
    saveSession(nextSession)
    setSection('projects')
  }

  const handleLogout = async () => {
    if (!(await confirmPricingNavigation())) return
    clearSession()
    setSession(null)
    setSection('projects')
    setWizardActive(false)
    setWizardStep(0)
  }

  const updateBudget = (patch) => {
    setBudgets((items) =>
      items.map((item) =>
        item.id === budget.id ? { ...item, ...patch, updatedAt: new Date().toISOString() } : item,
      ),
    )
  }

  const updateNested = (key, patch) => updateBudget({ [key]: { ...budget[key], ...patch } })

  const updateRow = (collection, id, patch) => {
    updateBudget({
      [collection]: budget[collection].map((row) => (row.id === id ? { ...row, ...patch } : row)),
    })
  }

  const removeRow = async (collection, id) => {
    if (!(await confirmDelete('esta fila'))) return
    updateBudget({ [collection]: budget[collection].filter((row) => row.id !== id) })
  }

  const startNewBudget = async () => {
    if (section === 'admin' && !(await confirmPricingNavigation())) return
    const fresh = { ...createBudget(), currency: budget?.currency || 'USD' }
    setBudgets((items) => [fresh, ...items])
    setCurrentId(fresh.id)
    setWizardActive(true)
    setWizardStep(0)
    setSection('dashboard')
  }

  const openWizardForBudget = async (id) => {
    if (section === 'admin' && !(await confirmPricingNavigation())) return
    setCurrentId(id)
    setWizardActive(true)
    setWizardStep(0)
    setSection('dashboard')
  }

  const openProjectModule = async (id, nextSection) => {
    if (section === 'admin' && !(await confirmPricingNavigation())) return
    setCurrentId(id)
    setWizardActive(false)
    setSection(nextSection)
  }

  const duplicateBudget = async (source = budget) => {
    if (section === 'admin' && !(await confirmPricingNavigation())) return
    const clone = {
      ...source,
      id: crypto.randomUUID(),
      projectName: `${source.projectName} copia`,
      budgetNumber: `${source.budgetNumber}-COPY`,
      updatedAt: new Date().toISOString(),
    }
    setBudgets((items) => [clone, ...items])
    setCurrentId(clone.id)
    goToSection('projects')
  }

  const deleteBudget = async (id) => {
    if (!(await confirmDelete('este presupuesto'))) return
    if (budgets.length === 1) {
      const fresh = createBudget()
      setBudgets([fresh])
      setCurrentId(fresh.id)
      return
    }
    const next = budgets.filter((item) => item.id !== id)
    setBudgets(next)
    if (id === currentId) setCurrentId(next[0].id)
  }

  const exportImage = async () => {
    const canvas = await html2canvas(exportRef.current, { backgroundColor: budget.brandSettings.backgroundColor, scale: 2 })
    const link = document.createElement('a')
    link.download = `${budget.budgetNumber}-${budget.projectName || 'presupuesto'}.png`
    link.href = canvas.toDataURL('image/png')
    link.click()
  }

  const exportPdf = async () => {
    const canvas = await html2canvas(exportRef.current, { backgroundColor: budget.brandSettings.backgroundColor, scale: 2 })
    const img = canvas.toDataURL('image/png')
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'px', format: [canvas.width, canvas.height] })
    pdf.addImage(img, 'PNG', 0, 0, canvas.width, canvas.height)
    pdf.save(`${budget.budgetNumber}-${budget.projectName || 'presupuesto'}.pdf`)
  }

  if (!session) {
    return <LoginScreen onLogin={handleLogin} loginError={loginError} />
  }

  return (
    <>
      <div className="app-shell" style={{ '--brand': budget.brandSettings.primaryColor, '--accent': budget.brandSettings.secondaryColor }}>
        <aside className="sidebar">
          <div className="brand-lockup">
            <img src={budget.brandSettings.logo || `${assetBase}logo.png`} alt="BANI VFX" />
            <div>
              <strong>LAB</strong>
              <span>Layout, Assets & Budget</span>
            </div>
          </div>
          <nav>
            {visibleNavItems.map(([id, label]) => (
              <button key={id} className={section === id ? 'active' : ''} onClick={() => goToSection(id)}>
                {label}
              </button>
            ))}
          </nav>
          {wizardActive && <WizardStepNav wizardStep={wizardStep} setWizardStep={setWizardStep} />}
          {(wizardActive || ['projects', 'dashboard'].includes(section)) && (
            <div className="side-total">
              <span>Total final</span>
              <strong>{money(totals.totalFinal, budget.currency)}</strong>
            </div>
          )}
        </aside>

        <main>
          <header className="topbar">
            <div>
              <p className="eyebrow">{budget.budgetNumber} / {budget.version}</p>
              <h1>{budget.projectName}</h1>
            </div>
            <div className="toolbar">
              <span className={`cloud-pill ${isCloudStorageEnabled() ? 'online' : ''}`}>{cloudStatus}</span>
              <SessionPanel session={session} onLogout={handleLogout} />
            </div>
          </header>

          {wizardActive && (
            <ProducerWizard
              budget={budget}
              totals={totals}
              wizardStep={wizardStep}
              setWizardStep={setWizardStep}
              setWizardActive={setWizardActive}
              pricingCatalog={pricingCatalog}
              updateBudget={updateBudget}
              updateNested={updateNested}
              updateRow={updateRow}
              removeRow={removeRow}
              exportRef={exportRef}
              exportImage={exportImage}
              exportPdf={exportPdf}
            />
          )}
          {!wizardActive && section === 'projects' && <ProjectsHub budgets={budgets} currentId={currentId} setCurrentId={setCurrentId} deleteBudget={deleteBudget} onNewBudget={startNewBudget} onOpenBudget={openWizardForBudget} onOpenCalendar={(id) => openProjectModule(id, 'calendars')} onOpenMessages={(id) => openProjectModule(id, 'messages')} />}
          {!wizardActive && section === 'dashboard' && <Dashboard budgets={budgets} currentId={currentId} setCurrentId={setCurrentId} deleteBudget={deleteBudget} duplicateBudget={duplicateBudget} setSection={goToSection} onNewBudget={startNewBudget} onOpenWizard={openWizardForBudget} isAdmin={false} />}
          {!wizardActive && section === 'calendars' && <CalendarsWorkspace budgets={budgets} currentId={currentId} setCurrentId={setCurrentId} budget={budget} updateBudget={updateBudget} onNewBudget={startNewBudget} />}
          {!wizardActive && section === 'messages' && <MessagesSection messagesState={messagesState} setMessagesState={setMessagesState} currentBudget={budget} />}
          {!wizardActive && isAdmin && section === 'brand' && <BrandSection budget={budget} updateNested={updateNested} />}
          {!wizardActive && isAdmin && section === 'admin' && <AdminSection pricingCatalog={pricingCatalog} setPricingCatalog={setPricingCatalog} markDirty={() => setPricingDirty(true)} onSave={handleSavePricingCatalog} pricingDirty={pricingDirty} pricingStatus={pricingStatus} />}
        </main>
      </div>
      {pricingPrompt && <PricingPromptModal prompt={pricingPrompt} onSave={() => resolvePricingPrompt('save')} onDiscard={() => resolvePricingPrompt('discard')} />}
      {deletePrompt && <DeleteConfirmModal prompt={deletePrompt} onConfirm={() => resolveDeletePrompt(true)} onCancel={() => resolveDeletePrompt(false)} />}
    </>
  )
}

function PricingPromptModal({ prompt, onSave, onDiscard }) {
  return (
    <div className="modal-backdrop" role="presentation">
      <div className="bani-modal" role="dialog" aria-modal="true" aria-labelledby="pricing-prompt-title">
        <p className="eyebrow">Base de costos</p>
        <h2 id="pricing-prompt-title">{prompt.title}</h2>
        <p>{prompt.body}</p>
        <div className="modal-actions">
          <button className="primary" onClick={onSave}>Aceptar</button>
          <button className="ghost" onClick={onDiscard}>Cancelar</button>
        </div>
      </div>
    </div>
  )
}

function DeleteConfirmModal({ prompt, onConfirm, onCancel }) {
  return (
    <div className="modal-backdrop" role="presentation">
      <div className="bani-modal delete-modal" role="dialog" aria-modal="true" aria-labelledby="delete-prompt-title">
        <p className="eyebrow">Confirmar accion</p>
        <h2 id="delete-prompt-title">{prompt.title}</h2>
        <p>{prompt.body}</p>
        <div className="modal-actions">
          <button className="primary danger-action" onClick={onConfirm}>Eliminar</button>
          <button className="ghost" onClick={onCancel}>Cancelar</button>
        </div>
      </div>
    </div>
  )
}

function WizardStepNav({ wizardStep, setWizardStep }) {
  return (
    <div className="sidebar-wizard">
      <p className="eyebrow">Etapas presupuesto</p>
      <div className="sidebar-wizard-steps">
        {wizardSteps.map((label, index) => (
          <button key={label} className={index === wizardStep ? 'active' : index < wizardStep ? 'done' : ''} onClick={() => setWizardStep(index)}>
            <span>{index + 1}</span>
            {label}
          </button>
        ))}
      </div>
    </div>
  )
}

function SessionPanel({ session, onLogout }) {
  return (
    <div className="session-panel">
      <a href="https://www.instagram.com/banivfx/" target="_blank" rel="noreferrer" title="Instagram BANI VFX"><InstagramIcon /></a>
      <a href="https://www.youtube.com/c/BANIVFX" target="_blank" rel="noreferrer" title="YouTube BANI VFX"><YoutubeIcon /></a>
      <a href="https://www.bani-vfx.com" target="_blank" rel="noreferrer" title="Web BANI VFX"><Globe size={16} /></a>
      <div className="session-user">
        <img src={`${assetBase}avatar.png`} alt="BANI VFX" />
        <div>
          <strong>{session.username === 'crew' ? 'BANIVFX' : session.username}</strong>
          <small>{session.label}</small>
        </div>
      </div>
      <div className="session-divider" />
      <button onClick={onLogout} title="Cerrar sesion"><LogOut size={16} /></button>
    </div>
  )
}

function InstagramIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
      <rect x="4" y="4" width="16" height="16" rx="5" fill="none" stroke="currentColor" strokeWidth="2" />
      <circle cx="12" cy="12" r="3.5" fill="none" stroke="currentColor" strokeWidth="2" />
      <circle cx="17" cy="7" r="1.2" fill="currentColor" />
    </svg>
  )
}

function YoutubeIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" aria-hidden="true">
      <rect x="3" y="6" width="18" height="12" rx="4" fill="none" stroke="currentColor" strokeWidth="2" />
      <path d="M10 9.5v5l5-2.5-5-2.5Z" fill="currentColor" />
    </svg>
  )
}

function LoginScreen({ onLogin, loginError }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')

  return (
    <div className="login-screen">
      <div className="login-shell">
        <div className="login-logo">
          <img src={`${assetBase}logo.png`} alt="BANI VFX" />
          <span>LAB - Layout, Assets & Budget</span>
        </div>
        <form className="login-card" onSubmit={(event) => { event.preventDefault(); onLogin(username, password) }}>
          <div className="login-line" />
          <h1><Lock size={22} /> Acceso Presu</h1>
          <label>
            <span>Usuario</span>
            <input value={username} onChange={(event) => setUsername(event.target.value)} autoFocus placeholder="admin o crew" />
          </label>
          <label>
            <span>Contrasena</span>
            <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="********" />
          </label>
          {loginError && <div className="login-error">{loginError}</div>}
          <button type="submit">Iniciar sesion</button>
          <div className="login-secure">
            <ShieldCheck size={13} />
            <span>Acceso interno BANI VFX</span>
          </div>
        </form>
      </div>
    </div>
  )
}

const wizardSteps = [
  'Cliente',
  'Tipo',
  'Desglose',
  'Resumen',
  'Export',
]

function ProducerWizard({ budget, totals, wizardStep, setWizardStep, setWizardActive, pricingCatalog, updateBudget, updateNested, updateRow, removeRow, exportRef, exportImage, exportPdf }) {
  const goNext = () => setWizardStep((step) => Math.min(step + 1, wizardSteps.length - 1))
  const goBack = () => setWizardStep((step) => Math.max(step - 1, 0))

  return (
    <div className="wizard-shell">
      <div className="wizard-header">
        <div>
          <p className="eyebrow">Armado guiado</p>
          <h2>{wizardSteps[wizardStep]}</h2>
        </div>
        <button className="ghost" onClick={() => setWizardActive(false)}>Volver a presupuestos</button>
      </div>

      {wizardStep === 0 && <ProjectSection budget={budget} updateBudget={updateBudget} updateNested={updateNested} showBudgetType={false} producerMode />}
      {wizardStep === 1 && <BudgetTypeStep budget={budget} pricingCatalog={pricingCatalog} updateBudget={updateBudget} />}
      {wizardStep === 2 && <ProjectBreakdownStep budget={budget} pricingCatalog={pricingCatalog} updateNested={updateNested} updateRow={updateRow} removeRow={removeRow} updateBudget={updateBudget} />}
      {wizardStep === 3 && <SummarySection budget={budget} totals={totals} updateNested={updateNested} isAdmin={false} />}
      {wizardStep === 4 && <ExportSection budget={budget} totals={totals} pricingCatalog={pricingCatalog} updateNested={updateNested} exportRef={exportRef} exportImage={exportImage} exportPdf={exportPdf} />}

      <div className="wizard-footer">
        <button className="ghost" onClick={goBack} disabled={wizardStep === 0}>Anterior</button>
        {wizardStep < wizardSteps.length - 1 ? (
          <button className="primary" onClick={goNext}>Siguiente</button>
        ) : (
          <button className="primary" onClick={() => setWizardActive(false)}>Terminar</button>
        )}
      </div>
    </div>
  )
}

function BudgetTypeStep({ budget, pricingCatalog, updateBudget }) {
  return (
    <section className="panel">
      <SectionTitle icon={<Sparkles />} eyebrow="Tipo de presupuesto" title="Elegi como queres armarlo" />
      <div className="type-choice-grid">
        <button className={budget.budgetMode === 'Detallado' ? 'selected' : ''} onClick={() => updateBudget({ budgetMode: 'Detallado', productionSpecs: { ...budget.productionSpecs, flowType: '' } })}>
          <strong>Detallado</strong>
          <span>Para desglosar tareas, planos, responsables y cantidades.</span>
        </button>
        <button className={budget.budgetMode === 'Ballpark' && budget.productionSpecs?.flowType !== 'preset' ? 'selected' : ''} onClick={() => updateBudget({ budgetMode: 'Ballpark', productionSpecs: { ...budget.productionSpecs, flowType: '', presetName: '' }, ballparkItems: budget.ballparkItems.filter((item) => item.sourceType === 'ballparkDayRate') })}>
          <strong>Ballpark</strong>
          <span>Para una estimacion rapida con partidas grandes.</span>
        </button>
        <button className={budget.productionSpecs?.flowType === 'preset' ? 'selected' : ''} onClick={() => updateBudget({ budgetMode: 'Ballpark', productionSpecs: { ...budget.productionSpecs, flowType: 'preset' }, ballparkItems: [] })}>
          <strong>Preset definido</strong>
          <span>Arranca desde partidas precargadas por Admin y ajusta cantidades.</span>
        </button>
      </div>
    </section>
  )
}

function CalendarsWorkspace({ budgets, currentId, setCurrentId, budget, updateBudget, onNewBudget }) {
  return (
    <div className="workspace-section">
      <div className="dashboard-heading calendar-dashboard-heading">
        <SectionTitle icon={<CalendarDays />} eyebrow="Coordinacion de post" title="Calendarios" />
        <button className="primary" onClick={onNewBudget}><Plus size={16} /> Nuevo proyecto</button>
      </div>
      <div className="calendar-project-switcher panel">
        <div>
          <p className="eyebrow">Proyecto activo</p>
          <h3>{budget.projectName}</h3>
        </div>
        <Select
          label="Cambiar proyecto"
          value={currentId}
          options={budgets.map((item) => item.id)}
          labels={Object.fromEntries(budgets.map((item) => [item.id, `${item.projectName} - ${item.budgetNumber}`]))}
          onChange={setCurrentId}
        />
      </div>
      <CalendarPlannerSection budget={budget} updateBudget={updateBudget} />
    </div>
  )
}

function MessagesSection({ messagesState, setMessagesState, currentBudget }) {
  const [copied, setCopied] = useState(false)
  const templates = messagesState.templates
  const selectedTemplate = templates.find((template) => template.id === messagesState.selectedId) || templates[0]
  const fields = messagesState.fields
  const status = messageStatusOptions.find((item) => item.key === fields.statusKey) || messageStatusOptions[0]
  const preview = renderMessageTemplate(selectedTemplate.body, { ...fields, status: status.es })
  const updateFields = (patch) => setMessagesState((state) => ({ ...state, fields: { ...state.fields, ...patch } }))
  const updateTemplate = (patch) => setMessagesState((state) => ({
    ...state,
    templates: state.templates.map((template) => (template.id === selectedTemplate.id ? { ...template, ...patch } : template)),
  }))
  const addTemplate = () => {
    const next = {
      id: crypto.randomUUID(),
      title: 'Nuevo mensaje',
      category: 'Personalizado',
      channel: 'WhatsApp',
      tone: 'Neutro',
      body: 'Hola {client}, como estas?\n\n{project} / {piece}: {status}.\n\n{nextStep}\n\n{sender}',
    }
    setMessagesState((state) => ({ ...state, selectedId: next.id, templates: [next, ...state.templates] }))
  }
  const deleteTemplate = async () => {
    if (templates.length <= 1 || !(await confirmDelete('esta plantilla'))) return
    const nextTemplates = templates.filter((template) => template.id !== selectedTemplate.id)
    setMessagesState((state) => ({ ...state, templates: nextTemplates, selectedId: nextTemplates[0].id }))
  }
  const copyMessage = async () => {
    await navigator.clipboard.writeText(preview)
    setCopied(true)
    setMessagesState((state) => ({
      ...state,
      history: [{
        id: crypto.randomUUID(),
        template: selectedTemplate.title,
        client: fields.client,
        project: fields.project,
        copiedAt: new Date().toISOString(),
      }, ...state.history].slice(0, 12),
    }))
    window.setTimeout(() => setCopied(false), 1400)
  }
  const loadCurrentProject = () => {
    updateFields({
      client: currentBudget.client || currentBudget.finalClient || fields.client,
      project: currentBudget.projectName || fields.project,
      piece: currentBudget.productionSpecs?.deliverables || fields.piece,
    })
  }

  return (
    <div className="messages-section">
      <div className="dashboard-heading">
        <SectionTitle icon={<MessageSquareText />} eyebrow="Coordinacion de post" title="Mensajes" />
        <div className="toolbar">
          <button className="ghost" onClick={loadCurrentProject}><RotateCcw size={16} /> Usar proyecto activo</button>
          <button className="ghost" onClick={addTemplate}><Plus size={16} /> Nuevo mensaje</button>
          <button className="primary" onClick={copyMessage}><Copy size={16} /> {copied ? 'Copiado' : 'Copiar'}</button>
        </div>
      </div>
      <section className="messages-grid">
        <div className="panel composer-panel">
          <SectionTitle icon={<Grid3X3 />} eyebrow="Variables" title="Datos del envio" />
          <div className="form-grid">
            <Input label="Cliente" value={fields.client} onChange={(v) => updateFields({ client: v })} />
            <Input label="Proyecto" value={fields.project} onChange={(v) => updateFields({ project: v })} />
            <Input label="Pieza / video" value={fields.piece} onChange={(v) => updateFields({ piece: v })} />
            <Select label="Estado" value={fields.statusKey} options={messageStatusOptions.map((item) => item.key)} labels={Object.fromEntries(messageStatusOptions.map((item) => [item.key, item.es]))} onChange={(v) => updateFields({ statusKey: v })} />
            <Input label="Fecha estimada" value={fields.deliveryDate} onChange={(v) => updateFields({ deliveryDate: v })} />
            <Input label="Vuelta" value={fields.reviewRound} onChange={(v) => updateFields({ reviewRound: v })} />
            <Input label="Link" value={fields.link} onChange={(v) => updateFields({ link: v })} />
            <Input label="Firma" value={fields.sender} onChange={(v) => updateFields({ sender: v })} />
          </div>
          <div className="two-col">
            <Textarea label="Notas para cliente" value={fields.notes} onChange={(v) => updateFields({ notes: v })} />
            <Textarea label="Proximo paso" value={fields.nextStep} onChange={(v) => updateFields({ nextStep: v })} />
          </div>
        </div>
        <div className="panel preview-panel">
          <SectionTitle icon={<Send />} eyebrow="Preview" title={selectedTemplate.title} />
          <div className="message-preview">{preview}</div>
          <div className="quick-actions">
            <a className="ghost" href={`mailto:?subject=${encodeURIComponent(`${fields.project} - ${fields.piece}`)}&body=${encodeURIComponent(preview)}`}><Mail size={16} /> Mail</a>
            <a className="ghost" href={`https://wa.me/?text=${encodeURIComponent(preview)}`} target="_blank" rel="noreferrer"><MessageSquareText size={16} /> WhatsApp</a>
          </div>
        </div>
      </section>
      <section className="messages-grid lower-grid">
        <div className="panel template-editor">
          <div className="dashboard-heading">
            <SectionTitle icon={<Sparkles />} eyebrow="Plantilla" title="Texto preestablecido" />
            <IconButton icon={<Trash2 size={15} />} onClick={deleteTemplate} title="Eliminar plantilla" disabled={templates.length <= 1} />
          </div>
          <div className="form-grid compact">
            <Select label="Plantilla activa" value={selectedTemplate.id} options={templates.map((template) => template.id)} labels={Object.fromEntries(templates.map((template) => [template.id, template.title]))} onChange={(id) => setMessagesState((state) => ({ ...state, selectedId: id }))} />
            <Input label="Titulo" value={selectedTemplate.title} onChange={(v) => updateTemplate({ title: v })} />
            <Input label="Categoria" value={selectedTemplate.category} onChange={(v) => updateTemplate({ category: v })} />
            <Input label="Canal" value={selectedTemplate.channel} onChange={(v) => updateTemplate({ channel: v })} />
          </div>
          <Textarea label="Cuerpo del mensaje" value={selectedTemplate.body} onChange={(v) => updateTemplate({ body: v })} />
          <p className="token-help">Variables: {'{client}'} {'{project}'} {'{piece}'} {'{status}'} {'{deliveryDate}'} {'{reviewRound}'} {'{link}'} {'{notes}'} {'{nextStep}'} {'{sender}'}</p>
        </div>
        <div className="panel history-panel">
          <SectionTitle icon={<Copy />} eyebrow="Registro compartido" title="Ultimos copiados" />
          <div className="history-list">
            {messagesState.history.length ? messagesState.history.map((item) => (
              <div className="history-item" key={item.id}>
                <strong>{item.template}</strong>
                <span>{item.client} - {item.project}</span>
                <small>{new Date(item.copiedAt).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' })}</small>
              </div>
            )) : (
              <div className="empty-state">
                <strong>Sin mensajes copiados</strong>
                <p>Cuando copies un mensaje queda aca como referencia rapida para el equipo.</p>
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  )
}

function renderMessageTemplate(template, fields) {
  return template.replace(/\{(\w+)\}/g, (_, key) => fields[key] || '')
}

function ProjectBreakdownStep({ budget, pricingCatalog, updateNested, updateRow, removeRow, updateBudget }) {
  const specs = budget.productionSpecs || {}
  const isBallpark = budget.budgetMode === 'Ballpark' || budget.budgetMode === 'Ambos'
  const isDetailed = budget.budgetMode === 'Detallado' || budget.budgetMode === 'Ambos'

  if (specs.flowType === 'preset') {
    return <PresetModelStep budget={budget} pricingCatalog={pricingCatalog} updateBudget={updateBudget} />
  }

  if (isBallpark) {
    return (
      <div className="wizard-stack">
        <BallparkSection budget={budget} isAdmin={false} pricingCatalog={pricingCatalog} updateRow={updateRow} removeRow={removeRow} updateBudget={updateBudget} />
      </div>
    )
  }

  return (
    <div className="wizard-stack">
      <section className="panel">
        <SectionTitle icon={<Grid3X3 />} eyebrow="Datos de produccion" title="Desglose del proyecto" />
        <div className="form-grid">
          <Input label="Duracion del video" value={specs.videoDuration || ''} onChange={(v) => updateNested('productionSpecs', { videoDuration: v })} />
          <Input label="Cantidad de shots" value={specs.shotCount || ''} onChange={(v) => updateNested('productionSpecs', { shotCount: v })} />
          <Input label="Formatos / entregables" value={specs.deliveryFormats || ''} onChange={(v) => updateNested('productionSpecs', { deliveryFormats: v })} />
          <Select label="Complejidad" value={specs.complexity || 'Media'} options={['Baja', 'Media', 'Alta']} onChange={(v) => updateNested('productionSpecs', { complexity: v })} />
        </div>
      </section>
      {isDetailed && <DetailedSection budget={budget} isAdmin={false} pricingCatalog={pricingCatalog} updateRow={updateRow} removeRow={removeRow} updateBudget={updateBudget} />}
    </div>
  )
}

function PresetModelStep({ budget, pricingCatalog, updateBudget }) {
  const applyPreset = (preset) => {
    updateBudget({
      budgetMode: 'Ballpark',
      productionSpecs: {
        ...budget.productionSpecs,
        flowType: '',
        presetName: preset.name,
        commercialTitle: preset.name,
        development: preset.description,
      },
      ballparkItems: [createBallparkItem(preset)],
    })
  }

  return (
    <section className="panel">
      <SectionTitle icon={<Sparkles />} eyebrow="Presets proyectos" title="Elegir presupuesto base" />
      <div className="preset-model-grid">
        {(pricingCatalog.ballpark?.length ? pricingCatalog.ballpark : defaultPricingCatalog.ballpark).map((preset, index) => (
          <button key={preset.id} className={budget.productionSpecs?.presetName === preset.name ? 'selected' : ''} onClick={() => applyPreset(preset)}>
            <strong>{preset.name}</strong>
            <span>{preset.description}</span>
            <small>Copiar preset {index + 1}</small>
          </button>
        ))}
      </div>
    </section>
  )
}

function BallparkProposalStep({ budget, updateNested }) {
  const specs = budget.productionSpecs || {}
  const includedWorks = specs.includedWorks?.length ? specs.includedWorks : defaultIncludedWorks
  const updateSpec = (patch) => updateNested('productionSpecs', patch)
  const updateWork = (id, patch) => {
    updateSpec({
      includedWorks: includedWorks.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    })
  }
  const addWork = () => {
    updateSpec({
      includedWorks: [...includedWorks, { id: crypto.randomUUID(), text: 'Nuevo trabajo incluido', included: true }],
    })
  }
  const removeWork = async (id) => {
    if (!(await confirmDelete('este trabajo incluido'))) return
    updateSpec({
      includedWorks: includedWorks.filter((item) => item.id !== id),
    })
  }

  return (
    <section className="panel">
      <SectionTitle icon={<FileText />} eyebrow="Propuesta Ballpark" title="Contenido para cliente" />
      <div className="form-grid">
        <Input label="Titulo comercial" value={specs.commercialTitle || ''} onChange={(v) => updateSpec({ commercialTitle: v })} />
        <Input label="Cantidad / duracion de piezas" value={specs.pieceSummary || ''} onChange={(v) => updateSpec({ pieceSummary: v })} />
        <Input label="Facturacion" value={specs.billingInfo || ''} onChange={(v) => updateSpec({ billingInfo: v })} />
        <Input label="Condicion de pago" value={specs.paymentTerms || ''} onChange={(v) => updateSpec({ paymentTerms: v })} />
      </div>
      <Textarea label="Desarrollo de la propuesta" value={specs.development || ''} onChange={(v) => updateSpec({ development: v })} />
      <div className="considerations-panel proposal-works">
        <div className="admin-block-header">
          <div>
            <p className="eyebrow">Trabajos de post-produccion</p>
            <h3>Incluidos en esta propuesta</h3>
          </div>
          <button className="add-row" onClick={addWork}><Plus size={16} /> Agregar</button>
        </div>
        <div className="consideration-list">
          {includedWorks.map((item) => (
            <div className="consideration-row" key={item.id}>
              <Check checked={item.included} onChange={(v) => updateWork(item.id, { included: v })} />
              <CellInput value={item.text} onChange={(v) => updateWork(item.id, { text: v })} />
              <IconButton icon={<Trash2 size={15} />} onClick={() => removeWork(item.id)} />
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function ProjectsHub({ budgets, currentId, setCurrentId, deleteBudget, onNewBudget, onOpenBudget, onOpenCalendar, onOpenMessages }) {
  const [query, setQuery] = useState('')

  const projects = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    return budgets
      .filter((item) => {
        if (!normalized) return true
        return [
          item.projectName,
          item.client,
          item.finalClient,
          item.budgetNumber,
          item.budgetMode,
        ].join(' ').toLowerCase().includes(normalized)
      })
      .sort((a, b) => new Date(b.updatedAt || b.date || 0).getTime() - new Date(a.updatedAt || a.date || 0).getTime())
  }, [budgets, query])

  return (
    <section className="projects-hub">
      <div className="dashboard-heading">
        <SectionTitle icon={<Grid3X3 />} eyebrow="Centro de produccion" title="Proyectos" />
        <button className="primary" onClick={onNewBudget}><Plus size={16} /> Nuevo proyecto</button>
      </div>

      <div className="projects-toolbar panel">
        <Input label="Buscar proyecto / cliente / presupuesto" value={query} onChange={setQuery} />
        <div>
          <span>{projects.length} de {budgets.length}</span>
          <strong>Primero presupuesto, despues calendario y seguimiento.</strong>
        </div>
      </div>

      <div className="project-grid">
        {projects.map((project) => {
          const totals = calculateBudget(project)
          const isSelected = project.id === currentId
          const calendarItems = project.calendarItems?.length || 0
          const hasCalendar = calendarItems > 0
          return (
            <article key={project.id} className={`project-card ${isSelected ? 'selected' : ''}`} onClick={() => setCurrentId(project.id)}>
              <div className="project-card-head">
                <div>
                  <p className="eyebrow">{project.budgetNumber} / {project.version}</p>
                  <h3>{project.projectName}</h3>
                </div>
                <strong>{money(totals.totalFinal, project.currency)}</strong>
              </div>

              <div className="project-client-line">
                <span>Cliente final: {project.finalClient || '-'}</span>
                <span>Cliente: {project.client || '-'}</span>
              </div>

              <div className="project-status-grid">
                <button className="project-status ready" onClick={(event) => { event.stopPropagation(); onOpenBudget(project.id) }}>
                  <FileText size={16} />
                  <span>Presupuesto</span>
                  <strong>{project.budgetMode || 'Sin tipo'}</strong>
                </button>
                <button className={`project-status ${hasCalendar ? 'ready' : ''}`} onClick={(event) => { event.stopPropagation(); onOpenCalendar(project.id) }}>
                  <CalendarDays size={16} />
                  <span>Calendario</span>
                  <strong>{hasCalendar ? `${calendarItems} items` : 'Pendiente'}</strong>
                </button>
                <button className="project-status" onClick={(event) => { event.stopPropagation(); onOpenMessages(project.id) }}>
                  <MessageSquareText size={16} />
                  <span>Mensajes</span>
                  <strong>Seguimiento</strong>
                </button>
              </div>

              <div className="project-card-footer">
                <button title="Eliminar proyecto" onClick={(event) => { event.stopPropagation(); deleteBudget(project.id) }}><Trash2 size={15} /></button>
              </div>
            </article>
          )
        })}
        {!projects.length && (
          <div className="empty-state">
            <h3>Sin proyectos</h3>
            <p>No hay proyectos que coincidan con la busqueda.</p>
          </div>
        )}
      </div>
    </section>
  )
}

function Dashboard({ budgets, currentId, setCurrentId, deleteBudget, duplicateBudget, setSection, onNewBudget, onOpenWizard, isAdmin = true }) {
  const [filters, setFilters] = useState({
    search: '',
    client: 'Todos',
    dateFrom: '',
    dateTo: '',
    sortBy: 'updatedDesc',
  })

  const clients = useMemo(() => {
    const names = budgets.map((item) => item.client?.trim()).filter(Boolean)
    return ['Todos', ...Array.from(new Set(names)).sort((a, b) => a.localeCompare(b, 'es'))]
  }, [budgets])

  const filteredBudgets = useMemo(() => {
    const query = filters.search.trim().toLowerCase()
    const fromTime = filters.dateFrom ? new Date(`${filters.dateFrom}T00:00:00`).getTime() : null
    const toTime = filters.dateTo ? new Date(`${filters.dateTo}T23:59:59`).getTime() : null

    return budgets
      .filter((item) => {
        const itemDate = item.date ? new Date(`${item.date}T12:00:00`).getTime() : 0
        const searchable = [
          item.projectName,
          item.client,
          item.budgetNumber,
          item.version,
          item.agency,
          item.productionCompany,
          item.owner,
        ].join(' ').toLowerCase()

        if (query && !searchable.includes(query)) return false
        if (filters.client !== 'Todos' && item.client !== filters.client) return false
        if (fromTime && itemDate < fromTime) return false
        if (toTime && itemDate > toTime) return false
        return true
      })
      .sort((a, b) => {
        const totalsA = calculateBudget(a).totalFinal
        const totalsB = calculateBudget(b).totalFinal
        const dateA = new Date(a.date || a.updatedAt || 0).getTime()
        const dateB = new Date(b.date || b.updatedAt || 0).getTime()
        const updatedA = new Date(a.updatedAt || a.date || 0).getTime()
        const updatedB = new Date(b.updatedAt || b.date || 0).getTime()

        switch (filters.sortBy) {
          case 'projectAsc':
            return (a.projectName || '').localeCompare(b.projectName || '', 'es')
          case 'projectDesc':
            return (b.projectName || '').localeCompare(a.projectName || '', 'es')
          case 'clientAsc':
            return (a.client || '').localeCompare(b.client || '', 'es')
          case 'budgetAsc':
            return (a.budgetNumber || '').localeCompare(b.budgetNumber || '', 'es', { numeric: true })
          case 'budgetDesc':
            return (b.budgetNumber || '').localeCompare(a.budgetNumber || '', 'es', { numeric: true })
          case 'dateAsc':
            return dateA - dateB
          case 'dateDesc':
            return dateB - dateA
          case 'amountAsc':
            return totalsA - totalsB
          case 'amountDesc':
            return totalsB - totalsA
          case 'updatedAsc':
            return updatedA - updatedB
          case 'updatedDesc':
          default:
            return updatedB - updatedA
        }
      })
  }, [budgets, filters])

  const updateFilter = (key, value) => setFilters((current) => ({ ...current, [key]: value }))
  const resetFilters = () => setFilters({ search: '', client: 'Todos', dateFrom: '', dateTo: '', sortBy: 'updatedDesc' })

  return (
    <section className="panel">
      <div className="dashboard-heading">
        <SectionTitle icon={<Sparkles />} eyebrow="LocalStorage" title="Presupuestos guardados" />
        <button className="primary" onClick={onNewBudget}><Plus size={16} /> Nuevo proyecto</button>
      </div>
      <div className="dashboard-controls">
        <Input label="Buscar proyecto / cliente / presupuesto" value={filters.search} onChange={(v) => updateFilter('search', v)} />
        <Select label="Cliente" value={filters.client} options={clients} onChange={(v) => updateFilter('client', v)} />
        <Input type="date" label="Desde" value={filters.dateFrom} onChange={(v) => updateFilter('dateFrom', v)} />
        <Input type="date" label="Hasta" value={filters.dateTo} onChange={(v) => updateFilter('dateTo', v)} />
        <Select
          label="Orden"
          value={filters.sortBy}
          options={[
            'updatedDesc',
            'updatedAsc',
            'dateDesc',
            'dateAsc',
            'projectAsc',
            'projectDesc',
            'clientAsc',
            'budgetAsc',
            'budgetDesc',
            'amountDesc',
            'amountAsc',
          ]}
          labels={{
            updatedDesc: 'Ultimos editados',
            updatedAsc: 'Primeros editados',
            dateDesc: 'Fecha: nuevo a viejo',
            dateAsc: 'Fecha: viejo a nuevo',
            projectAsc: 'Proyecto A-Z',
            projectDesc: 'Proyecto Z-A',
            clientAsc: 'Cliente A-Z',
            budgetAsc: 'Presupuesto menor a mayor',
            budgetDesc: 'Presupuesto mayor a menor',
            amountDesc: 'Monto mayor a menor',
            amountAsc: 'Monto menor a mayor',
          }}
          onChange={(v) => updateFilter('sortBy', v)}
        />
        <button className="ghost dashboard-reset" onClick={resetFilters}>Limpiar</button>
      </div>
      <div className="dashboard-result-count">
        <span>{filteredBudgets.length} de {budgets.length} presupuestos</span>
      </div>
      <div className="budget-grid">
        {filteredBudgets.map((item) => {
          const totals = calculateBudget(item)
          return (
            <article key={item.id} className={`budget-card ${item.id === currentId ? 'selected' : ''}`}>
              <div>
                <p className="eyebrow">{item.client || 'Sin cliente'} / {item.budgetMode}</p>
                <h3>{item.projectName}</h3>
                <span>{item.budgetNumber} - {item.version}</span>
              </div>
              <div className="budget-card-meta">
                <span>Fecha: {item.date || '-'}</span>
                <span>Editado: {item.updatedAt ? new Date(item.updatedAt).toLocaleDateString('es-AR') : '-'}</span>
              </div>
              <strong>{money(totals.totalFinal, item.currency)}</strong>
              <div className="row-actions">
                <button title="Editar" onClick={() => { isAdmin ? (setCurrentId(item.id), setSection('project')) : onOpenWizard?.(item.id) }}><Edit3 size={15} /></button>
                {isAdmin && <button title="Duplicar" onClick={() => duplicateBudget(item)}><Copy size={15} /></button>}
                <button title="Eliminar" onClick={() => deleteBudget(item.id)}><Trash2 size={15} /></button>
              </div>
            </article>
          )
        })}
        {!filteredBudgets.length && (
          <div className="empty-state">
            <h3>Sin resultados</h3>
            <p>No hay presupuestos que coincidan con esos filtros.</p>
          </div>
        )}
      </div>
    </section>
  )
}

function ProjectSection({ budget, updateBudget, updateNested, showBudgetType = true, producerMode = false }) {
  const specs = budget.productionSpecs || {}
  const updateSpec = (patch) => updateNested('productionSpecs', patch)

  const setClientLogo = (file) => {
    if (!file) {
      updateBudget({ clientLogo: '' })
      return
    }
    const reader = new FileReader()
    reader.onload = () => updateBudget({ clientLogo: reader.result })
    reader.readAsDataURL(file)
  }

  return (
    <section className="panel">
      <SectionTitle icon={<FileText />} eyebrow="Base del presupuesto" title="Datos del proyecto" />
      <div className="form-grid">
        <Input label="Nombre del proyecto" value={budget.projectName} onChange={(v) => updateBudget({ projectName: v })} />
        <Input label="Cliente" value={budget.client} onChange={(v) => updateBudget({ client: v })} />
        <Input label="Cliente final" value={budget.finalClient || ''} onChange={(v) => updateBudget({ finalClient: v })} />
        <Input label="Nombre cliente para export" value={budget.clientProposalName || ''} onChange={(v) => updateBudget({ clientProposalName: v })} />
        <label className="field">
          <span>Logo cliente para export</span>
          <input type="file" accept="image/*" onChange={(e) => setClientLogo(e.target.files[0])} />
        </label>
        {!producerMode && <Input label="Productora / agencia" value={budget.agency} onChange={(v) => updateBudget({ agency: v })} />}
        {!producerMode && <Input label="Productora" value={budget.productionCompany} onChange={(v) => updateBudget({ productionCompany: v })} />}
        <Input type="date" label="Fecha" value={budget.date} onChange={(v) => updateBudget({ date: v })} />
        <Input label="Numero de presupuesto" value={budget.budgetNumber} onChange={(v) => updateBudget({ budgetNumber: v })} />
        <Input label="Version" value={budget.version} onChange={(v) => updateBudget({ version: v })} />
        {!producerMode && <Input label="Responsable" value={budget.owner} onChange={(v) => updateBudget({ owner: v })} />}
        <Select label="Moneda" value={budget.currency} options={['USD', 'ARS']} onChange={(v) => updateBudget({ currency: v })} />
        <Select label={t(budget, 'language')} value={getLanguage(budget)} options={['es', 'en']} labels={{ es: t(budget, 'spanish'), en: t(budget, 'english') }} onChange={(v) => updateBudget({ language: v })} />
        {showBudgetType && <Select label="Tipo" value={budget.budgetMode} options={['Ballpark', 'Detallado', 'Ambos']} onChange={(v) => updateBudget({ budgetMode: v })} />}
      </div>
      <Textarea label="Descripcion del proyecto" value={specs.projectDescription || ''} onChange={(v) => updateSpec({ projectDescription: v })} />
    </section>
  )
}

function TeamSection({ budget, isAdmin, pricingCatalog, updateRow, removeRow, updateBudget }) {
  const roleOptions = pricingCatalog.roles.map((preset) => preset.role)
  const addPreset = (preset) => updateBudget({ teamMembers: [...budget.teamMembers, createTeamMember(preset)] })
  const updateRole = (row, role) => {
    const preset = pricingCatalog.roles.find((item) => item.role === role)
    updateRow('teamMembers', row.id, {
      role,
      area: preset?.area ?? row.area,
      dayRate: Number(preset?.dayRate ?? row.dayRate),
    })
  }
  const headers = isAdmin
    ? ['Incl.', 'Nombre', 'Rol', 'Area', 'Valor/dia', 'Dias', 'Subtotal', 'Notas', '']
    : ['Incl.', 'Nombre', 'Rol', 'Area', 'Dias', 'Subtotal', 'Notas', '']

  return (
    <CrudSection title="Equipo involucrado" eyebrow={isAdmin ? 'Dias / persona / valores' : 'Dias / persona'} icon={<Grid3X3 />} actions={<PresetButtons presets={pricingCatalog.roles} getLabel={(p) => p.role} onPick={addPreset} />}>
      <EditableTable headers={headers}>
        {budget.teamMembers.map((row) => (
          <tr key={row.id}>
            <td><Check checked={row.included} onChange={(v) => updateRow('teamMembers', row.id, { included: v })} /></td>
            <td><CellInput value={row.name} onChange={(v) => updateRow('teamMembers', row.id, { name: v })} /></td>
            <td><CellSelect value={row.role} options={roleOptions} onChange={(v) => updateRole(row, v)} /></td>
            <td>{isAdmin ? <CellSelect value={row.area} options={areaOptions} onChange={(v) => updateRow('teamMembers', row.id, { area: v })} /> : <span className="locked-value">{row.area}</span>}</td>
            {isAdmin && <td><CellInput type="number" value={row.dayRate} onChange={(v) => updateRow('teamMembers', row.id, { dayRate: Number(v) })} /></td>}
            <td><CellInput type="number" value={row.days} onChange={(v) => updateRow('teamMembers', row.id, { days: Number(v) })} /></td>
            <td className="money-cell">{money(teamSubtotal(row), budget.currency)}</td>
            <td><CellInput value={row.notes} onChange={(v) => updateRow('teamMembers', row.id, { notes: v })} /></td>
            <td><IconButton onClick={() => removeRow('teamMembers', row.id)} icon={<Trash2 size={15} />} /></td>
          </tr>
        ))}
      </EditableTable>
      <button className="add-row" onClick={() => updateBudget({ teamMembers: [...budget.teamMembers, createTeamMember()] })}><Plus size={16} /> Agregar persona</button>
    </CrudSection>
  )
}

function BallparkSection({ budget, isAdmin, pricingCatalog, updateRow, removeRow, updateBudget }) {
  const addPreset = (preset) => updateBudget({ ballparkItems: [...budget.ballparkItems, createBallparkItem(preset)] })
  const dayRates = pricingCatalog.ballparkDayRates?.length ? pricingCatalog.ballparkDayRates : defaultPricingCatalog.ballparkDayRates
  const updateDayRateItem = (rate, quantity) => {
    const nextQuantity = Number(quantity || 0)
    const existing = budget.ballparkItems.find((item) => item.sourceType === 'ballparkDayRate' && item.sourceKey === rate.key)
    const patch = {
      name: `Jornadas ${rate.name}`,
      description: rate.description,
      quantity: nextQuantity,
      unitValue: Number(rate.unitValue || 0),
      included: nextQuantity > 0,
      sourceType: 'ballparkDayRate',
      sourceKey: rate.key,
    }

    if (existing) {
      updateRow('ballparkItems', existing.id, patch)
      return
    }

    updateBudget({
      ballparkItems: [...budget.ballparkItems.filter((item) => item.sourceType === 'ballparkDayRate'), createBallparkItem(patch)],
    })
  }
  const headers = isAdmin
    ? ['Incl.', 'Partida', 'Descripcion', 'Cant.', 'Unitario', 'Subtotal', 'Notas', '']
    : ['Incl.', 'Partida', 'Descripcion', 'Cant.', 'Subtotal', 'Notas', '']

  const daysPanel = (
    <div className="ballpark-days-panel">
      <div>
        <p className="eyebrow">Jornadas por departamento</p>
        <h3>Produccion rapida</h3>
      </div>
      <div className="ballpark-days-grid">
        {dayRates.map((rate) => {
          const item = budget.ballparkItems.find((row) => row.sourceType === 'ballparkDayRate' && row.sourceKey === rate.key)
          return (
            <label className="field" key={rate.key}>
              <span>{rate.name}</span>
              <input type="number" min="0" value={item?.quantity || ''} onChange={(event) => updateDayRateItem(rate, event.target.value)} placeholder="Jornadas" />
              {isAdmin && <small>{money(rate.unitValue, budget.currency)} / jornada</small>}
            </label>
          )
        })}
      </div>
    </div>
  )

  if (!isAdmin) {
    return (
      <section className="panel">
        <SectionTitle icon={<Sparkles />} eyebrow="Ballpark" title="Jornadas estimadas" />
        {daysPanel}
      </section>
    )
  }

  return (
    <CrudSection title="Presupuesto Ballpark" eyebrow={isAdmin ? 'Estimacion rapida / valores' : 'Estimacion rapida'} icon={<Sparkles />} actions={<PresetButtons presets={pricingCatalog.ballpark} getLabel={(p) => p.name} onPick={addPreset} />}>
      {daysPanel}
      <EditableTable headers={headers}>
        {budget.ballparkItems.map((row) => (
          <tr key={row.id}>
            <td><Check checked={row.included} onChange={(v) => updateRow('ballparkItems', row.id, { included: v })} /></td>
            <td><CellInput value={row.name} onChange={(v) => updateRow('ballparkItems', row.id, { name: v })} /></td>
            <td><CellInput value={row.description} onChange={(v) => updateRow('ballparkItems', row.id, { description: v })} /></td>
            <td><CellInput type="number" value={row.quantity} onChange={(v) => updateRow('ballparkItems', row.id, { quantity: Number(v) })} /></td>
            {isAdmin && <td><CellInput type="number" value={row.unitValue} onChange={(v) => updateRow('ballparkItems', row.id, { unitValue: Number(v) })} /></td>}
            <td className="money-cell">{money(lineSubtotal(row), budget.currency)}</td>
            <td><CellInput value={row.notes} onChange={(v) => updateRow('ballparkItems', row.id, { notes: v })} /></td>
            <td><IconButton onClick={() => removeRow('ballparkItems', row.id)} icon={<Trash2 size={15} />} /></td>
          </tr>
        ))}
      </EditableTable>
      <button className="add-row" onClick={() => updateBudget({ ballparkItems: [...budget.ballparkItems, createBallparkItem()] })}><Plus size={16} /> Agregar partida</button>
    </CrudSection>
  )
}

function DetailedSection({ budget, isAdmin, pricingCatalog, updateRow, removeRow, updateBudget }) {
  const roleCatalog = pricingCatalog.roles?.length ? pricingCatalog.roles : defaultPricingCatalog.roles
  const addRoleTask = (role) => updateBudget({
    detailedTasks: [...budget.detailedTasks, createDetailedTask({
      area: role.area,
      taskName: role.role,
      description: `Trabajo de ${role.role}`,
      unit: 'Dia',
      unitValue: Number(role.dayRate || 0),
    })],
  })
  const headers = isAdmin
    ? ['Incl.', 'Area', 'Tarea', 'Descripcion', 'Resp.', 'Cant.', 'Unidad', 'Unitario', 'Estado', 'Subtotal', 'Notas', '']
    : ['Incl.', 'Tarea', 'Descripcion', 'Resp.', 'Cant.', 'Unidad', 'Estado', 'Subtotal', 'Notas', '']

  return (
    <CrudSection title="Presupuesto Detallado" eyebrow={isAdmin ? 'Valores de equipo / detalle' : 'Por rol, shot, entregable o asset'} icon={<BarChart3 />} actions={<PresetButtons presets={roleCatalog} getLabel={(p) => p.role} onPick={addRoleTask} />}>
      {(
        <div className="detailed-planner">
          <button onClick={() => addRoleTask(roleCatalog.find((role) => getRoleSection(role.area) === 'POST') || roleCatalog[0])}>
            <strong>POST</strong>
            <span>Usa roles de Valores de equipo para montaje, color, sonido, produccion y coordinacion.</span>
          </button>
          <button onClick={() => addRoleTask(roleCatalog.find((role) => getRoleSection(role.area) === 'VFX') || roleCatalog[0])}>
            <strong>VFX</strong>
            <span>Agrega una linea basada en roles VFX; despues describis shot, tarea o entregable.</span>
          </button>
          <button onClick={() => addRoleTask(roleCatalog.find((role) => getRoleSection(role.area) === '3D') || roleCatalog[0])}>
            <strong>3D</strong>
            <span>Agrega una linea para assets, modelado, lookdev, animacion, render o integracion.</span>
          </button>
        </div>
      )}
      <EditableTable headers={headers}>
        {budget.detailedTasks.map((row) => (
          <tr key={row.id}>
            <td><Check checked={row.included} onChange={(v) => updateRow('detailedTasks', row.id, { included: v })} /></td>
            {isAdmin && <td><CellInput value={row.area} onChange={(v) => updateRow('detailedTasks', row.id, { area: v })} /></td>}
            <td><CellInput value={row.taskName} onChange={(v) => updateRow('detailedTasks', row.id, { taskName: v })} /></td>
            <td><CellInput value={row.description} onChange={(v) => updateRow('detailedTasks', row.id, { description: v })} /></td>
            <td><CellInput value={row.assignee} onChange={(v) => updateRow('detailedTasks', row.id, { assignee: v })} /></td>
            <td><CellInput type="number" value={row.quantity} onChange={(v) => updateRow('detailedTasks', row.id, { quantity: Number(v) })} /></td>
            <td>{isAdmin ? <CellSelect value={row.unit} options={unitOptions} onChange={(v) => updateRow('detailedTasks', row.id, { unit: v })} /> : <span className="locked-value">{row.unit}</span>}</td>
            {isAdmin && <td><CellInput type="number" value={row.unitValue} onChange={(v) => updateRow('detailedTasks', row.id, { unitValue: Number(v) })} /></td>}
            <td><CellSelect value={row.status} options={statusOptions} onChange={(v) => updateRow('detailedTasks', row.id, { status: v })} /></td>
            <td className="money-cell">{money(lineSubtotal(row), budget.currency)}</td>
            <td><CellInput value={row.notes} onChange={(v) => updateRow('detailedTasks', row.id, { notes: v })} /></td>
            <td className="inline-actions"><IconButton onClick={() => updateBudget({ detailedTasks: [...budget.detailedTasks, { ...row, id: crypto.randomUUID(), taskName: `${row.taskName} copia` }] })} icon={<Copy size={15} />} /><IconButton onClick={() => removeRow('detailedTasks', row.id)} icon={<Trash2 size={15} />} /></td>
          </tr>
        ))}
      </EditableTable>
      <button className="add-row" onClick={() => addRoleTask(roleCatalog[0] || {})}><Plus size={16} /> Agregar tarea</button>
    </CrudSection>
  )
}

function SummarySection({ budget, totals, updateNested, isAdmin = false }) {
  const areaTotals = {
    ...groupTotals(budget, budget.teamMembers, 'area', teamSubtotal),
    ...groupTotals(budget, budget.detailedTasks, 'area', lineSubtotal),
  }
  const peopleTotals = groupTotals(budget, budget.teamMembers, 'role', teamSubtotal)
  const modeData = [
    { name: 'Equipo', value: totals.subtotalTeam },
    { name: 'Ballpark', value: totals.subtotalBallpark },
    { name: 'Detallado', value: totals.subtotalDetailed },
  ].filter((item) => item.value > 0)
  const isBallparkOnly = budget.budgetMode === 'Ballpark'

  return (
    <section className="panel">
      <SectionTitle icon={<BarChart3 />} eyebrow="Calculos automáticos" title="Resumen de costos" />
      {isBallparkOnly && !isAdmin && <BallparkSummary budget={budget} totals={totals} />}
      <div className="summary-layout">
        <FeePanel budget={budget} updateNested={updateNested} />
        <TotalsPanel budget={budget} totals={totals} />
      </div>
      <ConsiderationsPanel budget={budget} updateNested={updateNested} />
      <BillingPanel budget={budget} updateNested={updateNested} />
      {isAdmin && <div className="chart-grid">
        <ChartCard title="Por area" data={chartDataFromTotals(areaTotals)} />
        <ChartCard title="Equipo vs tareas" data={modeData} />
        <ListCard title="Total por persona / rol" totals={peopleTotals} currency={budget.currency} />
      </div>}
    </section>
  )
}

function BillingPanel({ budget, updateNested }) {
  const specs = budget.productionSpecs || {}
  const updateSpec = (patch) => updateNested('productionSpecs', patch)

  return (
    <div className="billing-panel">
      <div className="admin-block-header">
        <div>
          <p className="eyebrow">Export / cliente</p>
          <h3>Facturacion y pago</h3>
        </div>
      </div>
      <div className="two-col">
        <Textarea label="Facturacion" value={specs.billingInfo || ''} onChange={(v) => updateSpec({ billingInfo: v })} />
        <Textarea label="Condicion de pago" value={specs.paymentTerms || ''} onChange={(v) => updateSpec({ paymentTerms: v })} />
      </div>
    </div>
  )
}

function CalendarSection({ budget, updateBudget }) {
  const calendarItems = budget.calendarItems?.length ? budget.calendarItems : []
  const updateCalendarRow = (id, patch) => {
    updateBudget({
      calendarItems: calendarItems.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    })
  }
  const addCalendarRow = (preset = {}) => {
    updateBudget({ calendarItems: [...calendarItems, createCalendarItem(preset)] })
  }
  const removeCalendarRow = async (id) => {
    if (!(await confirmDelete('esta etapa del calendario'))) return
    updateBudget({ calendarItems: calendarItems.filter((item) => item.id !== id) })
  }
  const duplicateCalendarRow = (row) => {
    addCalendarRow({ ...row, phase: `${row.phase} copia` })
  }
  const quickPresets = [
    { phase: 'Kickoff / materiales' },
    { phase: 'Rodaje / soporte VFX' },
    { phase: 'Postproduccion' },
    { phase: 'Revision cliente' },
    { phase: 'Entrega final' },
  ]

  return (
    <section className="panel calendar-panel">
      <div className="admin-block-header">
        <SectionTitle icon={<CalendarDays />} eyebrow="Cronograma del proyecto" title="Calendario personalizado" />
        <button className="add-row" onClick={() => addCalendarRow()}><Plus size={16} /> Agregar etapa</button>
      </div>
      <p className="muted-copy">Armá el calendario propio de este presupuesto. Las fechas quedan guardadas dentro del proyecto.</p>
      <div className="preset-row">
        {quickPresets.map((preset) => <button key={preset.phase} onClick={() => addCalendarRow(preset)}>{preset.phase}</button>)}
      </div>
      <div className="calendar-timeline">
        {calendarItems.filter((item) => item.included).map((item) => (
          <div className="calendar-chip" key={`chip-${item.id}`}>
            <strong>{item.phase}</strong>
            <span>{item.startDate || 'Sin inicio'} - {item.endDate || 'Sin entrega'}</span>
          </div>
        ))}
      </div>
      <div className="table-wrap">
        <EditableTable headers={['Incl.', 'Etapa', 'Responsable', 'Inicio', 'Entrega', 'Estado', 'Notas', '']}>
          {calendarItems.map((row) => (
            <tr key={row.id}>
              <td><Check checked={row.included} onChange={(v) => updateCalendarRow(row.id, { included: v })} /></td>
              <td><CellInput value={row.phase} onChange={(v) => updateCalendarRow(row.id, { phase: v })} /></td>
              <td><CellInput value={row.owner} onChange={(v) => updateCalendarRow(row.id, { owner: v })} /></td>
              <td><CellInput type="date" value={row.startDate} onChange={(v) => updateCalendarRow(row.id, { startDate: v })} /></td>
              <td><CellInput type="date" value={row.endDate} onChange={(v) => updateCalendarRow(row.id, { endDate: v })} /></td>
              <td><CellSelect value={row.status} options={['Pendiente', 'En curso', 'Listo', 'Bloqueado']} onChange={(v) => updateCalendarRow(row.id, { status: v })} /></td>
              <td><CellInput value={row.notes} onChange={(v) => updateCalendarRow(row.id, { notes: v })} /></td>
              <td className="inline-actions">
                <IconButton title="Duplicar" onClick={() => duplicateCalendarRow(row)} icon={<Copy size={15} />} />
                <IconButton title="Eliminar" onClick={() => removeCalendarRow(row.id)} icon={<Trash2 size={15} />} />
              </td>
            </tr>
          ))}
        </EditableTable>
      </div>
      {!calendarItems.length && (
        <div className="empty-state">
          <h3>Sin etapas</h3>
          <p>Agregá una etapa para empezar a armar el calendario del proyecto.</p>
        </div>
      )}
    </section>
  )
}

const calendarAreaOptions = ['POST', 'VFX', '3D', 'ENTREGAS']
const calendarWeekDays = {
  es: ['Lunes', 'Martes', 'Miercoles', 'Jueves', 'Viernes'],
  en: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
}
const calendarMonthOptions = ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12']
const calendarMonthLabels = {
  es: {
    '01': 'Enero',
    '02': 'Febrero',
    '03': 'Marzo',
    '04': 'Abril',
    '05': 'Mayo',
    '06': 'Junio',
    '07': 'Julio',
    '08': 'Agosto',
    '09': 'Septiembre',
    '10': 'Octubre',
    '11': 'Noviembre',
    '12': 'Diciembre',
  },
  en: {
    '01': 'January',
    '02': 'February',
    '03': 'March',
    '04': 'April',
    '05': 'May',
    '06': 'June',
    '07': 'July',
    '08': 'August',
    '09': 'September',
    '10': 'October',
    '11': 'November',
    '12': 'December',
  },
}
const calendarConsiderations = {
  es: [
    { id: 'calendar-validity-es', text: 'El calendario es orientativo y queda sujeto a la entrega de materiales, aprobaciones y feedback en tiempo.', included: true },
    { id: 'calendar-review-es', text: 'Las fechas pueden ajustarse si cambia el alcance, los entregables o la complejidad de las tareas.', included: true },
    { id: 'calendar-client-es', text: 'Los envios y revisiones con cliente se coordinan segun disponibilidad de ambas partes.', included: false },
  ],
  en: [
    { id: 'calendar-validity-en', text: 'This schedule is indicative and subject to timely delivery of materials, approvals and feedback.', included: true },
    { id: 'calendar-review-en', text: 'Dates may be adjusted if scope, deliverables or task complexity change.', included: true },
    { id: 'calendar-client-en', text: 'Client reviews and deliveries will be coordinated according to both parties availability.', included: false },
  ],
}
const defaultCalendarTaskPresets = {
  es: [
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
  en: [
    'Material download',
    'Project setup',
    'Editing',
    'Internal review',
    'Client delivery',
    'Client feedback',
    'Compositing',
    'Scene tracking',
    '3D layout',
    'Asset modeling',
    'Animation',
    'Render',
    'Color',
    'Sound',
    'Final delivery',
  ],
}

const toDateInputValue = (date) => date.toISOString().slice(0, 10)

function getMonday(value) {
  const base = value ? new Date(`${value}T00:00:00`) : new Date()
  const day = base.getDay()
  const diff = day === 0 ? -6 : 1 - day
  base.setDate(base.getDate() + diff)
  return base
}

function firstMondayOfMonth(monthValue) {
  const [year, month] = (monthValue || new Date().toISOString().slice(0, 7)).split('-').map(Number)
  const date = new Date(year, month - 1, 1)
  while (date.getDay() !== 1) date.setDate(date.getDate() + 1)
  return toDateInputValue(date)
}

function calendarStartDateFromMonthWeek(monthValue, startWeek = 1) {
  const date = new Date(`${firstMondayOfMonth(monthValue)}T00:00:00`)
  date.setDate(date.getDate() + ((Math.max(1, Math.min(5, Number(startWeek || 1))) - 1) * 7))
  return toDateInputValue(date)
}

function normalizeVisibleWeeks(visibleWeeks, startWeek = 1, weeks = 2) {
  if (Array.isArray(visibleWeeks)) {
    return [...new Set(visibleWeeks.map(Number).filter((week) => week >= 1 && week <= 5))].sort((a, b) => a - b)
  }

  const firstWeek = Math.max(1, Math.min(5, Number(startWeek || 1)))
  const count = Math.max(1, Math.min(5, Number(weeks || 2)))
  return Array.from({ length: count }, (_, index) => firstWeek + index).filter((week) => week <= 5)
}

function monthInputFromDate(value) {
  return (value || new Date().toISOString().slice(0, 10)).slice(0, 7)
}

function calendarYearOptions(baseYear = new Date().getFullYear()) {
  return Array.from({ length: 9 }, (_, index) => String(baseYear - 2 + index))
}

function buildCalendarWeeks(startDate, weeks = 2, language = 'es') {
  const monday = getMonday(startDate)
  const labels = calendarWeekDays[language] || calendarWeekDays.es
  return Array.from({ length: Number(weeks || 1) }, (_, weekIndex) => {
    const days = Array.from({ length: 5 }, (_, dayIndex) => {
      const date = new Date(monday)
      date.setDate(monday.getDate() + (weekIndex * 7) + dayIndex)
      return {
        label: labels[dayIndex],
        day: date.getDate(),
        key: toDateInputValue(date),
      }
    })
    days.weekNumber = weekIndex + 1
    return days
  })
}

function buildCalendarMonthWeeks(monthValue, language = 'es') {
  const firstWeekStart = firstMondayOfMonth(monthValue)
  const weeks = buildCalendarWeeks(firstWeekStart, 5, language)
  return weeks.map((week, index) => {
    week.weekNumber = index + 1
    return week
  })
}

function monthNameFromDate(value, language = 'es') {
  const date = value ? new Date(`${value}T00:00:00`) : new Date()
  return date.toLocaleDateString(language === 'en' ? 'en-US' : 'es-AR', { month: 'long' }).toUpperCase()
}

function dominantMonthKeyForWeek(week) {
  const counts = week.reduce((acc, day) => {
    const monthKey = day.key.slice(0, 7)
    acc[monthKey] = (acc[monthKey] || 0) + 1
    return acc
  }, {})
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] || week[0]?.key?.slice(0, 7)
}

function groupWeeksByMonth(weeks, language = 'es') {
  const groups = new Map()

  weeks.forEach((week, index) => {
    const monthKey = dominantMonthKeyForWeek(week)
    const weekNumber = Number(week.weekNumber || index + 1)
    if (!groups.has(monthKey)) {
      groups.set(monthKey, {
        key: monthKey,
        monthKey,
        title: monthNameFromDate(`${monthKey}-01`, language),
        weeks: [],
      })
    }
    groups.get(monthKey).weeks.push({ index: weekNumber, days: week })
  })

  return Array.from(groups.values())
}

function paginateCalendarWeeks(weeks, language = 'es', maxWeeksPerPage = 2) {
  return groupWeeksByMonth(weeks, language).flatMap((group) => {
    const pages = []
    for (let index = 0; index < group.weeks.length; index += maxWeeksPerPage) {
      pages.push({
        key: `${group.key}-${index / maxWeeksPerPage}`,
        title: group.title,
        monthKey: group.key,
        weeks: group.weeks.slice(index, index + maxWeeksPerPage),
      })
    }
    return pages
  })
}

function CalendarPlannerSection({ budget, updateBudget }) {
  const calendarRef = useRef(null)
  const [newTaskPreset, setNewTaskPreset] = useState('')
  const calendarItems = budget.calendarItems?.length ? budget.calendarItems : []
  const calendarLanguage = budget.calendarSettings?.language || getLanguage(budget)
  const savedCalendarConsiderations = budget.calendarSettings?.considerations || []
  const defaultCalendarConsiderations = calendarConsiderations[calendarLanguage] || calendarConsiderations.es
  const shouldUseCalendarDefaults = !savedCalendarConsiderations.length || !savedCalendarConsiderations.some((item) => item.id?.endsWith(calendarLanguage))
  const calendarMonth = budget.calendarSettings?.month || monthInputFromDate(budget.calendarSettings?.startDate || budget.date)
  const calendarStartWeek = Math.max(1, Math.min(5, Number(budget.calendarSettings?.startWeek || 1)))
  const visibleWeeks = normalizeVisibleWeeks(budget.calendarSettings?.visibleWeeks, calendarStartWeek, budget.calendarSettings?.weeks)
  const firstVisibleWeek = visibleWeeks[0] || 1
  const settings = {
    title: budget.calendarSettings?.title || budget.projectName,
    month: calendarMonth,
    startWeek: firstVisibleWeek,
    visibleWeeks,
    startDate: calendarStartDateFromMonthWeek(calendarMonth, firstVisibleWeek),
    weeks: visibleWeeks.length,
    areas: budget.calendarSettings?.areas?.length ? budget.calendarSettings.areas : calendarAreaOptions,
    language: calendarLanguage,
    considerations: shouldUseCalendarDefaults ? defaultCalendarConsiderations : savedCalendarConsiderations,
    taskPresets: budget.calendarSettings?.taskPresets?.length ? budget.calendarSettings.taskPresets : defaultCalendarTaskPresets[calendarLanguage],
  }
  const monthWeeks = buildCalendarMonthWeeks(settings.month, settings.language)
  const weeks = monthWeeks.filter((week) => settings.visibleWeeks.includes(week.weekNumber))
  const updateSettings = (patch) => {
    const nextVisibleWeeks = patch.visibleWeeks
      ? normalizeVisibleWeeks(patch.visibleWeeks, settings.startWeek, settings.weeks)
      : settings.visibleWeeks
    const nextSettings = { ...settings, ...patch, visibleWeeks: nextVisibleWeeks }
    const nextStartWeek = nextVisibleWeeks[0] || 1
    updateBudget({
      calendarSettings: {
        ...nextSettings,
        startWeek: nextStartWeek,
        weeks: nextVisibleWeeks.length,
        startDate: calendarStartDateFromMonthWeek(nextSettings.month, nextStartWeek),
      },
    })
  }
  const updateCalendarMonth = (month) => updateSettings({ month })
  const [selectedYear, selectedMonth] = settings.month.split('-')
  const yearOptions = calendarYearOptions(Number(selectedYear || new Date().getFullYear()))
  const updateCalendarMonthPart = (part, value) => {
    const nextYear = part === 'year' ? value : selectedYear
    const nextMonth = part === 'month' ? value : selectedMonth
    updateCalendarMonth(`${nextYear}-${nextMonth}`)
  }
  const toggleVisibleWeek = (weekNumber) => {
    const nextWeeks = settings.visibleWeeks.includes(weekNumber)
      ? settings.visibleWeeks.filter((week) => week !== weekNumber)
      : [...settings.visibleWeeks, weekNumber].sort((a, b) => a - b)
    updateSettings({ visibleWeeks: nextWeeks })
  }
  const updateCalendarConsideration = (id, patch) => {
    updateSettings({
      considerations: settings.considerations.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    })
  }
  const addCalendarConsideration = () => {
    updateSettings({
      considerations: [...settings.considerations, { id: crypto.randomUUID(), text: settings.language === 'en' ? 'New consideration' : 'Nueva consideracion', included: true }],
    })
  }
  const removeCalendarConsideration = async (id) => {
    if (!(await confirmDelete(settings.language === 'en' ? 'this consideration' : 'esta consideracion'))) return
    updateSettings({ considerations: settings.considerations.filter((item) => item.id !== id) })
  }
  const addTaskPreset = () => {
    const text = newTaskPreset.trim()
    if (!text) return
    updateSettings({ taskPresets: [...settings.taskPresets, text] })
    setNewTaskPreset('')
  }
  const removeTaskPreset = (text) => {
    updateSettings({ taskPresets: settings.taskPresets.filter((item) => item !== text) })
  }
  const findCell = (area, date) => calendarItems.find((item) => item.area === area && item.date === date)
  const updateCell = (area, date, task) => {
    const existing = findCell(area, date)
    if (existing) {
      updateBudget({
        calendarItems: calendarItems.map((item) => (item.id === existing.id ? { ...item, task, included: Boolean(task.trim()) } : item)),
      })
      return
    }
    updateBudget({
      calendarItems: [...calendarItems, createCalendarItem({ area, date, task, included: Boolean(task.trim()) })],
    })
  }
  const appendTaskToCell = (area, date, task) => {
    const current = findCell(area, date)?.task || ''
    const next = current.trim() ? `${current.trim()}\n${task}` : task
    updateCell(area, date, next)
  }
  const moveTaskBetweenCells = ({ sourceArea, sourceDate, targetArea, targetDate, task }) => {
    if (!sourceArea || !sourceDate || !targetArea || !targetDate || (sourceArea === targetArea && sourceDate === targetDate)) return

    const sourceCell = findCell(sourceArea, sourceDate)
    const targetCell = findCell(targetArea, targetDate)
    const movingTask = (task || sourceCell?.task || '').trim()
    if (!movingTask) return

    const targetTask = targetCell?.task?.trim()
    const nextTargetTask = targetTask ? `${targetTask}\n${movingTask}` : movingTask
    let targetUpdated = false

    const nextItems = calendarItems.map((item) => {
      if (item.id === sourceCell?.id) return { ...item, task: '', included: false }
      if (item.id === targetCell?.id) {
        targetUpdated = true
        return { ...item, task: nextTargetTask, included: true }
      }
      return item
    })

    updateBudget({
      calendarItems: targetUpdated
        ? nextItems
        : [...nextItems, createCalendarItem({ area: targetArea, date: targetDate, task: nextTargetTask, included: true })],
    })
  }
  const fillFromBudget = () => {
    const firstWeek = weeks[0] || []
    const firstDay = firstWeek[0]?.key
    const secondDay = firstWeek[1]?.key
    const thirdDay = firstWeek[2]?.key
    const fourthDay = firstWeek[3]?.key
    const lastDay = weeks.at(-1)?.[4]?.key
    const generated = [
      firstDay && createCalendarItem({ area: 'POST', date: firstDay, task: 'Descarga de material\nOrganizacion del proyecto' }),
      secondDay && createCalendarItem({ area: 'POST', date: secondDay, task: budget.budgetMode === 'Ballpark' ? 'Montaje\nRevision interna' : 'Armado offline\nOrganizacion de entregables' }),
      thirdDay && createCalendarItem({ area: 'VFX', date: thirdDay, task: 'Composicion\nTracking de la escena' }),
      thirdDay && createCalendarItem({ area: '3D', date: thirdDay, task: 'Layout 3D\nModelado de elementos' }),
      fourthDay && createCalendarItem({ area: 'ENTREGAS', date: fourthDay, task: 'Revision interna / envio al cliente' }),
      lastDay && createCalendarItem({ area: 'ENTREGAS', date: lastDay, task: 'Entrega final' }),
    ].filter(Boolean)
    updateBudget({ calendarItems: generated })
  }
  const clearCalendar = async () => {
    if (!(await confirmDelete('el calendario completo'))) return
    updateBudget({ calendarItems: [] })
  }
  const removeCalendarWeek = async (weekNumber) => {
    const targetWeek = monthWeeks.find((week) => week.weekNumber === weekNumber)
    const weekDates = (targetWeek || []).map((day) => day.key)
    if (!weekDates.length || !(await confirmDelete('esta semana completa'))) return
    const nextVisibleWeeks = settings.visibleWeeks.filter((week) => week !== weekNumber)
    const nextStartWeek = nextVisibleWeeks[0] || 1
    updateBudget({
      calendarSettings: {
        ...settings,
        startWeek: nextStartWeek,
        visibleWeeks: nextVisibleWeeks,
        weeks: nextVisibleWeeks.length,
        startDate: calendarStartDateFromMonthWeek(settings.month, nextStartWeek),
      },
      calendarItems: calendarItems.filter((item) => !weekDates.includes(item.date)),
    })
  }
  const exportCalendarImage = async () => {
    const canvas = await html2canvas(calendarRef.current, { backgroundColor: '#080808', scale: 2 })
    const link = document.createElement('a')
    link.download = `${budget.budgetNumber}-calendario.png`
    link.href = canvas.toDataURL('image/png')
    link.click()
  }
  const exportCalendarPdf = async () => {
    const pages = Array.from(calendarRef.current.querySelectorAll('.calendar-export-month-page'))
    const targets = pages.length ? pages : [calendarRef.current]
    let pdf = null
    for (const [index, page] of targets.entries()) {
      const canvas = await html2canvas(page, { backgroundColor: '#080808', scale: 2, windowWidth: page.scrollWidth, windowHeight: page.scrollHeight })
      const img = canvas.toDataURL('image/png')
      const orientation = canvas.width >= canvas.height ? 'landscape' : 'portrait'
      if (!pdf) {
        pdf = new jsPDF({ orientation, unit: 'px', format: [canvas.width, canvas.height] })
      } else {
        pdf.addPage([canvas.width, canvas.height], orientation)
      }
      pdf.addImage(img, 'PNG', 0, 0, canvas.width, canvas.height)
      if (index === targets.length - 1) pdf.save(`${budget.budgetNumber}-calendario.pdf`)
    }
  }

  return (
    <section className="panel calendar-panel">
      <div className="admin-block-header">
        <SectionTitle icon={<CalendarDays />} eyebrow="Cronograma del proyecto" title="Calendario personalizado" />
        <div className="inline-actions">
          <button className="primary" onClick={exportCalendarPdf}><FileText size={16} /> PDF</button>
          <button className="primary" onClick={exportCalendarImage}><FileImage size={16} /> PNG</button>
        </div>
      </div>
      <p className="muted-copy calendar-copy">Defini el mes y elegi exactamente que semanas queres usar. La grilla se arma por dias habiles; vos completas las tareas por area.</p>
      <div className="form-grid calendar-settings-grid">
        <Input label="Titulo calendario" value={settings.title} onChange={(v) => updateSettings({ title: v })} />
        <Select label="Mes calendario" value={selectedMonth} options={calendarMonthOptions} labels={calendarMonthLabels[settings.language] || calendarMonthLabels.es} onChange={(v) => updateCalendarMonthPart('month', v)} />
        <Select label="Ano" value={selectedYear} options={yearOptions} onChange={(v) => updateCalendarMonthPart('year', v)} />
        <Select label="Idioma calendario" value={settings.language} options={['es', 'en']} labels={{ es: 'Castellano', en: 'English' }} onChange={(v) => updateSettings({ language: v, considerations: calendarConsiderations[v], taskPresets: defaultCalendarTaskPresets[v] })} />
      </div>
      <div className="calendar-week-selector">
        <div>
          <p className="eyebrow">{settings.language === 'en' ? 'Visible weeks' : 'Semanas visibles'}</p>
          <h3>{settings.language === 'en' ? 'Choose month weeks' : 'Elegir semanas del mes'}</h3>
        </div>
        <div className="calendar-week-toggle-list">
          {monthWeeks.map((week) => (
            <button
              className={settings.visibleWeeks.includes(week.weekNumber) ? 'selected' : ''}
              key={`toggle-week-${week.weekNumber}`}
              onClick={() => toggleVisibleWeek(week.weekNumber)}
            >
              <strong>{settings.language === 'en' ? 'Week' : 'Semana'} {week.weekNumber}</strong>
              <span>{week[0]?.day} - {week[4]?.day}</span>
            </button>
          ))}
        </div>
      </div>
      <div className="calendar-workbench">
        <aside className="calendar-task-bank">
          <div className="calendar-task-bank-header">
            <div>
              <p className="eyebrow">{settings.language === 'en' ? 'Drag & drop' : 'Arrastrar y soltar'}</p>
              <h3>{settings.language === 'en' ? 'Preset tasks' : 'Textos preestablecidos'}</h3>
            </div>
            <div className="task-preset-add">
              <input value={newTaskPreset} onChange={(event) => setNewTaskPreset(event.target.value)} placeholder={settings.language === 'en' ? 'New task' : 'Nuevo texto'} />
              <button className="add-row" onClick={addTaskPreset}><Plus size={16} /> {settings.language === 'en' ? 'Add' : 'Agregar'}</button>
            </div>
          </div>
          <div className="task-preset-list">
            {settings.taskPresets.map((text) => (
              <span
                className="task-preset-chip"
                draggable
                key={text}
                onDragStart={(event) => event.dataTransfer.setData('text/plain', text)}
              >
                {text}
                <button onClick={() => removeTaskPreset(text)} aria-label="Eliminar texto">x</button>
              </span>
            ))}
          </div>
        </aside>
        <div className="calendar-board-column">
          <div className="inline-actions calendar-board-actions">
            <button className="ghost" onClick={fillFromBudget}><Sparkles size={16} /> Armar base automatica</button>
            <button className="ghost" onClick={clearCalendar}><Trash2 size={16} /> Limpiar calendario</button>
          </div>
          <CalendarEditableView
            budget={budget}
            settings={settings}
            weeks={weeks}
            findCell={findCell}
            updateCell={updateCell}
            appendTaskToCell={appendTaskToCell}
            moveTaskBetweenCells={moveTaskBetweenCells}
            onRemoveWeek={removeCalendarWeek}
          />
        </div>
      </div>
      <div className="considerations-panel calendar-considerations">
        <div className="admin-block-header">
          <div>
            <p className="eyebrow">{settings.language === 'en' ? 'Scope / notes' : 'Alcance / notas'}</p>
            <h3>{settings.language === 'en' ? 'Schedule considerations' : 'Consideraciones del calendario'}</h3>
          </div>
          <button className="add-row" onClick={addCalendarConsideration}><Plus size={16} /> {settings.language === 'en' ? 'Add' : 'Agregar'}</button>
        </div>
        <div className="consideration-list">
          {settings.considerations.map((item) => (
            <div className="consideration-row" key={item.id}>
              <Check checked={item.included} onChange={(v) => updateCalendarConsideration(item.id, { included: v })} />
              <CellInput value={item.text} onChange={(v) => updateCalendarConsideration(item.id, { text: v })} />
              <IconButton icon={<Trash2 size={15} />} onClick={() => removeCalendarConsideration(item.id)} />
            </div>
          ))}
        </div>
      </div>
      <CalendarExportView budget={budget} settings={settings} weeks={weeks} calendarItems={calendarItems} exportRef={calendarRef} />
    </section>
  )
}

function CalendarEditableView({ budget, settings, weeks, findCell, updateCell, appendTaskToCell, moveTaskBetweenCells, onRemoveWeek }) {
  const exportPages = paginateCalendarWeeks(weeks, settings.language)
  const dragType = 'application/x-bani-calendar-cell'
  const dropOnCell = (event, area, date) => {
    event.preventDefault()
    event.stopPropagation()
    const draggedCell = event.dataTransfer.getData(dragType)
    if (draggedCell) {
      try {
        moveTaskBetweenCells({ ...JSON.parse(draggedCell), targetArea: area, targetDate: date })
      } catch {
        const text = event.dataTransfer.getData('text/plain')
        if (text) appendTaskToCell(area, date, text)
      }
      return
    }

    const text = event.dataTransfer.getData('text/plain')
    if (text) appendTaskToCell(area, date, text)
  }

  if (!weeks.length) {
    return (
      <div className="calendar-empty-state">
        <strong>{settings.language === 'en' ? 'No weeks selected' : 'No hay semanas seleccionadas'}</strong>
        <span>{settings.language === 'en' ? 'Choose at least one week above to edit the schedule.' : 'Elegi al menos una semana arriba para editar el calendario.'}</span>
      </div>
    )
  }

  return (
    <div className="calendar-export-page calendar-live-preview">
      {exportPages.map((page, pageIndex) => (
        <section className="calendar-export-month-page" key={`editable-${page.key}`}>
          <CalendarMonthHeader budget={budget} settings={settings} monthTitle={page.title} compact={pageIndex > 0} />
          {page.weeks.map(({ days: week, index: weekIndex }) => (
            <div className="calendar-export-week calendar-live-week" key={`editable-week-${page.key}-${weekIndex}`}>
              <div className="calendar-export-brand">
                <span>{settings.language === 'en' ? 'Week' : 'Semana'} {weekIndex}</span>
                <button className="calendar-week-delete" onClick={() => onRemoveWeek(weekIndex)} title={settings.language === 'en' ? 'Remove this week' : 'Quitar esta semana'}>
                  <Trash2 size={13} />
                  <span>{settings.language === 'en' ? 'Remove' : 'Quitar'}</span>
                </button>
              </div>
              <div className="calendar-export-days">
                <span />
                {week.map((day) => <strong key={day.key}>{day.label}<b>{day.day}</b></strong>)}
              </div>
              <div className="calendar-export-grid calendar-edit-export-grid">
                {settings.areas.map((area) => (
                  <Fragment key={`editable-${page.key}-${weekIndex}-${area}`}>
                    <strong>{area}</strong>
                    {week.map((day) => {
                      const cell = findCell(area, day.key)
                      return (
                        <div
                          className={`calendar-cell-editor ${cell?.task?.trim() ? 'has-task' : ''}`}
                          key={`${area}-${day.key}`}
                          onDragOver={(event) => event.preventDefault()}
                          onDrop={(event) => dropOnCell(event, area, day.key)}
                        >
                          {cell?.task?.trim() && (
                            <button
                              type="button"
                              className="calendar-cell-drag"
                              draggable
                              title={settings.language === 'en' ? 'Move text to another cell' : 'Mover texto a otra celda'}
                              onDragStart={(event) => {
                                event.dataTransfer.effectAllowed = 'move'
                                event.dataTransfer.setData(dragType, JSON.stringify({ sourceArea: area, sourceDate: day.key, task: cell.task }))
                                event.dataTransfer.setData('text/plain', cell.task)
                              }}
                            >
                              <GripVertical size={13} />
                            </button>
                          )}
                          <textarea
                            value={cell?.task || ''}
                            onChange={(event) => updateCell(area, day.key, event.target.value)}
                            onDragOver={(event) => event.preventDefault()}
                            onDrop={(event) => dropOnCell(event, area, day.key)}
                            placeholder="-"
                          />
                        </div>
                      )
                    })}
                  </Fragment>
                ))}
              </div>
            </div>
          ))}
        </section>
      ))}
    </div>
  )
}

function CalendarMonthHeader({ budget, settings, monthTitle, compact = false }) {
  const titleLabel = settings.language === 'en' ? 'Schedule' : 'Calendario'
  const finalClientLabel = settings.language === 'en' ? 'Final client' : 'Cliente final'
  const clientLabel = settings.language === 'en' ? 'Client' : 'Cliente'
  const projectTitle = settings.title || budget.projectName

  if (compact) {
    return (
      <header className="calendar-export-month-only">
        <h4>{monthTitle}</h4>
      </header>
    )
  }

  return (
    <header className="calendar-export-header">
      <div className="calendar-export-title">
        <h4>{monthTitle}</h4>
        <h2>{projectTitle}</h2>
        {budget.finalClient && <h3>{finalClientLabel}: {budget.finalClient}</h3>}
        {budget.client && <h3>{clientLabel}: {budget.client}</h3>}
      </div>
      <div className="calendar-export-lockup">
        <img src={`${assetBase}monograma-negativo-perfil.jpg`} alt="BANI VFX" />
        <div>
          <strong>BANI VFX</strong>
          <span>{titleLabel}</span>
        </div>
      </div>
    </header>
  )
}

function CalendarExportView({ budget, settings, weeks, calendarItems, exportRef }) {
  const taskFor = (area, date) => calendarItems.find((item) => item.included && item.area === area && item.date === date)?.task || '-'
  const visibleConsiderations = (settings.considerations || []).filter((item) => item.included && item.text)
  const exportPages = paginateCalendarWeeks(weeks, settings.language)
  const considerationsLabel = settings.language === 'en' ? 'Considerations' : 'Consideraciones'

  return (
    <div className="calendar-export-page" ref={exportRef}>
      {exportPages.map((page, pageIndex) => (
        <section className="calendar-export-month-page" key={page.key}>
          <CalendarMonthHeader budget={budget} settings={settings} monthTitle={page.title} compact={pageIndex > 0} />
          {page.weeks.map(({ days: week, index: weekIndex }) => (
            <div className="calendar-export-week" key={`export-week-${weekIndex}`}>
              <div className="calendar-export-brand">{settings.language === 'en' ? 'Week' : 'Semana'} {weekIndex}</div>
              <div className="calendar-export-days">
                <span />
                {week.map((day) => <strong key={day.key}>{day.label}<b>{day.day}</b></strong>)}
              </div>
              <div className="calendar-export-grid">
                {settings.areas.map((area) => (
                  <Fragment key={`export-${weekIndex}-${area}`}>
                    <strong>{area}</strong>
                    {week.map((day) => <p key={`${area}-${day.key}`}>{taskFor(area, day.key)}</p>)}
                  </Fragment>
                ))}
              </div>
            </div>
          ))}
          {pageIndex === exportPages.length - 1 && !!visibleConsiderations.length && (
            <section className="calendar-export-notes">
              <h3>{considerationsLabel}</h3>
              {visibleConsiderations.map((item) => <p key={item.id}>{item.text}</p>)}
            </section>
          )}
        </section>
      ))}
    </div>
  )
}

function BallparkSummary({ budget, totals }) {
  const dayItems = budget.ballparkItems.filter((item) => item.included && item.sourceType === 'ballparkDayRate' && Number(item.quantity) > 0)

  return (
    <div className="ballpark-summary">
      <div>
        <p className="eyebrow">Incluye</p>
        <h3>Etapas contempladas en el ballpark</h3>
      </div>
      <div className="ballpark-summary-grid">
        {dayItems.map((item) => (
          <div key={item.id}>
            <strong>{item.name.replace('Jornadas ', '')}</strong>
            <span>{item.quantity} jornadas</span>
          </div>
        ))}
        {!dayItems.length && <p>Todavia no hay jornadas cargadas.</p>}
      </div>
      <p className="ballpark-summary-note">Este ballpark contempla una estimacion por etapas de produccion. El detalle fino de tareas, shots, assets y entregables se define en una propuesta integral al confirmar el proyecto.</p>
      <strong className="summary-big-total">{money(totals.totalFinal, budget.currency)}</strong>
    </div>
  )
}

function ConsiderationsPanel({ budget, updateNested }) {
  const isEnglish = getLanguage(budget) === 'en'
  const defaults = budget.budgetMode === 'Ballpark'
    ? (isEnglish ? englishBallparkConsiderations : ballparkConsiderations)
    : (isEnglish ? defaultEnglishConsiderations : defaultConsiderations)
  const savedConsiderations = budget.notes?.considerations || []
  const expectedSuffix = isEnglish ? '-en' : ''
  const shouldUseDefaults = !savedConsiderations.length || (budget.budgetMode === 'Ballpark' && !savedConsiderations.some((item) => item.id?.startsWith('ballpark-') && item.id.endsWith(expectedSuffix)))
  const considerations = shouldUseDefaults ? defaults : savedConsiderations
  const updateConsideration = (id, patch) => {
    updateNested('notes', {
      considerations: considerations.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    })
  }
  const addConsideration = () => {
    updateNested('notes', {
      considerations: [...considerations, { id: crypto.randomUUID(), text: 'Nueva consideracion', included: true }],
    })
  }
  const removeConsideration = async (id) => {
    if (!(await confirmDelete('esta consideracion'))) return
    updateNested('notes', {
      considerations: considerations.filter((item) => item.id !== id),
    })
  }

  return (
    <div className="considerations-panel">
      <div className="admin-block-header">
        <div>
          <p className="eyebrow">Condiciones / alcance</p>
          <h3>Consideraciones para sumar</h3>
        </div>
        <button className="add-row" onClick={addConsideration}><Plus size={16} /> Agregar</button>
      </div>
      <div className="consideration-list">
        {considerations.map((item) => (
          <div className="consideration-row" key={item.id}>
            <Check checked={item.included} onChange={(v) => updateConsideration(item.id, { included: v })} />
            <CellInput value={item.text} onChange={(v) => updateConsideration(item.id, { text: v })} />
            <IconButton icon={<Trash2 size={15} />} onClick={() => removeConsideration(item.id)} />
          </div>
        ))}
      </div>
    </div>
  )
}

const ballparkStageName = (row, pricingCatalog) => {
  const rate = pricingCatalog?.ballparkDayRates?.find((item) => String(item.key) === String(row.sourceKey))
  return (rate?.name || row.name || '').replace(/^Jornadas\s+/i, '')
}

function ExportSection({ budget, totals, pricingCatalog, updateNested, exportRef, exportImage, exportPdf }) {
  const opts = budget.exportOptions
  const isPureBallpark = budget.budgetMode === 'Ballpark'
  const dayRateBallparkRows = budget.ballparkItems.filter((row) => row.included && row.sourceType === 'ballparkDayRate' && Number(row.quantity || 0) > 0)
  const visibleBallpark = isPureBallpark && dayRateBallparkRows.length
    ? dayRateBallparkRows
    : budget.ballparkItems.filter((row) => row.included && Number(row.quantity || 0) > 0)
  const visibleDetailed = budget.detailedTasks.filter((row) => row.included)
  const visibleTeam = isPureBallpark ? [] : budget.teamMembers.filter((row) => row.included)
  const specs = budget.productionSpecs || {}
  const includedWorks = (specs.includedWorks?.length ? specs.includedWorks : defaultIncludedWorks).filter((item) => item.included)
  const isEnglish = getLanguage(budget) === 'en'
  const exportConsiderationDefaults = budget.budgetMode === 'Ballpark'
    ? (isEnglish ? englishBallparkConsiderations : ballparkConsiderations)
    : (isEnglish ? defaultEnglishConsiderations : defaultConsiderations)
  const savedConsiderations = budget.notes?.considerations || []
  const expectedSuffix = isEnglish ? '-en' : ''
  const shouldUseExportDefaults = !savedConsiderations.length || (budget.budgetMode === 'Ballpark' && !savedConsiderations.some((item) => item.id?.startsWith('ballpark-') && item.id.endsWith(expectedSuffix)))
  const exportConsiderations = shouldUseExportDefaults ? exportConsiderationDefaults : savedConsiderations
  const visibleConsiderations = [
    ...exportConsiderations.filter((item) => item.included).map((item) => item.text),
  ].filter(Boolean)
  const clientExportName = budget.clientProposalName || ''
  const showClientMark = Boolean(clientExportName || budget.clientLogo)

  return (
    <section className="panel">
      <SectionTitle icon={<Download />} eyebrow="PDF / PNG" title="Vista de presupuesto para exportar" />
      <div className="export-controls">
        {!isPureBallpark && ['cover', 'projectData', 'executiveSummary', 'team', 'ballpark', 'detailed', 'totals', 'notes'].map((key) => (
          <label key={key}><input type="checkbox" checked={opts[key]} onChange={(e) => updateNested('exportOptions', { [key]: e.target.checked })} /> {key}</label>
        ))}
        <button className="primary" onClick={exportPdf}><FileText size={16} /> PDF</button>
        <button className="primary" onClick={exportImage}><FileImage size={16} /> PNG</button>
      </div>

      <div className="export-page" ref={exportRef} style={{ backgroundColor: budget.brandSettings.backgroundColor }}>
        {budget.brandSettings.technicalGrid && <div className="export-grid-bg" />}
        {isPureBallpark ? (
          <>
            <div className="export-ballpark-hero">
              <div className="export-brand-lockup">
                <div className="export-logo"><img src={`${assetBase}monograma-negativo-perfil.jpg`} alt="BANI VFX" /></div>
                <p>BANI VFX</p>
              </div>
              {showClientMark && (
                <div className="export-client-mark">
                  <span>{isEnglish ? 'Prepared for' : 'Propuesta para'}</span>
                  {budget.clientLogo && <img src={budget.clientLogo} alt={clientExportName || 'Cliente'} />}
                  {clientExportName && <strong>{clientExportName}</strong>}
                </div>
              )}
            </div>
            <div className="export-block export-project-intro">
              <p>{budget.budgetNumber} / {budget.version} - {budget.date}</p>
              <h3>{budget.projectName}</h3>
              {!specs.projectDescription && specs.development && <p>{specs.development}</p>}
              <div className="export-meta-row">
                {budget.client && <span>{t(budget, 'client')}: {budget.client}</span>}
                {budget.finalClient && <span>{t(budget, 'finalClient')}: {budget.finalClient}</span>}
                {specs.pieceSummary && <span>{t(budget, 'pieces')}: {specs.pieceSummary}</span>}
              </div>
            </div>
            {specs.projectDescription && (
              <div className="export-block export-project-description">
                <p className="eyebrow">{isEnglish ? 'Project description' : 'Descripcion del proyecto'}</p>
                <p>{specs.projectDescription}</p>
              </div>
            )}
            <div className="export-block export-proposal-block">
              <p className="eyebrow">{t(budget, 'proposal')}</p>
              <h3>{isEnglish ? 'Included in this proposal' : 'Incluye la propuesta'}</h3>
              <table>
                <thead><tr><th>{isEnglish ? 'Stage' : 'Etapa'}</th><th>{isEnglish ? 'Days' : 'Jornadas'}</th></tr></thead>
                {visibleBallpark.map((row) => (
                  <tbody key={row.id}><tr><td>{ballparkStageName(row, pricingCatalog)}</td><td>{row.quantity}</td></tr></tbody>
                ))}
              </table>
            </div>
            <BallparkFinalPrice budget={budget} totals={totals} />
            <div className="export-notes"><h3>{t(budget, 'notes')}</h3>{visibleConsiderations.map((text, index) => <p key={`${text}-${index}`}>{text}</p>)}</div>
            {(specs.paymentTerms || specs.billingInfo) && <div className="export-notes"><h3>{t(budget, 'billing')}</h3>{specs.billingInfo && <p>{specs.billingInfo}</p>}{specs.paymentTerms && <p>{specs.paymentTerms}</p>}</div>}
          </>
        ) : (
          <>
            {opts.cover && (
              <div className="export-cover">
                <div className="export-logo"><img src={budget.brandSettings.logo || `${assetBase}logo.png`} alt="BANI VFX" /></div>
                <p>{budget.budgetNumber} / {budget.version}</p>
                <h2>{budget.projectName}</h2>
                <span>{budget.client || 'Cliente'} - {budget.date}</span>
              </div>
            )}
            {opts.projectData && <ExportBlock title={t(budget, 'projectData')} rows={[
              [t(budget, 'client'), budget.client], [t(budget, 'finalClient'), budget.finalClient], [t(budget, 'currency'), budget.currency], [t(budget, 'type'), budget.budgetMode], [t(budget, 'pieces'), specs.pieceSummary],
            ]} />}
            {opts.ballpark && totals.isBallpark && (
              <div className="export-block">
                <h3>{specs.commercialTitle || t(budget, 'proposal')}</h3>
                {specs.development && <p>{specs.development}</p>}
                {!!includedWorks.length && (
                  <table>
                    {includedWorks.map((item) => <tbody key={item.id}><tr><td>{item.text}</td></tr></tbody>)}
                  </table>
                )}
              </div>
            )}
            {opts.executiveSummary && (
              <ExportBlock title={t(budget, 'executiveSummary')} rows={[
                [t(budget, 'subtotalTeam'), money(totals.subtotalTeam, budget.currency)],
                [t(budget, 'subtotalBallpark'), money(totals.subtotalBallpark, budget.currency)],
                [t(budget, 'subtotalDetailed'), money(totals.subtotalDetailed, budget.currency)],
                [t(budget, 'totalFinal'), money(totals.totalFinal, budget.currency)],
              ]} highlight />
            )}
            {opts.team && <ExportTable title={t(budget, 'team')} rows={visibleTeam.map((r) => [r.name || r.role, r.area, `${r.days} ${isEnglish ? 'days' : 'dias'}`, money(teamSubtotal(r), budget.currency)])} />}
            {opts.ballpark && totals.isBallpark && <ExportTable title={isEnglish ? 'Days by stage' : 'Jornadas por etapa'} rows={visibleBallpark.map((r) => [ballparkStageName(r, pricingCatalog), `${r.quantity} ${isEnglish ? 'days' : 'jornadas'}`])} />}
            {opts.detailed && totals.isDetailed && <ExportTable title={t(budget, 'detailed')} rows={visibleDetailed.map((r) => [r.area, r.taskName, `${r.quantity} ${r.unit}`, money(lineSubtotal(r), budget.currency)])} />}
            {opts.totals && <TotalsPanel budget={budget} totals={totals} exportMode />}
            {opts.notes && <div className="export-notes"><h3>{t(budget, 'notes')}</h3>{visibleConsiderations.map((text, index) => <p key={`${text}-${index}`}>{text}</p>)}</div>}
            {opts.notes && (specs.paymentTerms || specs.billingInfo) && <div className="export-notes"><h3>{t(budget, 'billing')}</h3>{specs.billingInfo && <p>{specs.billingInfo}</p>}{specs.paymentTerms && <p>{specs.paymentTerms}</p>}</div>}
          </>
        )}
        <footer>BANI VFX - Postproduccion, VFX & 3D - www.bani-vfx.com</footer>
      </div>
    </section>
  )
}

function BrandSection({ budget, updateNested }) {
  const setImage = (key, file) => {
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => updateNested('brandSettings', { [key]: reader.result })
    reader.readAsDataURL(file)
  }
  return (
    <section className="panel">
      <SectionTitle icon={<Settings />} eyebrow="Identidad visual" title="Configuracion visual de marca" />
      <div className="form-grid">
        <label className="field"><span>Logo</span><input type="file" accept="image/*" onChange={(e) => setImage('logo', e.target.files[0])} /></label>
        <label className="field"><span>Imagen de referencia</span><input type="file" accept="image/*" onChange={(e) => setImage('referenceImage', e.target.files[0])} /></label>
        <Input type="color" label="Color principal" value={budget.brandSettings.primaryColor} onChange={(v) => updateNested('brandSettings', { primaryColor: v })} />
        <Input type="color" label="Color secundario" value={budget.brandSettings.secondaryColor} onChange={(v) => updateNested('brandSettings', { secondaryColor: v })} />
        <Input type="color" label="Color de fondo" value={budget.brandSettings.backgroundColor} onChange={(v) => updateNested('brandSettings', { backgroundColor: v })} />
      </div>
      <div className="switch-row">
        {[
          ['darkMode', 'Fondo oscuro'],
          ['technicalGrid', 'Grilla tecnica'],
          ['textureEnabled', 'Textura visual'],
        ].map(([key, label]) => (
          <label key={key}><input type="checkbox" checked={budget.brandSettings[key]} onChange={(e) => updateNested('brandSettings', { [key]: e.target.checked })} /> {label}</label>
        ))}
      </div>
      {budget.brandSettings.referenceImage && <img className="reference-preview" src={budget.brandSettings.referenceImage} alt="Referencia visual" />}
    </section>
  )
}

function AdminSection({ pricingCatalog, setPricingCatalog, markDirty, onSave, pricingDirty, pricingStatus }) {
  const [dragItem, setDragItem] = useState(null)

  const updateCatalog = (updater) => {
    markDirty()
    setPricingCatalog(updater)
  }

  const updateCatalogRow = (collection, index, patch) => {
    updateCatalog((catalog) => ({
      ...catalog,
      [collection]: catalog[collection].map((item, itemIndex) => (itemIndex === index ? { ...item, ...patch } : item)),
    }))
  }

  const addCatalogRow = (collection, row) => {
    updateCatalog((catalog) => ({
      ...catalog,
      [collection]: [...catalog[collection], row],
    }))
  }

  const removeCatalogRow = async (collection, index) => {
    if (!(await confirmDelete('esta fila'))) return
    updateCatalog((catalog) => ({
      ...catalog,
      [collection]: catalog[collection].filter((_, itemIndex) => itemIndex !== index),
    }))
  }

  const moveCatalogRow = (collection, fromIndex, toIndex, patch = {}) => {
    updateCatalog((catalog) => {
      const rows = [...catalog[collection]]
      if (fromIndex < 0 || fromIndex >= rows.length) return catalog
      const [moved] = rows.splice(fromIndex, 1)
      const boundedTarget = Math.max(0, Math.min(toIndex, rows.length))
      const insertIndex = fromIndex < toIndex ? Math.max(0, boundedTarget - 1) : boundedTarget
      rows.splice(insertIndex, 0, { ...moved, ...patch })
      return { ...catalog, [collection]: rows }
    })
  }

  const startDrag = (collection, index) => setDragItem({ collection, index })
  const clearDrag = () => setDragItem(null)
  const dropCatalogRow = (collection, toIndex, patch = {}) => {
    if (!dragItem || dragItem.collection !== collection) return
    moveCatalogRow(collection, dragItem.index, toIndex, patch)
    clearDrag()
  }
  const dropRoleSection = (section) => {
    if (!dragItem || dragItem.collection !== 'roles') return
    const sectionIndexes = pricingCatalog.roles.map((row, index) => ({ row, index })).filter(({ row }) => getRoleSection(row.area) === section).map(({ index }) => index)
    const toIndex = sectionIndexes.length ? sectionIndexes[sectionIndexes.length - 1] + 1 : pricingCatalog.roles.length
    moveCatalogRow('roles', dragItem.index, toIndex, { area: defaultAreaForRoleSection(section) })
    clearDrag()
  }

  return (
    <section className="panel admin-panel">
      <SectionTitle icon={<Settings />} eyebrow="Solo administrador" title="Base de costos" />
      <div className="admin-note">
        <strong>Modo Admin activo</strong>
        <span>Estos valores alimentan los presets que usa Productor para armar presupuestos sin editar costos individuales.</span>
      </div>
      <div className="admin-save-row">
        <span>{pricingDirty ? 'Hay cambios sin guardar' : pricingStatus}</span>
        <button className="primary" onClick={onSave} disabled={!pricingDirty}>Guardar cambios</button>
      </div>

      <AdminCatalogBlock
        title="Valores de equipo"
        actionLabel="Agregar rol"
        headers={['', 'Rol', 'Area', 'Valor/dia', '']}
        onAdd={() => addCatalogRow('roles', { role: 'Nuevo rol', area: 'Gestion de proyecto', dayRate: 0 })}
      >
        <RoleCatalogRows
          rows={pricingCatalog.roles}
          updateRow={(index, patch) => updateCatalogRow('roles', index, patch)}
          removeRow={(index) => removeCatalogRow('roles', index)}
          startDrag={startDrag}
          dropRow={(index, section) => dropCatalogRow('roles', index, { area: defaultAreaForRoleSection(section) })}
          dropSection={dropRoleSection}
          clearDrag={clearDrag}
        />
      </AdminCatalogBlock>

      <AdminCatalogBlock
        title="Presets proyectos"
        actionLabel="Agregar partida"
        headers={['', 'Partida', 'Descripcion', 'Cantidad', 'Unitario', '']}
        onAdd={() => addCatalogRow('ballpark', { name: 'Nueva partida', description: '', quantity: 1, unitValue: 0 })}
      >
        <CatalogRows
          collection="ballpark"
          rows={pricingCatalog.ballpark}
          startDrag={startDrag}
          dropRow={(index) => dropCatalogRow('ballpark', index)}
          clearDrag={clearDrag}
          renderCells={(row, index) => (
            <>
              <td><CellInput value={row.name} onChange={(v) => updateCatalogRow('ballpark', index, { name: v })} /></td>
              <td><CellInput value={row.description} onChange={(v) => updateCatalogRow('ballpark', index, { description: v })} /></td>
              <td><CellInput type="number" value={row.quantity} onChange={(v) => updateCatalogRow('ballpark', index, { quantity: Number(v) })} /></td>
              <td><CellInput type="number" value={row.unitValue} onChange={(v) => updateCatalogRow('ballpark', index, { unitValue: Number(v) })} /></td>
              <td><IconButton onClick={() => removeCatalogRow('ballpark', index)} icon={<Trash2 size={15} />} /></td>
            </>
          )}
        />
      </AdminCatalogBlock>

      <AdminCatalogBlock
        title="Jornadas Ballpark"
        actionLabel="Agregar departamento"
        headers={['', 'Clave', 'Departamento', 'Descripcion', 'Valor/jornada', '']}
        onAdd={() => addCatalogRow('ballparkDayRates', { key: crypto.randomUUID(), name: 'Nuevo departamento', description: '', unitValue: 0 })}
      >
        <CatalogRows
          collection="ballparkDayRates"
          rows={pricingCatalog.ballparkDayRates?.length ? pricingCatalog.ballparkDayRates : defaultPricingCatalog.ballparkDayRates}
          startDrag={startDrag}
          dropRow={(index) => dropCatalogRow('ballparkDayRates', index)}
          clearDrag={clearDrag}
          renderCells={(row, index) => (
            <>
              <td><CellInput value={row.key} onChange={(v) => updateCatalogRow('ballparkDayRates', index, { key: v })} /></td>
              <td><CellInput value={row.name} onChange={(v) => updateCatalogRow('ballparkDayRates', index, { name: v })} /></td>
              <td><CellInput value={row.description} onChange={(v) => updateCatalogRow('ballparkDayRates', index, { description: v })} /></td>
              <td><CellInput type="number" value={row.unitValue} onChange={(v) => updateCatalogRow('ballparkDayRates', index, { unitValue: Number(v) })} /></td>
              <td><IconButton onClick={() => removeCatalogRow('ballparkDayRates', index)} icon={<Trash2 size={15} />} /></td>
            </>
          )}
        />
      </AdminCatalogBlock>
    </section>
  )
}

function AdminCatalogBlock({ title, actionLabel, headers, onAdd, children }) {
  return (
    <div className="admin-block">
      <div className="admin-block-header">
        <h3>{title}</h3>
        <button className="add-row" onClick={onAdd}><Plus size={16} /> {actionLabel}</button>
      </div>
      <div className="table-wrap">
        <EditableTable headers={headers}>{children}</EditableTable>
      </div>
    </div>
  )
}

const roleSections = ['Gestion de proyecto', 'POST', 'VFX', '3D']

function getRoleSection(area = '') {
  const normalized = area.toLowerCase()
  if (normalized.includes('post') || normalized.includes('edicion') || normalized.includes('color') || normalized.includes('sonido')) return 'POST'
  if (normalized.includes('gestion') || normalized === 'produccion' || normalized.includes('coordinacion') || normalized.includes('producer') || normalized.includes('coordination')) return 'Gestion de proyecto'
  if (normalized.includes('3d')) return '3D'
  if (normalized.includes('vfx') || normalized.includes('motion') || normalized.includes('supervision')) return 'VFX'
  return 'POST'
}

function defaultAreaForRoleSection(section) {
  if (section === 'Gestion de proyecto') return 'Gestion de proyecto'
  if (section === '3D') return '3D'
  if (section === 'VFX') return 'VFX'
  return 'Postproduccion'
}

function DragHandle({ collection, index, startDrag, clearDrag }) {
  return (
    <button
      type="button"
      className="drag-handle"
      title="Arrastrar fila"
      draggable
      onDragStart={(event) => {
        event.dataTransfer.effectAllowed = 'move'
        startDrag(collection, index)
      }}
      onDragEnd={clearDrag}
    >
      <GripVertical size={16} />
    </button>
  )
}

function CatalogRows({ collection, rows, startDrag, dropRow, clearDrag, renderCells }) {
  return rows.map((row, index) => (
    <tr
      key={`${collection}-${index}`}
      className="draggable-row"
      onDragOver={(event) => event.preventDefault()}
      onDrop={() => dropRow(index)}
    >
      <td><DragHandle collection={collection} index={index} startDrag={startDrag} clearDrag={clearDrag} /></td>
      {renderCells(row, index)}
    </tr>
  ))
}

function RoleCatalogRows({ rows, updateRow, removeRow, startDrag, dropRow, dropSection, clearDrag }) {
  return roleSections.map((section) => {
    const sectionRows = rows
      .map((row, index) => ({ row, index }))
      .filter(({ row }) => getRoleSection(row.area) === section)

    return (
      <Fragment key={section}>
        <tr className="catalog-section-row" onDragOver={(event) => event.preventDefault()} onDrop={() => dropSection(section)}>
          <td colSpan="5">{section}</td>
        </tr>
        {sectionRows.map(({ row, index }) => (
          <tr key={`role-${index}`} className="draggable-row" onDragOver={(event) => event.preventDefault()} onDrop={() => dropRow(index, section)}>
            <td><DragHandle collection="roles" index={index} startDrag={startDrag} clearDrag={clearDrag} /></td>
            <td><CellInput value={row.role} onChange={(v) => updateRow(index, { role: v })} /></td>
            <td><CellSelect value={row.area} options={areaOptions} onChange={(v) => updateRow(index, { area: v })} /></td>
            <td><CellInput type="number" value={row.dayRate} onChange={(v) => updateRow(index, { dayRate: Number(v) })} /></td>
            <td><IconButton title="Eliminar" onClick={() => removeRow(index)} icon={<Trash2 size={15} />} /></td>
          </tr>
        ))}
      </Fragment>
    )
  })
}

function FeePanel({ budget, updateNested }) {
  const fields = [
    ['productionFee', 'Fee produccion/post', 'productionFeePercent', 'productionFeeEnabled'],
    ['contingency', 'Contingencia', 'contingencyPercent', 'contingencyEnabled'],
    ['discount', 'Descuento', 'discountPercent', 'discountEnabled'],
    ['tax', 'IVA / impuestos', 'taxPercent', 'taxEnabled'],
  ]
  return (
    <div className="fee-panel">
      {fields.map(([, label, percentKey, enabledKey]) => (
        <div className="fee-row" key={percentKey}>
          <label><input type="checkbox" checked={budget.fees[enabledKey]} onChange={(e) => updateNested('fees', { [enabledKey]: e.target.checked })} /> {label}</label>
          <input type="number" value={budget.fees[percentKey]} onChange={(e) => updateNested('fees', { [percentKey]: Number(e.target.value) })} />
          <span>%</span>
        </div>
      ))}
    </div>
  )
}

function TotalsPanel({ budget, totals, exportMode = false, compactBallpark = false }) {
  if (exportMode && compactBallpark) {
    return (
      <div className="totals-panel export-totals">
        <Line label={t(budget, 'subtotalBallpark')} value={money(totals.subtotalBallpark, budget.currency)} />
        {budget.fees.productionFeeEnabled && <Line label="Fee" value={money(totals.productionFee, budget.currency)} />}
        {budget.fees.contingencyEnabled && <Line label="Contingencia" value={money(totals.contingency, budget.currency)} />}
        {budget.fees.discountEnabled && <Line label="Descuento" value={`-${money(totals.discount, budget.currency)}`} />}
        {budget.fees.taxEnabled && <Line label="Impuestos" value={money(totals.tax, budget.currency)} />}
        <Line label={t(budget, 'totalFinal')} value={money(totals.totalFinal, budget.currency)} strong />
      </div>
    )
  }

  return (
    <div className={exportMode ? 'totals-panel export-totals' : 'totals-panel'}>
      <Line label={t(budget, 'subtotalTeam')} value={money(totals.subtotalTeam, budget.currency)} />
      <Line label={t(budget, 'subtotalBallpark')} value={money(totals.subtotalBallpark, budget.currency)} />
      <Line label={t(budget, 'subtotalDetailed')} value={money(totals.subtotalDetailed, budget.currency)} />
      <Line label="Base" value={money(totals.base, budget.currency)} />
      <Line label="Fee" value={money(totals.productionFee, budget.currency)} />
      <Line label="Contingencia" value={money(totals.contingency, budget.currency)} />
      <Line label="Descuento" value={`-${money(totals.discount, budget.currency)}`} />
      <Line label="Impuestos" value={money(totals.tax, budget.currency)} />
      <Line label={t(budget, 'totalFinal')} value={money(totals.totalFinal, budget.currency)} strong />
      {budget.budgetMode === 'Ambos' && <Line label="Diferencia ballpark/detallado" value={money(totals.ballparkDetailedDiff, budget.currency)} />}
    </div>
  )
}

function BallparkFinalPrice({ budget, totals }) {
  return (
    <div className="export-block export-final-price">
      {budget.fees.discountEnabled && <Line label="Descuento" value={`-${money(totals.discount, budget.currency)}`} />}
      {budget.fees.taxEnabled && <Line label="IVA / Impuestos" value={money(totals.tax, budget.currency)} />}
      <div className="export-final-total">
        <span>{t(budget, 'totalFinal')}</span>
        <strong>{money(totals.totalFinal, budget.currency)}</strong>
      </div>
    </div>
  )
}

function ChartCard({ title, data }) {
  return (
    <div className="chart-card">
      <h3>{title}</h3>
      <ResponsiveContainer width="100%" height={250}>
        <PieChart>
          <Pie data={data} dataKey="value" nameKey="name" innerRadius={52} outerRadius={90}>
            {data.map((_, index) => <Cell key={index} fill={chartColors[index % chartColors.length]} />)}
          </Pie>
          <Tooltip />
        </PieChart>
      </ResponsiveContainer>
    </div>
  )
}

function ListCard({ title, totals, currency }) {
  return (
    <div className="chart-card">
      <h3>{title}</h3>
      {Object.entries(totals).map(([key, value]) => (
        <Line key={key} label={key} value={money(value, currency)} />
      ))}
    </div>
  )
}

function ExportBlock({ title, rows, highlight }) {
  return <div className={`export-block ${highlight ? 'highlight' : ''}`}><h3>{title}</h3>{rows.map(([label, value]) => <Line key={label} label={label} value={value || '-'} />)}</div>
}

function ExportTable({ title, rows }) {
  return <div className="export-block"><h3>{title}</h3><table>{rows.map((row, i) => <tbody key={i}><tr>{row.map((cell, j) => <td key={j}>{cell}</td>)}</tr></tbody>)}</table></div>
}

function CrudSection({ title, eyebrow, icon, actions, children }) {
  return <section className="panel"><SectionTitle icon={icon} eyebrow={eyebrow} title={title} />{actions}<div className="table-wrap">{children}</div></section>
}

function SectionTitle({ icon, eyebrow, title }) {
  return <div className="section-title"><div className="title-icon">{icon}</div><div><p className="eyebrow">{eyebrow}</p><h2>{title}</h2></div></div>
}

function PresetButtons({ presets, getLabel, onPick }) {
  return <div className="preset-row">{presets.map((preset, index) => <button key={`${getLabel(preset)}-${index}`} onClick={() => onPick(preset)}>{getLabel(preset)}</button>)}</div>
}

function EditableTable({ headers, children }) {
  return <table className="edit-table"><thead><tr>{headers.map((h) => <th key={h}>{h}</th>)}</tr></thead><tbody>{children}</tbody></table>
}

function Input({ label, value, onChange, type = 'text' }) {
  return <label className="field"><span>{label}</span><input type={type} value={value ?? ''} onChange={(e) => onChange(e.target.value)} /></label>
}

function Textarea({ label, value, onChange }) {
  return <label className="field"><span>{label}</span><textarea value={value ?? ''} onChange={(e) => onChange(e.target.value)} /></label>
}

function Select({ label, value, options, labels = {}, onChange }) {
  return <label className="field"><span>{label}</span><select value={value} onChange={(e) => onChange(e.target.value)}>{options.map((option) => <option key={option} value={option}>{labels[option] || option}</option>)}</select></label>
}

function CellInput({ value, onChange, type = 'text' }) {
  return <input className="cell-input" type={type} value={value ?? ''} onChange={(e) => onChange(e.target.value)} />
}

function CellSelect({ value, options, onChange }) {
  return <select className="cell-input" value={value} onChange={(e) => onChange(e.target.value)}>{options.map((option) => <option key={option}>{option}</option>)}</select>
}

function Check({ checked, onChange }) {
  return <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
}

function IconButton({ icon, onClick, title, disabled = false }) {
  return <button className="icon-button" title={title} disabled={disabled} onClick={onClick}>{icon}</button>
}

function Line({ label, value, strong }) {
  return <div className={`line ${strong ? 'strong' : ''}`}><span>{label}</span><b>{value}</b></div>
}

export default App
