export const STATUSES = { active: 'In progress', waiting: 'Needs you', completed: 'Complete', idle: 'Idle', saved: 'Saved', error: 'Error' };
export function normalizeThreads(input) {
  const rows = Array.isArray(input) ? input : input?.threads;
  if (!Array.isArray(rows)) throw new Error('Use a JSON array or an object with a threads array.');
  if (rows.length > 1000) throw new Error('Please import up to 1,000 threads at a time.');
  const seen = new Set();
  return rows.map((row, i) => {
    if (!row || typeof row !== 'object' || typeof row.title !== 'string' || !row.title.trim()) throw new Error(`Thread ${i + 1} needs a title.`);
    const id = String(row.id || `import-${i}`);
    if (seen.has(id)) throw new Error(`Duplicate thread ID: ${id}`);
    seen.add(id);
    const raw = typeof row.status === 'object' ? row.status?.type : row.status;
    const status = raw === 'notLoaded' ? 'saved' : Object.hasOwn(STATUSES, raw) ? raw : 'saved';
    let url = null;
    if (typeof row.url === 'string') {
      try { const parsed = new URL(row.url); if (['https:','http:'].includes(parsed.protocol)) url = parsed.href; } catch {}
    }
    const updatedAt = typeof row.updatedAt === 'number' ? new Date(row.updatedAt < 1e12 ? row.updatedAt * 1000 : row.updatedAt).toISOString() : row.updatedAt;
    return { id: id.slice(0,200), title: row.title.trim().slice(0,300), summary: String(row.summary || '').slice(0,6000), agent: String(row.agent || row.kind || 'Agent').slice(0,50), project: String(row.project || row.cwd?.split(/[\\/]/).filter(Boolean).pop() || 'Personal').slice(0,100), status, updatedAt: updatedAt && !Number.isNaN(Date.parse(updatedAt)) ? updatedAt : null, latest: String(row.latest || '').slice(0,6000), url, messages: Array.isArray(row.messages) ? row.messages.slice(-100).map(m=>({role: String(m.role || 'agent').slice(0,30),text:String(m.text || m.content || '').slice(0,20000)})) : [] };
  });
}
export function filterThreads(threads, filter, query, favorites) {
  const needle = query.toLocaleLowerCase().trim();
  return threads.filter(t => (filter === 'all' || (filter === 'starred' ? favorites.has(t.id) : t.status === filter)) && (!needle || `${t.title} ${t.agent} ${t.project}`.toLocaleLowerCase().includes(needle)));
}
export function stepIndex(index, delta, length) { return length ? ((index + delta) % length + length) % length : 0; }
export function wheelDelta(before, after) { return Math.atan2(Math.sin(after-before), Math.cos(after-before)); }
export function relativeTime(date, now = Date.now()) {
  if (!date) return 'Not provided';
  const diff = Math.max(0, now - Date.parse(date));
  if (diff < 60000) return 'Just now';
  if (diff < 3600000) return `${Math.floor(diff/60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff/3600000)}h ago`;
  if (diff < 604800000) return `${Math.floor(diff/86400000)}d ago`;
  return new Date(date).toLocaleDateString(undefined,{month:'short',day:'numeric'});
}

