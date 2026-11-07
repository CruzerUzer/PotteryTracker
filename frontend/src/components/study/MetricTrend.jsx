import React, { useMemo } from 'react';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine } from 'recharts';
import { formatDay, shortBlockName } from './studyUtils';

function TrendTooltip({ active, payload, unit }) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  return (
    <div className="trend-tooltip">
      <span className="trend-tooltip-value">{p.value} {unit}</span>
      <span className="trend-tooltip-meta">{formatDay(p.date, { year: 'numeric' })} · {p.blockShort}</span>
    </div>
  );
}

/**
 * Enkel trend för ett mått: en linje i mässing, blockgränser som tunna
 * lodräta linjer. Ett diagram per mått (små multiplar), ingen dubbelaxel.
 */
function MetricTrend({ def, values, blocks }) {
  const data = useMemo(() => {
    const blockName = (id) => shortBlockName(blocks.find((b) => b.id === id)?.name || '');
    return values.map((v, i) => ({
      i: i + 1,
      value: v.value,
      date: v.measured_at,
      blockId: v.plan_block_id,
      blockShort: blockName(v.plan_block_id),
    }));
  }, [values, blocks]);

  const boundaries = data.filter((d, i) => i > 0 && d.blockId !== data[i - 1].blockId);
  const last = data[data.length - 1];

  return (
    <figure className="trend">
      <figcaption className="trend-head">
        <span className="trend-name">{def.name}</span>
        {last && <span className="trend-last">{last.value} {def.unit}</span>}
      </figcaption>
      {def.how && <p className="trend-how">{def.how}</p>}
      {data.length < 2 ? (
        <p className="study-muted">{data.length ? 'Ett värde hittills. Trenden syns från två.' : 'Inga värden ännu.'}</p>
      ) : (
        <div className="trend-chart" role="img" aria-label={`${def.name}: ${data.map((d) => d.value).join(', ')} ${def.unit}`}>
          <ResponsiveContainer width="100%" height={150}>
            <LineChart data={data} margin={{ top: 14, right: 12, bottom: 0, left: -18 }}>
              <CartesianGrid vertical={false} stroke="var(--color-border)" />
              <XAxis dataKey="i" type="number" domain={['dataMin', 'dataMax']} tick={false} axisLine={{ stroke: 'var(--color-border)' }} tickLine={false} />
              <YAxis tick={{ fill: 'var(--color-text-tertiary)', fontSize: 11 }} axisLine={false} tickLine={false} width={44} />
              {boundaries.map((b) => (
                <ReferenceLine key={b.i} x={b.i - 0.5} stroke="var(--color-border-hover)" strokeDasharray="3 3"
                  label={{ value: b.blockShort, position: 'insideTopLeft', fill: 'var(--color-text-tertiary)', fontSize: 10 }} />
              ))}
              <Tooltip content={<TrendTooltip unit={def.unit} />} cursor={{ stroke: 'var(--color-border-hover)' }} />
              <Line type="monotone" dataKey="value" stroke="var(--color-primary)" strokeWidth={2}
                dot={{ r: 4, strokeWidth: 2, stroke: 'var(--color-surface)', fill: 'var(--color-primary)' }}
                activeDot={{ r: 6, strokeWidth: 2, stroke: 'var(--color-surface)' }} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </figure>
  );
}

export default MetricTrend;
