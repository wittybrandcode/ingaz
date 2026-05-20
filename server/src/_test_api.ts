import 'dotenv/config'

const BASE = 'http://localhost:3001/api/v1'

async function main() {
  // Login
  const loginRes = await fetch(`${BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@ingaz.com', password: 'admin123' }),
  })
  const loginData: any = await loginRes.json()
  console.log('Login:', loginRes.status, loginData.success ? 'OK' : 'FAIL')
  const token = loginData.data?.token
  if (!token) { console.error('No token'); process.exit(1) }

  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }

  // Projects
  const projectsRes = await fetch(`${BASE}/projects`, { headers })
  const projectsData: any = await projectsRes.json()
  console.log(`\nProjects (${projectsData.data?.length || 0}):`)
  for (const p of (projectsData.data || [])) {
    console.log(`  [${p.id}] ${p.title} (tasks: ${p.tasks_count})`)
  }

  // Tasks for first project
  if (projectsData.data?.length > 0) {
    const pid = projectsData.data[0].id
    const tasksRes = await fetch(`${BASE}/tasks/project/${pid}`, { headers })
    const tasksData: any = await tasksRes.json()
    console.log(`\nTasks for project ${pid} (${tasksData.data?.length || 0}):`)
    for (const t of (tasksData.data || []).slice(0, 5)) {
      console.log(`  [${t.id}] ${t.title} (subtasks: ${t.subtasks_count || 0})`)
    }
    if (tasksData.data?.length > 0) {
      // Subtasks for first task
      const tid = tasksData.data[0].id
      const subsRes = await fetch(`${BASE}/subtasks/task/${tid}`, { headers })
      const subsData: any = await subsRes.json()
      console.log(`\nSubtasks for task ${tid} (${subsData.data?.length || 0}):`)
      for (const s of (subsData.data || []).slice(0, 3)) {
        console.log(`  [${s.id}] ${s.title} - ${s.status}`)
      }
    }
  }

  // Users
  const usersRes = await fetch(`${BASE}/users`, { headers })
  const usersData: any = await usersRes.json()
  console.log(`\nUsers (${usersData.data?.length || 0}):`)
  for (const u of (usersData.data || []).slice(0, 5)) {
    console.log(`  [${u.id}] ${u.name} (${u.roleName})`)
  }

  // Roles
  const rolesRes = await fetch(`${BASE}/roles`, { headers })
  const rolesData: any = await rolesRes.json()
  console.log(`\nRoles (${rolesData.data?.length || 0}):`)
  for (const r of (rolesData.data || [])) {
    console.log(`  [${r.id}] ${r.name} - ${r.permissions?.length || 0} permissions`)
  }

  console.log('\n✅ API test complete')
}

main().catch(e => { console.error('FAIL:', e); process.exit(1) })
