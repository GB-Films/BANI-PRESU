import { useEffect, useMemo, useRef, useState } from 'react'
import html2canvas from 'html2canvas'
import jsPDF from 'jspdf'
import {
  BarChart3,
  Copy,
  Download,
  FileImage,
  FileText,
  Grid3X3,
  Plus,
  Settings,
  Sparkles,
  Trash2,
} from 'lucide-react'
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'
import './index.css'
import { areaOptions, ballparkPresets, rolePresets, statusOptions, taskPresets, unitOptions } from './data/presets'
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
import { loadBudgets, loadCurrentId, saveBudgets, saveCurrentId } from './lib/storage'

const navItems = [
  ['dashboard', 'Dashboard'],
  ['project', 'Proyecto'],
  ['team', 'Equipo'],
  ['ballpark', 'Ballpark'],
  ['detailed', 'Detallado'],
  ['summary', 'Resumen'],
  ['export', 'Exportar'],
  ['brand', 'Marca'],
]

const chartColors = ['#e61e6e', '#ffffff', '#22c55e', '#71717a', '#a1a1aa', '#f43f5e', '#52525b']
const assetBase = import.meta.env.BASE_URL

function App() {
  const [budgets, setBudgets] = useState(() => {
    const saved = loadBudgets()
    return saved.length ? saved : [createBudget()]
  })
  const [currentId, setCurrentId] = useState(() => loadCurrentId() || budgets[0]?.id)
  const [section, setSection] = useState('dashboard')
  const exportRef = useRef(null)

  const budget = budgets.find((item) => item.id === currentId) || budgets[0]
  const totals = useMemo(() => calculateBudget(budget), [budget])

  useEffect(() => {
    saveBudgets(budgets)
  }, [budgets])

  useEffect(() => {
    if (currentId) saveCurrentId(currentId)
  }, [currentId])

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
    updateBudget({ [collection]: budget[collection].filter((row) => row.id !== id) })
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

  return (
    <div className="app-shell" style={{ '--brand': budget.brandSettings.primaryColor, '--accent': budget.brandSettings.secondaryColor }}>
      <aside className="sidebar">
        <div className="brand-lockup">
          <img src={budget.brandSettings.logo || `${assetBase}logo.png`} alt="BANI VFX" />
          <div>
            <strong>BANI VFX</strong>
            <span>Presu Lab</span>
          </div>
        </div>
        <nav>
          {navItems.map(([id, label]) => (
            <button key={id} className={section === id ? 'active' : ''} onClick={() => setSection(id)}>
              {label}
            </button>
          ))}
        </nav>
        <div className="side-total">
          <span>Total final</span>
          <strong>{money(totals.totalFinal, budget.currency)}</strong>
        </div>
      </aside>

      <main>
        <header className="topbar">
          <div>
            <p className="eyebrow">{budget.budgetNumber} / {budget.version}</p>
            <h1>{budget.projectName}</h1>
          </div>
          <div className="toolbar">
            <button className="ghost" onClick={() => duplicateBudget()}><Copy size={16} /> Duplicar</button>
            <button className="ghost" onClick={() => setBudgets((items) => [{ ...createBudget(), currency: budget.currency }, ...items])}><Plus size={16} /> Nuevo</button>
            <button className="primary" onClick={() => setSection('export')}><Download size={16} /> Exportar</button>
          </div>
        </header>

        {section === 'dashboard' && <Dashboard budgets={budgets} currentId={currentId} setCurrentId={setCurrentId} deleteBudget={deleteBudget} duplicateBudget={duplicateBudget} setSection={setSection} />}
        {section === 'project' && <ProjectSection budget={budget} updateBudget={updateBudget} updateNested={updateNested} />}
        {section === 'team' && <TeamSection budget={budget} updateRow={updateRow} removeRow={removeRow} updateBudget={updateBudget} />}
        {section === 'ballpark' && <BallparkSection budget={budget} updateRow={updateRow} removeRow={removeRow} updateBudget={updateBudget} />}
        {section === 'detailed' && <DetailedSection budget={budget} updateRow={updateRow} removeRow={removeRow} updateBudget={updateBudget} />}
        {section === 'summary' && <SummarySection budget={budget} totals={totals} updateNested={updateNested} />}
        {section === 'export' && <ExportSection budget={budget} totals={totals} updateNested={updateNested} exportRef={exportRef} exportImage={exportImage} exportPdf={exportPdf} />}
        {section === 'brand' && <BrandSection budget={budget} updateNested={updateNested} />}
      </main>
    </div>
  )
}

