import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../supabase'
import { fmtBDT } from '../lib/helpers'
import { Plus, Trash2, Pencil, Save, Search, ChefHat, X, FolderPlus } from 'lucide-react'

export default function MenuManagement({ isAdmin }) {
  const [cats, setCats] = useState([])
  const [items, setItems] = useState([])
  const [invItems, setInvItems] = useState([])
  const [latestCost, setLatestCost] = useState({}) // inv_item_id -> latest unit_cost (from most recent GRN)
  const [search, setSearch] = useState('')
  const [activeCat, setActiveCat] = useState('ALL')
  const [editing, setEditing] = useState(null) // null = closed, 'NEW' = creating, {..item} = editing
  const [newCatName, setNewCatName] = useState('')
  const [msg, setMsg] = useState('')
  const flash = (m) => { setMsg(m); setTimeout(() => setMsg(''), 4000) }

  const loadAll = async () => {
    const [{ data: c }, { data: it }, { data: inv }, { data: grn }] = await Promise.all([
      supabase.from('menu_categories').select('*').order('sort_order').order('name'),
      supabase.from('menu_items').select('*').order('sort_order').order('name'),
      supabase.from('inv_items').select('*').eq('is_active', true).order('name'),
      supabase.from('grn_items').select('item_id, unit_cost, goods_receipts(grn_date)'),
    ])
    setCats(c || [])
    setItems(it || [])
    setInvItems(inv || [])

    // Build "latest purchase cost per raw-material item" map — used to estimate recipe cost.
    const byItem = {}
    ;(grn || []).forEach((row) => {
      const date = row.goods_receipts?.grn_date
      if (!date || !row.item_id) return
      const cur = byItem[row.item_id]
      if (!cur || date > cur.date) byItem[row.item_id] = { date, cost: Number(row.unit_cost) || 0 }
    })
    const costMap = {}
    Object.entries(byItem).forEach(([id, v]) => { costMap[id] = v.cost })
    setLatestCost(costMap)
  }
  useEffect(() => { loadAll() }, [])

  const filtered = items.filter((it) =>
    (activeCat === 'ALL' || it.category_id === activeCat) &&
    (!search || it.name.toLowerCase().includes(search.toLowerCase()))
  )

  // ---------------- Categories ----------------
  const addCategory = async () => {
    if (!newCatName.trim()) return
    await supabase.from('menu_categories').insert({ name: newCatName.trim(), sort_order: cats.length + 1 })
    setNewCatName(''); await loadAll()
  }
  const toggleCategory = async (c) => { await supabase.from('menu_categories').update({ is_active: !c.is_active }).eq('id', c.id); await loadAll() }
  const renameCategory = async (c) => {
    const name = window.prompt('Category name:', c.name)
    if (!name || !name.trim() || name.trim() === c.name) return
    await supabase.from('menu_categories').update({ name: name.trim() }).eq('id', c.id); await loadAll()
  }
  const deleteCategory = async (c) => {
    const inUse = items.some((it) => it.category_id === c.id)
    if (inUse) { flash(`"${c.name}" has menu items in it — move or delete those first.`); return }
    if (!window.confirm(`Delete category "${c.name}"?`)) return
    await supabase.from('menu_categories').delete().eq('id', c.id); await loadAll()
  }

  // ---------------- Menu items ----------------
  const toggleItem = async (it) => { await supabase.from('menu_items').update({ is_active: !it.is_active }).eq('id', it.id); await loadAll() }
  const deleteItem = async (it) => {
    if (!window.confirm(`Delete "${it.name}"? This also removes its recipe (BOM), if any.`)) return
    await supabase.from('recipe_items').delete().eq('menu_item_id', it.id)
    await supabase.from('menu_items').delete().eq('id', it.id)
    flash(`"${it.name}" deleted.`)
    await loadAll()
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-pine">Menu Management</h1>
          <p className="text-sm text-pine/60">Dishes, categories, and recipe (BOM) costing for Restaurant POS.</p>
        </div>
        {isAdmin && (
          <button className="btn-primary" onClick={() => setEditing('NEW')}><Plus size={16} /> New menu item</button>
        )}
      </div>
      {msg && <div className="mb-4 px-4 py-2 rounded-lg bg-forest/10 text-forest text-sm font-medium">{msg}</div>}

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {/* Categories sidebar */}
        <div className="card p-4">
          <h3 className="font-display font-semibold text-pine mb-3">Categories</h3>
          {isAdmin && (
            <div className="flex gap-2 mb-3">
              <input className="input flex-1 !py-1.5 text-sm" placeholder="New category" value={newCatName} onChange={(e) => setNewCatName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addCategory()} />
              <button className="btn-ghost !py-1.5 !px-2" onClick={addCategory}><FolderPlus size={15} /></button>
            </div>
          )}
          <button
            onClick={() => setActiveCat('ALL')}
            className={`w-full text-left px-2 py-1.5 rounded-lg text-sm mb-1 ${activeCat === 'ALL' ? 'bg-forest/10 text-forest font-semibold' : 'hover:bg-leaf/40 text-pine'}`}
          >
            All items <span className="text-xs text-pine/40">({items.length})</span>
          </button>
          {cats.map((c) => (
            <div key={c.id} className={`flex items-center justify-between px-2 py-1.5 rounded-lg text-sm mb-1 ${activeCat === c.id ? 'bg-forest/10' : 'hover:bg-leaf/40'}`}>
              <button onClick={() => setActiveCat(c.id)} className={`flex-1 text-left ${activeCat === c.id ? 'text-forest font-semibold' : 'text-pine'} ${!c.is_active ? 'opacity-40' : ''}`}>
                {c.name} <span className="text-xs text-pine/40">({items.filter((it) => it.category_id === c.id).length})</span>
              </button>
              {isAdmin && (
                <div className="flex gap-1 shrink-0">
                  <button onClick={() => renameCategory(c)} className="text-pine/30 hover:text-forest"><Pencil size={11} /></button>
                  <button onClick={() => toggleCategory(c)} className={`text-xs px-1.5 rounded ${c.is_active ? 'text-forest' : 'text-stone-400'}`} title={c.is_active ? 'Active — click to disable' : 'Disabled — click to enable'}>●</button>
                  <button onClick={() => deleteCategory(c)} className="text-red-300 hover:text-red-600"><Trash2 size={11} /></button>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Items list */}
        <div className="card p-4 lg:col-span-3">
          <div className="relative mb-3">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-pine/30" />
            <input className="input pl-9" placeholder="Search menu items…" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <table className="w-full">
            <thead>
              <tr>
                <th className="th">Item</th>
                <th className="th">Category</th>
                <th className="th text-right">Price</th>
                <th className="th text-right">Recipe cost</th>
                <th className="th text-right">Margin</th>
                <th className="th">Status</th>
                <th className="th text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((it) => (
                <tr key={it.id} className="hover:bg-leaf/20">
                  <td className="td font-medium text-sm">{it.name}{it.measuring_units ? <span className="text-xs text-pine/40 ml-1">({it.measuring_units})</span> : ''}</td>
                  <td className="td text-xs text-pine/60">{cats.find((c) => c.id === it.category_id)?.name || '—'}</td>
                  <td className="td text-right money font-semibold">{fmtBDT(it.price)}</td>
                  <td className="td text-right"><RecipeCostBadge menuItemId={it.id} latestCost={latestCost} /></td>
                  <td className="td text-right"><RecipeMarginBadge menuItemId={it.id} latestCost={latestCost} price={it.price} /></td>
                  <td className="td">
                    <button onClick={() => isAdmin && toggleItem(it)} disabled={!isAdmin} className={`status-chip ${it.is_active ? 'bg-forest/15 text-forest' : 'bg-stone-200 text-stone-600'} ${!isAdmin ? 'cursor-default' : ''}`}>{it.is_active ? 'ACTIVE' : 'OFF'}</button>
                  </td>
                  <td className="td text-right">
                    <div className="flex justify-end gap-1">
                      <button className="btn-ghost !py-1 !px-2 text-xs" onClick={() => setEditing(it)}><Pencil size={12} /> Edit</button>
                      {isAdmin && <button onClick={() => deleteItem(it)} className="text-red-300 hover:text-red-600 px-1"><Trash2 size={14} /></button>}
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td className="td text-pine/50 text-center py-6" colSpan={7}>
                  {search ? `No items match "${search}".` : 'No menu items yet — click "New menu item" to add your first dish.'}
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {editing && (
        <MenuItemEditor
          item={editing === 'NEW' ? null : editing}
          cats={cats}
          invItems={invItems}
          latestCost={latestCost}
          isAdmin={isAdmin}
          onClose={() => setEditing(null)}
          onSaved={async (m) => { setEditing(null); await loadAll(); flash(m) }}
        />
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Small inline badges — load + cache a menu item's recipe cost        */
/* ------------------------------------------------------------------ */
const recipeCache = {} // module-level cache: menu_item_id -> recipe_items[] (avoids refetch per badge per render)

function useRecipeCost(menuItemId, latestCost) {
  const [recipe, setRecipe] = useState(recipeCache[menuItemId] || null)
  useEffect(() => {
    let alive = true
    if (recipeCache[menuItemId]) { setRecipe(recipeCache[menuItemId]); return }
    supabase.from('recipe_items').select('item_id, qty_per_unit').eq('menu_item_id', menuItemId).then(({ data }) => {
      if (!alive) return
      recipeCache[menuItemId] = data || []
      setRecipe(data || [])
    })
    return () => { alive = false }
  }, [menuItemId])
  if (!recipe) return null
  if (recipe.length === 0) return 0
  return recipe.reduce((sum, r) => sum + (Number(r.qty_per_unit) || 0) * (latestCost[r.item_id] || 0), 0)
}

function RecipeCostBadge({ menuItemId, latestCost }) {
  const cost = useRecipeCost(menuItemId, latestCost)
  if (cost === null) return <span className="text-xs text-pine/30">…</span>
  if (cost === 0) return <span className="text-xs text-pine/30">No recipe</span>
  return <span className="money text-sm text-amber-700">{fmtBDT(cost)}</span>
}

function RecipeMarginBadge({ menuItemId, latestCost, price }) {
  const cost = useRecipeCost(menuItemId, latestCost)
  if (cost === null || cost === 0) return <span className="text-xs text-pine/30">—</span>
  const p = Number(price) || 0
  if (p <= 0) return <span className="text-xs text-pine/30">—</span>
  const margin = ((p - cost) / p) * 100
  const color = margin < 0 ? 'text-red-600' : margin < 30 ? 'text-amber-600' : 'text-forest'
  return <span className={`text-xs font-semibold ${color}`}>{margin.toFixed(0)}%</span>
}

/* ------------------------------------------------------------------ */
/*  Create / Edit modal — item fields + BOM (recipe) ingredient editor  */
/* ------------------------------------------------------------------ */
function MenuItemEditor({ item, cats, invItems, latestCost, isAdmin, onClose, onSaved }) {
  const [form, setForm] = useState({
    name: item?.name || '',
    category_id: item?.category_id || (cats[0]?.id || ''),
    price: item?.price ?? '',
    measuring_units: item?.measuring_units || '',
    sort_order: item?.sort_order ?? 0,
    is_active: item?.is_active ?? true,
  })
  const [recipe, setRecipe] = useState([]) // [{id, item_id, item_name, qty_per_unit, unit}]
  const [recipeLoaded, setRecipeLoaded] = useState(!item)
  const [ingSearch, setIngSearch] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  useEffect(() => {
    if (!item) { setRecipeLoaded(true); return }
    supabase.from('recipe_items').select('*').eq('menu_item_id', item.id).then(({ data }) => {
      setRecipe(data || [])
      setRecipeLoaded(true)
    })
  }, [item?.id])

  const filteredInv = invItems.filter((i) =>
    !ingSearch || i.name.toLowerCase().includes(ingSearch.toLowerCase()) || (i.code || '').toLowerCase().includes(ingSearch.toLowerCase())
  ).filter((i) => !recipe.some((r) => r.item_id === i.id))

  const addIngredient = (inv) => {
    setRecipe((prev) => [...prev, { id: null, item_id: inv.id, item_name: inv.name, qty_per_unit: 1, unit: inv.unit }])
    setIngSearch('')
  }
  const updateIngredientQty = (idx, val) => setRecipe((prev) => prev.map((r, i) => (i === idx ? { ...r, qty_per_unit: val } : r)))
  const removeIngredient = (idx) => setRecipe((prev) => prev.filter((_, i) => i !== idx))

  const estimatedCost = recipe.reduce((sum, r) => sum + (Number(r.qty_per_unit) || 0) * (latestCost[r.item_id] || 0), 0)
  const sellPrice = Number(form.price) || 0
  const margin = sellPrice > 0 && estimatedCost > 0 ? ((sellPrice - estimatedCost) / sellPrice) * 100 : null

  const save = async () => {
    if (!isAdmin) return
    if (!form.name.trim()) { setErr('নাম দিন।'); return }
    if (!form.category_id) { setErr('Category বেছে নিন।'); return }
    if (form.price === '' || isNaN(Number(form.price))) { setErr('সঠিক দাম দিন।'); return }
    setErr('')
    setBusy(true)
    try {
      let menuItemId = item?.id
      const payload = {
        name: form.name.trim(),
        category_id: form.category_id,
        price: Number(form.price),
        measuring_units: form.measuring_units || null,
        sort_order: Number(form.sort_order) || 0,
        is_active: form.is_active,
      }
      if (item) {
        const { error } = await supabase.from('menu_items').update(payload).eq('id', item.id)
        if (error) throw error
      } else {
        const { data, error } = await supabase.from('menu_items').insert(payload).select().single()
        if (error) throw error
        menuItemId = data.id
      }

      // Sync recipe_items (BOM): delete removed rows, update existing, insert new
      const { data: existingRecipe } = await supabase.from('recipe_items').select('id').eq('menu_item_id', menuItemId)
      const keepIds = recipe.map((r) => r.id).filter(Boolean)
      const toDelete = (existingRecipe || []).map((r) => r.id).filter((id) => !keepIds.includes(id))
      if (toDelete.length) await supabase.from('recipe_items').delete().in('id', toDelete)
      for (const r of recipe) {
        const row = { menu_item_id: menuItemId, item_id: r.item_id, item_name: r.item_name, qty_per_unit: Number(r.qty_per_unit) || 0, unit: r.unit }
        if (r.id) await supabase.from('recipe_items').update(row).eq('id', r.id)
        else await supabase.from('recipe_items').insert(row)
      }
      delete recipeCache[menuItemId] // invalidate badge cache so list reflects new recipe immediately
      onSaved(item ? `"${form.name}" আপডেট হয়েছে।` : `"${form.name}" নতুন আইটেম হিসেবে যোগ হয়েছে।`)
    } catch (e) {
      setErr(e.message)
    }
    setBusy(false)
  }

  return (
    <div className="fixed inset-0 bg-ink/60 z-50 flex items-start justify-center overflow-auto p-3 sm:p-6">
      <div className="card max-w-2xl w-full p-4 sm:p-6 my-3 sm:my-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-display text-lg font-bold text-pine">{item ? `Edit — ${item.name}` : 'New Menu Item'}</h2>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-leaf text-pine/40 hover:text-pine">✕</button>
        </div>

        {err && <div className="mb-3 px-3 py-2 rounded-lg bg-red-50 text-red-600 text-sm">{err}</div>}

        <fieldset className="border border-leaf rounded-xl p-4 mb-4" disabled={!isAdmin}>
          <legend className="text-xs font-bold text-pine/60 px-2 uppercase tracking-wide">Item Details</legend>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="sm:col-span-2"><label className="label">Name *</label>
              <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div><label className="label">Category *</label>
              <select className="input" value={form.category_id} onChange={(e) => setForm({ ...form, category_id: e.target.value })}>
                <option value="">Select…</option>
                {cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div><label className="label">Price ৳ *</label>
              <input type="number" className="input money" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} />
            </div>
            <div><label className="label">Measuring unit</label>
              <input className="input" placeholder="e.g. plate, bowl, pc" value={form.measuring_units} onChange={(e) => setForm({ ...form, measuring_units: e.target.value })} />
            </div>
            <div><label className="label">Sort order</label>
              <input type="number" className="input" value={form.sort_order} onChange={(e) => setForm({ ...form, sort_order: e.target.value })} />
            </div>
            <div className="sm:col-span-2 flex items-center gap-2">
              <input type="checkbox" id="itemActive" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} />
              <label htmlFor="itemActive" className="text-sm font-medium">Active (visible in POS)</label>
            </div>
          </div>
        </fieldset>

        <fieldset className="border border-leaf rounded-xl p-4 mb-5" disabled={!isAdmin}>
          <legend className="text-xs font-bold text-pine/60 px-2 uppercase tracking-wide flex items-center gap-1"><ChefHat size={13} /> Bill of Materials / Recipe</legend>          

          {!recipeLoaded ? (
            <p className="text-xs text-pine/40">লোড হচ্ছে…</p>
          ) : (
            <>
              {recipe.length > 0 && (
                <div className="space-y-1.5 mb-3">
                  {recipe.map((r, idx) => (
                    <div key={r.item_id} className="flex items-center gap-2 text-sm">
                      <span className="flex-1">{r.item_name}</span>
                      <input
                        type="number" step="0.01" min="0"
                        className="input !w-24 !py-1 money text-right"
                        value={r.qty_per_unit}
                        onChange={(e) => updateIngredientQty(idx, e.target.value)}
                      />
                      <span className="text-xs text-pine/50 w-12">{r.unit}</span>
                      <span className="text-xs text-amber-700 money w-20 text-right">{fmtBDT((Number(r.qty_per_unit) || 0) * (latestCost[r.item_id] || 0))}</span>
                      {isAdmin && <button onClick={() => removeIngredient(idx)} className="text-red-300 hover:text-red-600"><Trash2 size={13} /></button>}
                    </div>
                  ))}
                </div>
              )}
              {isAdmin && (
                <div className="relative">
                  <input
                    className="input text-sm"
                    placeholder="+ Search a raw material to add…"
                    value={ingSearch}
                    onChange={(e) => setIngSearch(e.target.value)}
                  />
                  {ingSearch && (
                    <div className="absolute z-10 mt-1 w-full bg-white border border-leaf rounded-xl shadow-lg max-h-44 overflow-y-auto">
                      {filteredInv.length === 0 && <div className="px-3 py-2 text-sm text-pine/40">No matching items — add it first in Inventory → Items.</div>}
                      {filteredInv.map((inv) => (
                        <button key={inv.id} type="button" onClick={() => addIngredient(inv)} className="w-full text-left px-3 py-2 text-sm hover:bg-leaf/40">
                          {inv.name} <span className="text-xs text-pine/40">({inv.unit})</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <div className="border-t border-leaf mt-3 pt-3 flex justify-between text-sm">
                <span className="font-semibold text-pine">Estimated recipe cost</span>
                <span className="font-bold money text-amber-700">{fmtBDT(estimatedCost)}</span>
              </div>
              {margin !== null && (
                <div className="flex justify-between text-xs mt-1">
                  <span className="text-pine/50">Margin at current price ({fmtBDT(sellPrice)})</span>
                  <span className={`font-semibold ${margin < 0 ? 'text-red-600' : margin < 30 ? 'text-amber-600' : 'text-forest'}`}>{margin.toFixed(1)}%</span>
                </div>
              )}
            </>
          )}
        </fieldset>

        <div className="flex flex-wrap gap-3 justify-end border-t border-leaf pt-4">
          <button className="btn-ghost" onClick={onClose}>{isAdmin ? 'Cancel' : 'Close'}</button>
          {isAdmin && (
            <button className="btn-primary" onClick={save} disabled={busy}><Save size={16} /> {busy ? 'Saving…' : 'Save'}</button>
          )}
        </div>
      </div>
    </div>
  )
}
