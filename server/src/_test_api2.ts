import 'dotenv/config'
import http from 'http'

const BASE = 'http://localhost:3001/api/v1'

function request(method: string, path: string, body?: any, token?: string): Promise<any> {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE)
    const opts: http.RequestOptions = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    }
    const req = http.request(opts, (res) => {
      let data = ''
      res.on('data', (chunk) => data += chunk)
      res.on('end', () => {
        try { resolve(JSON.parse(data)) } catch { resolve(data) }
      })
    })
    req.on('error', reject)
    if (body) req.write(JSON.stringify(body))
    req.end()
  })
}

async function main() {
  const loginData: any = await request('POST', '/auth/login', { email: 'admin@ingaz.com', password: 'admin123' })
  const token = loginData.data?.token
  if (!token) { console.error('No token'); process.exit(1) }
  console.log('Login OK, token:', token.slice(0, 20) + '...')

  const pData: any = await request('GET', '/projects', undefined, token)
  if (pData.data?.length > 0) {
    const p = pData.data[0]
    console.log('\n=== Project keys ===')
    console.log(Object.keys(p).join(', '))
    console.log(JSON.stringify(p, null, 2))
  }

  if (pData.data?.length > 0) {
    const pid = pData.data[0].id
    const pdData: any = await request('GET', `/projects/${pid}`, undefined, token)
    if (pdData.data) {
      console.log('\n=== ProjectDetail top keys ===')
      console.log(Object.keys(pdData.data).join(', '))
      if (pdData.data.tasks?.length > 0) {
        const t = pdData.data.tasks[0]
        console.log('\n=== Task keys ===')
        console.log(Object.keys(t).join(', '))
        console.log(JSON.stringify(t, null, 2))
      }
    }
  }

  const uData: any = await request('GET', '/users', undefined, token)
  if (uData.data?.length > 0) {
    const u = uData.data[0]
    console.log('\n=== User keys ===')
    console.log(Object.keys(u).join(', '))
  }

  console.log('\n✅ Done')
}

main().catch(e => { console.error('FAIL:', e); process.exit(1) })
