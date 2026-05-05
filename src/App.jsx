import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import html2canvas from 'html2canvas'
import jsPDF from 'jspdf'
import {
  BarChart3,
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
  Plus,
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
  createDetailedTask,
  createTeamMember,
  groupTotals,
  lineSubtotal,
  money,
  teamSubtotal,
} from './lib/budget'
import { clearSession, loadBudgets, loadCurrentId, loadPricingCatalog, loadSession, saveBudgets, saveCurrentId, savePricingCatalog, saveSession } from './lib/storage'

const navItems = [
  ['dashboard', 'Presupuestos'],
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
  ],
}
const mergeDayRates = (rates = []) => {
  const saved = rates.length ? rates : defaultPricingCatalog.ballparkDayRates
  const byKey = new Map(saved.map((rate) => [rate.key, rate]))
  return defaultPricingCatalog.ballparkDayRates.map((rate) => ({ ...rate, ...(byKey.get(rate.key) || {}) }))
}
const mergePricingCatalog = (catalog) => ({
  ...defaultPricingCatalog,
  ...(catalog || {}),
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

const confirmDelete = (label = 'este item') => window.confirm(`Seguro que queres eliminar ${label}?`)

function App() {
  const [budgets, setBudgets] = useState(() => {
    const saved = loadBudgets()
    return saved.length ? saved : [createBudget()]
  })
  const [currentId, setCurrentId] = useState(() => loadCurrentId() || budgets[0]?.id)
  const [section, setSection] = useState('dashboard')
  const [wizardActive, setWizardActive] = useState(false)
  const [wizardStep, setWizardStep] = useState(0)
  const [session, setSession] = useState(() => loadSession())
  const [loginError, setLoginError] = useState('')
  const [pricingCatalog, setPricingCatalog] = useState(() => mergePricingCatalog(loadPricingCatalog(defaultPricingCatalog)))
  const exportRef = useRef(null)

  const budget = budgets.find((item) => item.id === currentId) || budgets[0]
  const totals = useMemo(() => calculateBudget(budget), [budget])
  const userRole = session?.role || 'producer'
  const isAdmin = userRole === 'admin'
  const visibleNavItems = isAdmin ? navItems : navItems.filter(([id]) => id === 'dashboard')

  useEffect(() => {
    saveBudgets(budgets)
  }, [budgets])

  useEffect(() => {
    if (currentId) saveCurrentId(currentId)
  }, [currentId])

  useEffect(() => {
    if (!isAdmin && section !== 'dashboard' && !wizardActive) setSection('dashboard')
    if (isAdmin && !['dashboard', 'brand', 'admin'].includes(section)) setSection('dashboard')
  }, [isAdmin, section, wizardActive])

  useEffect(() => {
    savePricingCatalog(pricingCatalog)
  }, [pricingCatalog])

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
    setSection('dashboard')
  }

  const handleLogout = () => {
    clearSession()
    setSession(null)
    setSection('dashboard')
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

  const removeRow = (collection, id) => {
    if (!confirmDelete('esta fila')) return
    updateBudget({ [collection]: budget[collection].filter((row) => row.id !== id) })
  }

  const startNewBudget = () => {
    const fresh = { ...createBudget(), currency: budget?.currency || 'USD' }
    setBudgets((items) => [fresh, ...items])
    setCurrentId(fresh.id)
    setWizardActive(true)
    setWizardStep(0)
    setSection('dashboard')
  }

  const openWizardForBudget = (id) => {
    setCurrentId(id)
    setWizardActive(true)
    setWizardStep(0)
    setSection('dashboard')
  }

  const duplicateBudget = (source = budget) => {
    const clone = {
      ...source,
      id: crypto.randomUUID(),
      projectName: `${source.projectName} copia`,
      budgetNumber: `${source.budgetNumber}-COPY`,
      updatedAt: new Date().toISOString(),
    }
    setBudgets((items) => [clone, ...items])
    setCurrentId(clone.id)
    setSection('project')
  }

  const deleteBudget = (id) => {
    if (!confirmDelete('este presupuesto')) return
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
            <button key={id} className={section === id ? 'active' : ''} onClick={() => { if (id !== 'dashboard') setWizardActive(false); setSection(id) }}>
              {label}
            </button>
          ))}
        </nav>
        {wizardActive && <WizardStepNav wizardStep={wizardStep} setWizardStep={setWizardStep} />}
        {(wizardActive || section === 'dashboard') && (
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
        {!wizardActive && section === 'dashboard' && <Dashboard budgets={budgets} currentId={currentId} setCurrentId={setCurrentId} deleteBudget={deleteBudget} duplicateBudget={duplicateBudget} setSection={setSection} onNewBudget={startNewBudget} onOpenWizard={openWizardForBudget} isAdmin={false} />}
        {!wizardActive && isAdmin && section === 'brand' && <BrandSection budget={budget} updateNested={updateNested} />}
        {!wizardActive && isAdmin && section === 'admin' && <AdminSection pricingCatalog={pricingCatalog} setPricingCatalog={setPricingCatalog} />}
      </main>
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
      {wizardStep === 4 && <ExportSection budget={budget} totals={totals} updateNested={updateNested} exportRef={exportRef} exportImage={exportImage} exportPdf={exportPdf} />}

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
  const removeWork = (id) => {
    if (!confirmDelete('este trabajo incluido')) return
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
      {isAdmin && <div className="chart-grid">
        <ChartCard title="Por area" data={chartDataFromTotals(areaTotals)} />
        <ChartCard title="Equipo vs tareas" data={modeData} />
        <ListCard title="Total por persona / rol" totals={peopleTotals} currency={budget.currency} />
      </div>}
    </section>
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
  const removeConsideration = (id) => {
    if (!confirmDelete('esta consideracion')) return
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

function ExportSection({ budget, totals, updateNested, exportRef, exportImage, exportPdf }) {
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
              <div>
                <div className="export-logo"><img src={budget.brandSettings.logo || `${assetBase}logo.png`} alt="BANI VFX" /></div>
                <p>{budget.productionCompany || 'Gran Berta SRL'} / BANI VFX</p>
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
              {specs.development && <p>{specs.development}</p>}
              <div className="export-meta-row">
                {budget.client && <span>{t(budget, 'client')}: {budget.client}</span>}
                {budget.finalClient && <span>{t(budget, 'finalClient')}: {budget.finalClient}</span>}
                {specs.pieceSummary && <span>{t(budget, 'pieces')}: {specs.pieceSummary}</span>}
              </div>
            </div>
            <div className="export-block export-proposal-block">
              <p className="eyebrow">{t(budget, 'proposal')}</p>
              <h3>{isEnglish ? 'Included in this proposal' : 'Incluye la propuesta'}</h3>
              <table>
                <thead><tr><th>{isEnglish ? 'Stage' : 'Etapa'}</th><th>{isEnglish ? 'Days' : 'Jornadas'}</th></tr></thead>
                {visibleBallpark.map((row) => (
                  <tbody key={row.id}><tr><td>{row.name.replace(/^Jornadas\s+/i, '')}</td><td>{row.quantity}</td></tr></tbody>
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
            {opts.ballpark && totals.isBallpark && <ExportTable title={isEnglish ? 'Days by stage' : 'Jornadas por etapa'} rows={visibleBallpark.map((r) => [r.name, `${r.quantity} ${isEnglish ? 'days' : 'jornadas'}`])} />}
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

function AdminSection({ pricingCatalog, setPricingCatalog }) {
  const [dragItem, setDragItem] = useState(null)

  const updateCatalogRow = (collection, index, patch) => {
    setPricingCatalog((catalog) => ({
      ...catalog,
      [collection]: catalog[collection].map((item, itemIndex) => (itemIndex === index ? { ...item, ...patch } : item)),
    }))
  }

  const addCatalogRow = (collection, row) => {
    setPricingCatalog((catalog) => ({
      ...catalog,
      [collection]: [...catalog[collection], row],
    }))
  }

  const removeCatalogRow = (collection, index) => {
    if (!confirmDelete('esta fila')) return
    setPricingCatalog((catalog) => ({
      ...catalog,
      [collection]: catalog[collection].filter((_, itemIndex) => itemIndex !== index),
    }))
  }

  const moveCatalogRow = (collection, fromIndex, toIndex, patch = {}) => {
    setPricingCatalog((catalog) => {
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

  const resetCatalog = () => setPricingCatalog(defaultPricingCatalog)

  return (
    <section className="panel admin-panel">
      <SectionTitle icon={<Settings />} eyebrow="Solo administrador" title="Base de costos" />
      <div className="admin-note">
        <strong>Modo Admin activo</strong>
        <span>Estos valores alimentan los presets que usa Productor para armar presupuestos sin editar costos individuales.</span>
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

      <div className="admin-actions">
        <button className="ghost" onClick={resetCatalog}>Restaurar valores base</button>
      </div>
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
  if (normalized.includes('gestion') || normalized.includes('produccion') || normalized.includes('coordinacion') || normalized.includes('producer') || normalized.includes('coordination')) return 'Gestion de proyecto'
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
