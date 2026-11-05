const T = process.env.GH_TOKEN, H = { Authorization: `Bearer ${T}`, 'Content-Type': 'application/json', Accept: 'application/vnd.github+json' }
const api = async (p, opt) => { const r = await fetch(`https://api.github.com/repos/wookat/SeatMark${p}`, { headers: H, ...opt }); return r.json() }
import { readFileSync } from 'fs'
const path = 'app/src/data/site.ts'
const content = readFileSync(path, 'utf-8')
if (!content.includes('-2')) throw new Error('local file not updated')
const ref = await api('/git/ref/heads/main')
const head = await api(`/git/commits/${ref.object.sha}`)
const blob = await api('/git/blobs', { method: 'POST', body: JSON.stringify({ content: Buffer.from(content).toString('base64'), encoding: 'base64' }) })
const tree = await api('/git/trees', { method: 'POST', body: JSON.stringify({ base_tree: head.tree.sha, tree: [{ path, mode: '100644', type: 'blob', sha: blob.sha }] }) })
const c = await api('/git/commits', { method: 'POST', body: JSON.stringify({ message: 'fix: use full site-level ICP filing number with -2 suffix\n\nMIIT record is 湘ICP备2026009844号-2 (site #2 under subject).\nSome validators match the complete site filing number.', tree: tree.sha, parents: [head.sha] }) })
const u = await api('/git/refs/heads/main', { method: 'PATCH', body: JSON.stringify({ sha: c.sha }) })
console.log('pushed', c.sha, '-> main:', u.object?.sha)
