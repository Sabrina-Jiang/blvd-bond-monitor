// Minimal dependency-free SVG line chart. points: [{x: Date, y: number}]
function renderLineChart(container, points, opts) {
  const width = (opts && opts.width) || 640;
  const height = (opts && opts.height) || 200;
  const padding = 36;

  if (!points || points.length < 2) {
    container.innerHTML = '<p class="empty">Not enough data yet to chart.</p>';
    return;
  }

  const xs = points.map((p) => p.x.getTime());
  const ys = points.map((p) => p.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const spanX = maxX - minX || 1;
  const spanY = maxY - minY || 1;

  const sx = (x) => padding + ((x - minX) / spanX) * (width - padding * 2);
  const sy = (y) => height - padding - ((y - minY) / spanY) * (height - padding * 2);

  const path = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${sx(p.x.getTime()).toFixed(1)} ${sy(p.y).toFixed(1)}`)
    .join(' ');

  const dots = points
    .map((p) => `<circle cx="${sx(p.x.getTime()).toFixed(1)}" cy="${sy(p.y).toFixed(1)}" r="3" fill="#a8503a"></circle>`)
    .join('');

  container.innerHTML = `
    <svg viewBox="0 0 ${width} ${height}" width="100%" height="${height}" preserveAspectRatio="xMidYMid meet">
      <line x1="${padding}" y1="${height - padding}" x2="${width - padding}" y2="${height - padding}" stroke="#e6e1da" />
      <path d="${path}" fill="none" stroke="#a8503a" stroke-width="2" />
      ${dots}
      <text x="${padding}" y="${height - 10}" font-size="11" fill="#7a746c">${points[0].x.toLocaleDateString()}</text>
      <text x="${width - padding}" y="${height - 10}" font-size="11" fill="#7a746c" text-anchor="end">${points[points.length - 1].x.toLocaleDateString()}</text>
      <text x="${padding}" y="16" font-size="11" fill="#7a746c">$${Math.round(maxY).toLocaleString()}</text>
      <text x="${padding}" y="${height - padding + 14}" font-size="11" fill="#7a746c">$${Math.round(minY).toLocaleString()}</text>
    </svg>`;
}
