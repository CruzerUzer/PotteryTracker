import React, { useState, useEffect } from 'react';
import { piecesAPI, phasesAPI, locationsAPI } from '../services/api';
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, Legend
} from 'recharts';
import { Package, CheckCircle, Clock, TrendingUp, MapPin, Layers } from 'lucide-react';

const PHASE_COLORS = [
  'var(--phase-color-1-accent)',
  'var(--phase-color-2-accent)',
  'var(--phase-color-3-accent)',
  'var(--phase-color-4-accent)',
  'var(--phase-color-5-accent)',
];

const RADIAN = Math.PI / 180;

const CustomPieLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent, name }) => {
  if (percent < 0.05) return null;
  const radius = innerRadius + (outerRadius - innerRadius) * 0.55;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);
  return (
    <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central" fontSize={11} fontWeight={600}>
      {`${(percent * 100).toFixed(0)}%`}
    </text>
  );
};

function KpiCard({ icon: Icon, label, value, sub, color }) {
  return (
    <div style={{
      background: 'var(--color-surface)',
      borderRadius: 'var(--radius-xl)',
      border: '1px solid var(--color-border)',
      boxShadow: 'var(--shadow-md)',
      padding: '20px 24px',
      display: 'flex',
      alignItems: 'center',
      gap: '16px',
      transition: 'all 220ms ease',
    }}
    onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = 'var(--shadow-card-hover)'; }}
    onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = 'var(--shadow-md)'; }}
    >
      <div style={{
        width: 48, height: 48, borderRadius: '50%',
        background: color ? `${color}18` : 'var(--color-primary-light)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0,
      }}>
        <Icon size={22} color={color || 'var(--color-primary)'} />
      </div>
      <div>
        <div style={{ fontSize: '0.75rem', color: 'var(--color-text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 500, marginBottom: 2 }}>{label}</div>
        <div style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--color-text-primary)', lineHeight: 1.1 }}>{value}</div>
        {sub && <div style={{ fontSize: '0.78rem', color: 'var(--color-text-secondary)', marginTop: 2 }}>{sub}</div>}
      </div>
    </div>
  );
}

