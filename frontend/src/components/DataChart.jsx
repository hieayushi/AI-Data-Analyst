/**
 * DataChart.jsx
 *
 * Intelligently picks the best chart type based on the data shape:
 *  - 2 columns (label + number)  → Bar chart (≤10 rows) or Line chart (>10 rows)
 *  - 2 columns, small dataset   → Pie / Donut
 *  - 3+ columns with numbers    → Multi-series bar / line
 *  - Single numeric result      → KPI card (no chart)
 *
 * Uses Recharts for rendering.
 */
import { useMemo } from 'react'
import {
  ResponsiveContainer,
  BarChart, Bar,
  LineChart, Line,
  PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from 'recharts'
import { BarChart2 } from 'lucide-react'

const COLORS = [
  'var(--chart-1)',
  'var(--chart-2)',
  'var(--chart-3)',
  'var(--chart-4)',
  'var(--chart-5)',
  'var(--chart-6)',
]

// Solid hex fallbacks for Recharts (CSS vars don't always work inside SVG fills)
const HEX_COLORS = ['#6366f1', '#10b981', '#f59e0b', '#3b82f6', '#ec4899', '#8b5cf6']

function isNumeric(val) {
  if (val === null || val === undefined || val === '') return false
  return !isNaN(Number(val))
}

function formatNumber(val) {
  const n = Number(val)
  if (isNaN(n)) return String(val)
  if (Math.abs(n) >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M'
  if (Math.abs(n) >= 1_000)     return (n / 1_000).toFixed(1) + 'K'
  if (n % 1 !== 0)              return n.toFixed(2)
  return n.toLocaleString()
}

function truncateLabel(str, max = 14) {
  const s = String(str ?? '')
  return s.length > max ? s.slice(0, max) + '…' : s
}

/** Custom tooltip shared by bar/line */
function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div style={{
      background: 'var(--bg-2)',
      border: '1px solid var(--border)',
      borderRadius: 10,
      padding: '10px 14px',
      boxShadow: 'var(--shadow)',
      fontSize: 12,
      fontFamily: 'var(--font-body)',
      minWidth: 120,
    }}>
      <p style={{ fontWeight: 600, color: 'var(--text)', marginBottom: 6 }}>{label}</p>
      {payload.map((p, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 3 }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: p.color }} />
          <span style={{ color: 'var(--text-3)' }}>{p.name}:</span>
          <span style={{ color: 'var(--text)', fontWeight: 600 }}>{formatNumber(p.value)}</span>
        </div>
      ))}
    </div>
  )
}

/** Custom pie tooltip */
function PieTooltip({ active, payload }) {
  if (!active || !payload?.length) return null
  const { name, value } = payload[0]
  return (
    <div style={{
      background: 'var(--bg-2)', border: '1px solid var(--border)',
      borderRadius: 10, padding: '8px 12px', boxShadow: 'var(--shadow)',
      fontSize: 12, fontFamily: 'var(--font-body)',
    }}>
      <p style={{ fontWeight: 600, color: 'var(--text)' }}>{name}</p>
      <p style={{ color: 'var(--text-2)', marginTop: 2 }}>{formatNumber(value)}</p>
    </div>
  )
}