function Dashboard({ budgets, currentId, setCurrentId, deleteBudget, duplicateBudget, setSection }) {
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
      <SectionTitle icon={<Sparkles />} eyebrow="LocalStorage" title="Presupuestos guardados" />
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
                <button onClick={() => { setCurrentId(item.id); setSection('project') }}>Editar</button>
                <button onClick={() => duplicateBudget(item)}><Copy size={15} /></button>
                <button onClick={() => deleteBudget(item.id)}><Trash2 size={15} /></button>
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

function ProjectSection({ budget, updateBudget, updateNested }) {
  return (
    <section className="panel">
      <SectionTitle icon={<FileText />} eyebrow="Base del presupuesto" title="Datos del proyecto" />
      <div className="form-grid">
        <Input label="Nombre del proyecto" value={budget.projectName} onChange={(v) => updateBudget({ projectName: v })} />
        <Input label="Cliente" value={budget.client} onChange={(v) => updateBudget({ client: v })} />
        <Input label="Productora / agencia" value={budget.agency} onChange={(v) => updateBudget({ agency: v })} />
        <Input label="Productora" value={budget.productionCompany} onChange={(v) => updateBudget({ productionCompany: v })} />
        <Input type="date" label="Fecha" value={budget.date} onChange={(v) => updateBudget({ date: v })} />
        <Input label="Numero de presupuesto" value={budget.budgetNumber} onChange={(v) => updateBudget({ budgetNumber: v })} />
        <Input label="Version" value={budget.version} onChange={(v) => updateBudget({ version: v })} />
        <Input label="Responsable" value={budget.owner} onChange={(v) => updateBudget({ owner: v })} />
        <Select label="Moneda" value={budget.currency} options={['USD', 'ARS']} onChange={(v) => updateBudget({ currency: v })} />
        <Select label="Tipo" value={budget.budgetMode} options={['Ballpark', 'Detallado', 'Ambos']} onChange={(v) => updateBudget({ budgetMode: v })} />
      </div>
      <div className="two-col">
        <Textarea label="Notas visibles para cliente" value={budget.notes.clientNotes} onChange={(v) => updateNested('notes', { clientNotes: v })} />
        <Textarea label="Notas internas" value={budget.notes.internalNotes} onChange={(v) => updateNested('notes', { internalNotes: v })} />
      </div>
    </section>
  )
}

function TeamSection({ budget, updateRow, removeRow, updateBudget }) {
  const addPreset = (preset) => updateBudget({ teamMembers: [...budget.teamMembers, createTeamMember(preset)] })
  return (
    <CrudSection title="Equipo involucrado" eyebrow="Dias / persona" icon={<Grid3X3 />} actions={<PresetButtons presets={rolePresets} getLabel={(p) => p.role} onPick={addPreset} />}>
      <EditableTable headers={['Incl.', 'Nombre', 'Rol', 'Area', 'Valor/dia', 'Dias', 'Subtotal', 'Notas', '']}>
        {budget.teamMembers.map((row) => (
          <tr key={row.id}>
            <td><Check checked={row.included} onChange={(v) => updateRow('teamMembers', row.id, { included: v })} /></td>
            <td><CellInput value={row.name} onChange={(v) => updateRow('teamMembers', row.id, { name: v })} /></td>
            <td><CellInput value={row.role} onChange={(v) => updateRow('teamMembers', row.id, { role: v })} /></td>
            <td><CellSelect value={row.area} options={areaOptions} onChange={(v) => updateRow('teamMembers', row.id, { area: v })} /></td>
            <td><CellInput type="number" value={row.dayRate} onChange={(v) => updateRow('teamMembers', row.id, { dayRate: Number(v) })} /></td>
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

function BallparkSection({ budget, updateRow, removeRow, updateBudget }) {
  const addPreset = (preset) => updateBudget({ ballparkItems: [...budget.ballparkItems, createBallparkItem(preset)] })
  return (
    <CrudSection title="Presupuesto Ballpark" eyebrow="Estimacion rapida" icon={<Sparkles />} actions={<PresetButtons presets={ballparkPresets} getLabel={(p) => p.name} onPick={addPreset} />}>
      <EditableTable headers={['Incl.', 'Partida', 'Descripcion', 'Cant.', 'Unitario', 'Subtotal', 'Notas', '']}>
        {budget.ballparkItems.map((row) => (
          <tr key={row.id}>
            <td><Check checked={row.included} onChange={(v) => updateRow('ballparkItems', row.id, { included: v })} /></td>
            <td><CellInput value={row.name} onChange={(v) => updateRow('ballparkItems', row.id, { name: v })} /></td>
            <td><CellInput value={row.description} onChange={(v) => updateRow('ballparkItems', row.id, { description: v })} /></td>
            <td><CellInput type="number" value={row.quantity} onChange={(v) => updateRow('ballparkItems', row.id, { quantity: Number(v) })} /></td>
            <td><CellInput type="number" value={row.unitValue} onChange={(v) => updateRow('ballparkItems', row.id, { unitValue: Number(v) })} /></td>
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

function DetailedSection({ budget, updateRow, removeRow, updateBudget }) {
  const addPreset = (preset) => updateBudget({ detailedTasks: [...budget.detailedTasks, createDetailedTask(preset)] })
  return (
    <CrudSection title="Presupuesto Detallado" eyebrow="Tareas por area" icon={<BarChart3 />} actions={<PresetButtons presets={taskPresets} getLabel={(p) => `${p.area}: ${p.taskName}`} onPick={addPreset} />}>
      <EditableTable headers={['Incl.', 'Area', 'Tarea', 'Descripcion', 'Resp.', 'Cant.', 'Unidad', 'Unitario', 'Estado', 'Subtotal', 'Notas', '']}>
        {budget.detailedTasks.map((row) => (
          <tr key={row.id}>
            <td><Check checked={row.included} onChange={(v) => updateRow('detailedTasks', row.id, { included: v })} /></td>
            <td><CellInput value={row.area} onChange={(v) => updateRow('detailedTasks', row.id, { area: v })} /></td>
            <td><CellInput value={row.taskName} onChange={(v) => updateRow('detailedTasks', row.id, { taskName: v })} /></td>
            <td><CellInput value={row.description} onChange={(v) => updateRow('detailedTasks', row.id, { description: v })} /></td>
            <td><CellInput value={row.assignee} onChange={(v) => updateRow('detailedTasks', row.id, { assignee: v })} /></td>
            <td><CellInput type="number" value={row.quantity} onChange={(v) => updateRow('detailedTasks', row.id, { quantity: Number(v) })} /></td>
            <td><CellSelect value={row.unit} options={unitOptions} onChange={(v) => updateRow('detailedTasks', row.id, { unit: v })} /></td>
            <td><CellInput type="number" value={row.unitValue} onChange={(v) => updateRow('detailedTasks', row.id, { unitValue: Number(v) })} /></td>
            <td><CellSelect value={row.status} options={statusOptions} onChange={(v) => updateRow('detailedTasks', row.id, { status: v })} /></td>
            <td className="money-cell">{money(lineSubtotal(row), budget.currency)}</td>
            <td><CellInput value={row.notes} onChange={(v) => updateRow('detailedTasks', row.id, { notes: v })} /></td>
            <td className="inline-actions"><IconButton onClick={() => updateBudget({ detailedTasks: [...budget.detailedTasks, { ...row, id: crypto.randomUUID(), taskName: `${row.taskName} copia` }] })} icon={<Copy size={15} />} /><IconButton onClick={() => removeRow('detailedTasks', row.id)} icon={<Trash2 size={15} />} /></td>
          </tr>
        ))}
      </EditableTable>
      <button className="add-row" onClick={() => updateBudget({ detailedTasks: [...budget.detailedTasks, createDetailedTask()] })}><Plus size={16} /> Agregar tarea</button>
    </CrudSection>
  )
}

function SummarySection({ budget, totals, updateNested }) {
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

  return (
    <section className="panel">
      <SectionTitle icon={<BarChart3 />} eyebrow="Calculos automáticos" title="Resumen de costos" />
      <div className="summary-layout">
        <FeePanel budget={budget} updateNested={updateNested} />
        <TotalsPanel budget={budget} totals={totals} />
      </div>
      <div className="chart-grid">
        <ChartCard title="Por area" data={chartDataFromTotals(areaTotals)} />
        <ChartCard title="Equipo vs tareas" data={modeData} />
        <ListCard title="Total por persona / rol" totals={peopleTotals} currency={budget.currency} />
      </div>
    </section>
  )
}

function ExportSection({ budget, totals, updateNested, exportRef, exportImage, exportPdf }) {
  const opts = budget.exportOptions
  const visibleBallpark = budget.ballparkItems.filter((row) => row.included)
  const visibleDetailed = budget.detailedTasks.filter((row) => row.included)
  const visibleTeam = budget.teamMembers.filter((row) => row.included)

  return (
    <section className="panel">
      <SectionTitle icon={<Download />} eyebrow="PDF / PNG" title="Vista de presupuesto para exportar" />
      <div className="export-controls">
        {['cover', 'projectData', 'executiveSummary', 'team', 'ballpark', 'detailed', 'totals', 'notes'].map((key) => (
          <label key={key}><input type="checkbox" checked={opts[key]} onChange={(e) => updateNested('exportOptions', { [key]: e.target.checked })} /> {key}</label>
        ))}
        <Select label="Vista" value={opts.view} options={['Cliente', 'Interna']} onChange={(v) => updateNested('exportOptions', { view: v })} />
        <button className="primary" onClick={exportPdf}><FileText size={16} /> PDF</button>
        <button className="primary" onClick={exportImage}><FileImage size={16} /> PNG</button>
      </div>

      <div className="export-page" ref={exportRef} style={{ backgroundColor: budget.brandSettings.backgroundColor }}>
        {budget.brandSettings.technicalGrid && <div className="export-grid-bg" />}
        {opts.cover && (
          <div className="export-cover">
            <div className="export-logo"><img src={budget.brandSettings.logo || `${assetBase}logo.png`} alt="BANI VFX" /></div>
            <p>{budget.budgetNumber} / {budget.version}</p>
            <h2>{budget.projectName}</h2>
            <span>{budget.client || 'Cliente'} - {budget.date}</span>
          </div>
        )}
        {opts.projectData && <ExportBlock title="Datos del proyecto" rows={[
          ['Cliente', budget.client], ['Agencia / productora', budget.agency || budget.productionCompany], ['Responsable', budget.owner], ['Moneda', budget.currency], ['Tipo', budget.budgetMode],
        ]} />}
        {opts.executiveSummary && <ExportBlock title="Resumen ejecutivo" rows={[
          ['Subtotal equipo', money(totals.subtotalTeam, budget.currency)],
          ['Subtotal ballpark', money(totals.subtotalBallpark, budget.currency)],
          ['Subtotal detallado', money(totals.subtotalDetailed, budget.currency)],
          ['Total final', money(totals.totalFinal, budget.currency)],
        ]} highlight />}
        {opts.team && <ExportTable title="Equipo involucrado" rows={visibleTeam.map((r) => [r.name || r.role, r.area, `${r.days} dias`, money(teamSubtotal(r), budget.currency)])} />}
        {opts.ballpark && totals.isBallpark && <ExportTable title="Presupuesto ballpark" rows={visibleBallpark.map((r) => [r.name, r.description, r.quantity, money(lineSubtotal(r), budget.currency)])} />}
        {opts.detailed && totals.isDetailed && <ExportTable title="Presupuesto detallado" rows={visibleDetailed.map((r) => [r.area, r.taskName, `${r.quantity} ${r.unit}`, money(lineSubtotal(r), budget.currency)])} />}
        {opts.totals && <TotalsPanel budget={budget} totals={totals} exportMode />}
        {opts.notes && <div className="export-notes"><h3>Notas</h3><p>{budget.notes.clientNotes}</p>{opts.view === 'Interna' && <p>{budget.notes.internalNotes}</p>}</div>}
        <footer>© BANI VFX - Postproduccion, VFX & 3D</footer>
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

function TotalsPanel({ budget, totals, exportMode = false }) {
  return (
    <div className={exportMode ? 'totals-panel export-totals' : 'totals-panel'}>
      <Line label="Subtotal equipo" value={money(totals.subtotalTeam, budget.currency)} />
      <Line label="Subtotal ballpark" value={money(totals.subtotalBallpark, budget.currency)} />
      <Line label="Subtotal detallado" value={money(totals.subtotalDetailed, budget.currency)} />
      <Line label="Base" value={money(totals.base, budget.currency)} />
      <Line label="Fee" value={money(totals.productionFee, budget.currency)} />
      <Line label="Contingencia" value={money(totals.contingency, budget.currency)} />
      <Line label="Descuento" value={`-${money(totals.discount, budget.currency)}`} />
      <Line label="Impuestos" value={money(totals.tax, budget.currency)} />
      <Line label="Total final" value={money(totals.totalFinal, budget.currency)} strong />
      {budget.budgetMode === 'Ambos' && <Line label="Diferencia ballpark/detallado" value={money(totals.ballparkDetailedDiff, budget.currency)} />}
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

function IconButton({ icon, onClick }) {
  return <button className="icon-button" onClick={onClick}>{icon}</button>
}

function Line({ label, value, strong }) {
  return <div className={`line ${strong ? 'strong' : ''}`}><span>{label}</span><b>{value}</b></div>
}

export default App