function StatsDashboard() {
  const [pieces, setPieces] = useState([]);
  const [phases, setPhases] = useState([]);
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const [p, ph, loc] = await Promise.all([
          piecesAPI.getAll(),
          phasesAPI.getAll(),
          locationsAPI.getAll(),
        ]);
        setPieces(p);
        setPhases(ph.sort((a, b) => (a.display_order || 0) - (b.display_order || 0)));
        setLocations(loc);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  if (loading) {
    return (
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16 }}>
        {[1,2,3,4].map(i => <div key={i} className="skeleton" style={{ height: 100, borderRadius: 14 }} />)}
      </div>
    );
  }

  const totalPieces = pieces.length;
  const donePieces = pieces.filter(p => p.done === 1).length;
  const activePieces = totalPieces - donePieces;
  const completionRate = totalPieces > 0 ? Math.round((donePieces / totalPieces) * 100) : 0;

  // Pieces per phase
  const phaseData = phases.map((phase, idx) => ({
    name: phase.name,
    count: pieces.filter(p => p.current_phase_id === phase.id && p.done !== 1).length,
    color: PHASE_COLORS[idx % PHASE_COLORS.length],
  })).filter(d => d.count > 0);

  // Pieces per location
  const locationData = [
    ...locations.map(loc => ({
      name: loc.name,
      count: pieces.filter(p => p.current_location_id === loc.id).length,
    })),
    {
      name: 'Ingen plats',
      count: pieces.filter(p => !p.current_location_id).length,
    }
  ].filter(d => d.count > 0);

  // Pieces created per month (last 6 months)
  const now = new Date();
  const monthlyData = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
    const label = d.toLocaleDateString('sv-SE', { month: 'short' });
    const count = pieces.filter(p => {
      const created = new Date(p.created_at);
      return created.getFullYear() === d.getFullYear() && created.getMonth() === d.getMonth();
    }).length;
    return { name: label, count };
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <h2 style={{
        fontFamily: 'var(--font-family-display)',
        fontSize: '1.8rem',
        fontWeight: 600,
        letterSpacing: '0.01em',
        color: 'var(--color-text-primary)',
      }}>
        Statistik
      </h2>

      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16 }}>
        <KpiCard icon={Package} label="Totalt" value={totalPieces} sub="pjäser skapade" />
        <KpiCard icon={Clock} label="Aktiva" value={activePieces} sub="i arbete" color="var(--phase-color-2-accent)" />
        <KpiCard icon={CheckCircle} label="Färdiga" value={donePieces} sub="klara pjäser" color="var(--color-success)" />
        <KpiCard icon={TrendingUp} label="Färdiggrad" value={`${completionRate}%`} sub="av alla pjäser" color="var(--phase-color-3-accent)" />
      </div>

      {/* Charts */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 20 }}>

        {/* Phase Distribution */}
        {phaseData.length > 0 && (
          <div style={{
            background: 'var(--color-surface)',
            borderRadius: 'var(--radius-xl)',
            border: '1px solid var(--color-border)',
            boxShadow: 'var(--shadow-md)',
            padding: '20px 24px',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
              <Layers size={16} color="var(--color-primary)" />
              <h3 style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--color-text-primary)', margin: 0 }}>
                Aktiva pjäser per fas
              </h3>
            </div>
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={phaseData}
                  cx="50%"
                  cy="50%"
                  outerRadius={90}
                  dataKey="count"
                  labelLine={false}
                  label={CustomPieLabel}
                >
                  {phaseData.map((entry, index) => (
                    <Cell key={index} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value, name) => [value + ' pjäser', name]}
                  contentStyle={{
                    background: 'var(--color-surface)',
                    border: '1px solid var(--color-border)',
                    borderRadius: 10,
                    fontSize: 13,
                  }}
                />
                <Legend
                  iconType="circle"
                  iconSize={8}
                  wrapperStyle={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Monthly Activity */}
        <div style={{
          background: 'var(--color-surface)',
          borderRadius: 'var(--radius-xl)',
          border: '1px solid var(--color-border)',
          boxShadow: 'var(--shadow-md)',
          padding: '20px 24px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            <TrendingUp size={16} color="var(--color-primary)" />
            <h3 style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--color-text-primary)', margin: 0 }}>
              Nya pjäser per månad
            </h3>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={monthlyData} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
              <XAxis
                dataKey="name"
                tick={{ fontSize: 11, fill: 'var(--color-text-tertiary)' }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                allowDecimals={false}
                tick={{ fontSize: 11, fill: 'var(--color-text-tertiary)' }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                cursor={{ fill: 'var(--color-primary-light)' }}
                contentStyle={{
                  background: 'var(--color-surface)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 10,
                  fontSize: 13,
                }}
                formatter={(v) => [v + ' pjäser', 'Skapade']}
              />
              <Bar dataKey="count" fill="var(--color-primary)" radius={[6, 6, 0, 0]} maxBarSize={40} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Location Distribution */}
        {locationData.length > 1 && (
          <div style={{
            background: 'var(--color-surface)',
            borderRadius: 'var(--radius-xl)',
            border: '1px solid var(--color-border)',
            boxShadow: 'var(--shadow-md)',
            padding: '20px 24px',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
              <MapPin size={16} color="var(--color-primary)" />
              <h3 style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--color-text-primary)', margin: 0 }}>
                Pjäser per plats
              </h3>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {locationData.map((loc, i) => {
                const pct = totalPieces > 0 ? Math.round((loc.count / totalPieces) * 100) : 0;
                return (
                  <div key={i}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)', fontWeight: 500 }}>{loc.name}</span>
                      <span style={{ fontSize: '0.8rem', color: 'var(--color-text-tertiary)' }}>{loc.count}</span>
                    </div>
                    <div style={{ height: 6, background: 'var(--color-border)', borderRadius: 99, overflow: 'hidden' }}>
                      <div style={{
                        height: '100%',
                        width: `${pct}%`,
                        background: `linear-gradient(90deg, var(--color-primary), var(--color-secondary))`,
                        borderRadius: 99,
                        transition: 'width 0.5s ease',
                      }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default StatsDashboard;
