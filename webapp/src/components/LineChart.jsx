// Small dependency-free line chart for sensor readings.
// series: [{ key, label, color, unit }], data: [{ t, [key]: number|string, motion }]
// Movement is drawn as orange ticks along the bottom.
const W = 720;
const H = 240;
const PAD = { top: 16, right: 16, bottom: 28, left: 40 };

function niceRange(values) {
  if (values.length === 0) return [0, 1];
  let min = Math.min(...values);
  let max = Math.max(...values);
  if (min === max) { min -= 1; max += 1; }
  const pad = (max - min) * 0.15;
  return [Math.floor(min - pad), Math.ceil(max + pad)];
}

function timeLabel(date, spanHours) {
  return spanHours > 48
    ? date.toLocaleDateString([], { day: 'numeric', month: 'short' })
    : date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export default function LineChart({ data, series, hours }) {
  if (data.length === 0) {
    return <div className="chart-empty" role="status">No readings in this period yet. Readings appear here as soon as the ESP32 sends them.</div>;
  }

  const times = data.map((d) => new Date(d.t).getTime());
  const t0 = Math.min(...times);
  const t1 = Math.max(...times) === t0 ? t0 + 60000 : Math.max(...times);
  const x = (t) => PAD.left + ((t - t0) / (t1 - t0)) * (W - PAD.left - PAD.right);
  const innerH = H - PAD.top - PAD.bottom;

  return (
    <div className="chart">
      <div className="chart-legend">
        {series.map((s) => (
          <span key={s.key}><span className="chart-swatch" style={{ background: s.color }} /> {s.label}</span>
        ))}
        <span><span className="chart-swatch tick" /> Movement</span>
      </div>
      <div className="chart-rows">
        {series.map((s) => {
          const values = data.map((d) => (d[s.key] == null ? null : Number(d[s.key])));
          let [lo, hi] = niceRange(values.filter((v) => v !== null));
          if (s.min !== undefined) lo = Math.max(lo, s.min);
          if (s.max !== undefined) hi = Math.min(hi, s.max);
          const y = (v) => PAD.top + innerH - ((v - lo) / (hi - lo)) * innerH;
          const path = values
            .map((v, i) => (v === null ? null : `${x(times[i]).toFixed(1)},${y(v).toFixed(1)}`))
            .filter(Boolean);
          const ticks = [lo, (lo + hi) / 2, hi];
          return (
            <svg key={s.key} viewBox={`0 0 ${W} ${H}`} className="chart-svg" role="img" aria-label={`${s.label} over time`}>
              <text x={PAD.left} y={11} className="chart-title">{s.label} ({s.unit})</text>
              {ticks.map((v) => (
                <g key={v}>
                  <line x1={PAD.left} x2={W - PAD.right} y1={y(v)} y2={y(v)} className="chart-grid" />
                  <text x={PAD.left - 6} y={y(v) + 4} textAnchor="end" className="chart-axis">{Math.round(v)}</text>
                </g>
              ))}
              {[t0, (t0 + t1) / 2, t1].map((t, i) => (
                <text key={t} x={x(t)} y={H - 8} textAnchor={['start', 'middle', 'end'][i]} className="chart-axis">
                  {timeLabel(new Date(t), hours)}
                </text>
              ))}
              {data.map((d, i) => d.motion && (
                <line key={i} x1={x(times[i])} x2={x(times[i])} y1={H - PAD.bottom} y2={H - PAD.bottom - 10} className="chart-motion" />
              ))}
              {path.length > 1 && <polyline points={path.join(' ')} fill="none" stroke={s.color} strokeWidth="2.5" strokeLinejoin="round" />}
              {path.length === 1 && <circle cx={path[0].split(',')[0]} cy={path[0].split(',')[1]} r="4" fill={s.color} />}
            </svg>
          );
        })}
      </div>
    </div>
  );
}