export default function DataChart({ columns, rows }) {
  const analysis = useMemo(() => {
    if (!columns?.length || !rows?.length) return null

    // Identify numeric and label columns
    const numericCols = []
    const labelCols   = []

    columns.forEach((col, ci) => {
      const vals = rows.map(r => r[ci]).filter(v => v !== null && v !== undefined)
      const numericCount = vals.filter(v => isNumeric(v)).length
      if (numericCount / vals.length > 0.7) {
        numericCols.push({ col, ci })
      } else {
        labelCols.push({ col, ci })
      }
    })

    if (numericCols.length === 0) return null  // no numeric data to chart

    const labelCol = labelCols[0]
    const rowCount = rows.length

    // Build chart data
    const data = rows.map(row => {
      const entry = {}
      if (labelCol) entry.label = truncateLabel(row[labelCol.ci])
      numericCols.forEach(({ col, ci }) => {
        entry[col] = isNumeric(row[ci]) ? Number(row[ci]) : 0
      })
      return entry
    })

    // Choose chart type
    if (numericCols.length === 1 && labelCols.length === 1) {
      if (rowCount <= 7) return { type: 'pie',  data, numericCols, labelCol }
      if (rowCount <= 20) return { type: 'bar',  data, numericCols, labelCol }
      return                    { type: 'line', data, numericCols, labelCol }
    }

    // Multi-numeric: prefer bar for ≤20 rows else line
    if (rowCount <= 20) return { type: 'bar',  data, numericCols, labelCol }
    return                    { type: 'line', data, numericCols, labelCol }
  }, [columns, rows])

  if (!analysis) return null

  const { type, data, numericCols, labelCol } = analysis
  const height = 280

  const chartTitle = numericCols.map(n => n.col).join(', ')

  return (
    <div className="chart-container animate-fade-in" style={{ marginTop: 4 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingLeft: 8, marginBottom: 12 }}>
        <BarChart2 size={14} style={{ color: 'var(--accent)' }} />
        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-2)', fontFamily: 'var(--font-body)' }}>
          {chartTitle}
        </span>
        <span
          style={{
            marginLeft: 'auto', marginRight: 8,
            fontSize: 10, color: 'var(--text-3)',
            background: 'var(--bg-3)', padding: '2px 7px',
            borderRadius: 99, border: '1px solid var(--border)',
          }}
        >
          {type === 'pie' ? 'Pie' : type === 'bar' ? 'Bar chart' : 'Line chart'}
        </span>
      </div>

      {type === 'bar' && (
        <ResponsiveContainer width="100%" height={height}>
          <BarChart data={data} margin={{ top: 4, right: 16, left: 0, bottom: 24 }}
            barCategoryGap="30%" barGap={4}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 11, fill: 'var(--text-3)', fontFamily: 'Inter' }}
              axisLine={false} tickLine={false}
              interval={0} angle={data.length > 8 ? -35 : 0}
              textAnchor={data.length > 8 ? 'end' : 'middle'}
            />
            <YAxis
              tick={{ fontSize: 11, fill: 'var(--text-3)', fontFamily: 'Inter' }}
              axisLine={false} tickLine={false}
              tickFormatter={formatNumber}
              width={52}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(99,102,241,0.06)' }} />
            {numericCols.length > 1 && <Legend wrapperStyle={{ fontSize: 11, fontFamily: 'Inter', paddingTop: 8 }} />}
            {numericCols.map(({ col }, i) => (
              <Bar key={col} dataKey={col} fill={HEX_COLORS[i % HEX_COLORS.length]}
                radius={[4, 4, 0, 0]} maxBarSize={60} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      )}

      {type === 'line' && (
        <ResponsiveContainer width="100%" height={height}>
          <LineChart data={data} margin={{ top: 4, right: 16, left: 0, bottom: 24 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 11, fill: 'var(--text-3)', fontFamily: 'Inter' }}
              axisLine={false} tickLine={false}
              interval={Math.floor(data.length / 8)}
            />
            <YAxis
              tick={{ fontSize: 11, fill: 'var(--text-3)', fontFamily: 'Inter' }}
              axisLine={false} tickLine={false}
              tickFormatter={formatNumber}
              width={52}
            />
            <Tooltip content={<CustomTooltip />} />
            {numericCols.length > 1 && <Legend wrapperStyle={{ fontSize: 11, fontFamily: 'Inter', paddingTop: 8 }} />}
            {numericCols.map(({ col }, i) => (
              <Line
                key={col} type="monotone" dataKey={col}
                stroke={HEX_COLORS[i % HEX_COLORS.length]}
                strokeWidth={2.5} dot={data.length <= 30}
                activeDot={{ r: 5 }}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      )}

      {type === 'pie' && (
        <ResponsiveContainer width="100%" height={height}>
          <PieChart>
            <Pie
              data={data.map(d => ({
                name: d.label ?? 'Other',
                value: d[numericCols[0].col],
              }))}
              cx="50%" cy="50%"
              innerRadius={60} outerRadius={100}
              paddingAngle={3}
              dataKey="value"
              label={({ name, percent }) =>
                `${truncateLabel(name, 10)} ${(percent * 100).toFixed(0)}%`
              }
              labelLine={false}
            >
              {data.map((_, i) => (
                <Cell key={i} fill={HEX_COLORS[i % HEX_COLORS.length]} />
              ))}
            </Pie>
            <Tooltip content={<PieTooltip />} />
            <Legend
              wrapperStyle={{ fontSize: 11, fontFamily: 'Inter', paddingTop: 4 }}
              formatter={(value) => truncateLabel(value, 18)}
            />
          </PieChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}
