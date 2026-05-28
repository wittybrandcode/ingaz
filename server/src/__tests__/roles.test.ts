import { describe, it, expect, beforeEach } from 'vitest'
import { createTestDb, seedUser } from './helpers.js'
import { RoleService } from '../services/RoleService.js'
import * as testSchema from './test-schema.js'

describe('RoleService', () => {
  describe('list', () => {
    it('returns all roles with permissions', async () => {
      const db = createTestDb()
      db.insert(testSchema.permissions).values({ key: 'tasks.create', name: 'Create Tasks', groupName: 'tasks', sortOrder: 1 }).run()
      db.insert(testSchema.rolePermissions).values({ roleId: 1, permissionId: 1 }).run()
      const service = new RoleService(db)

      const roles = await service.list()
      expect(roles.length).toBeGreaterThanOrEqual(2)
      const admin = roles.find((r: any) => r.id === 1)
      expect(admin).toBeDefined()
      expect(Array.isArray(admin.permissions)).toBe(true)
    })
  })

  describe('CRUD', () => {
    it('create inserts a new role', async () => {
      const db = createTestDb()
      const service = new RoleService(db)

      const role = await service.create({ name: 'editor' })
      expect(role.name).toBe('editor')
      expect(role.id).toBeGreaterThan(0)
    })

    it('update modifies role name', async () => {
      const db = createTestDb()
      const service = new RoleService(db)

      const created = await service.create({ name: 'old-name' })
      const updated = await service.update(created.id, { name: 'new-name' })
      expect(updated.name).toBe('new-name')
    })

    it('delete removes a role with no users', async () => {
      const db = createTestDb()
      const service = new RoleService(db)

      const role = await service.create({ name: 'temp-role' })
      const result = await service.delete(role.id)
      expect(result.message).toBeTruthy()

      const roles = await service.list()
      expect(roles.some((r: any) => r.id === role.id)).toBe(false)
    })

    it('delete throws 404 on non-existent role', async () => {
      const db = createTestDb()
      const service = new RoleService(db)

      await expect(service.delete(999)).rejects.toThrow('الدور غير موجود')
    })

    it('delete throws when role has users', async () => {
      const db = createTestDb()
      seedUser(db, { id: 1, role_id: 2 })
      const service = new RoleService(db)

      await expect(service.delete(2)).rejects.toThrow('لا يمكن حذف دور لا يزال لديه مستخدمين')
    })
  })

  describe('permissions', () => {
    it('getPermissions returns keys for a role', async () => {
      const db = createTestDb()
      db.insert(testSchema.permissions).values({ key: 'tasks.delete', name: 'Delete Tasks', groupName: 'tasks', sortOrder: 2 }).run()
      db.insert(testSchema.rolePermissions).values({ roleId: 1, permissionId: 1 }).run()
      const service = new RoleService(db)

      const perms = await service.getPermissions(1)
      expect(perms).toContain('tasks.delete')
    })

    it('updatePermissions replaces all permissions', async () => {
      const db = createTestDb()
      db.insert(testSchema.permissions).values({ key: 'perm.a', name: 'Perm A', groupName: 'test', sortOrder: 1 }).run()
      db.insert(testSchema.permissions).values({ key: 'perm.b', name: 'Perm B', groupName: 'test', sortOrder: 2 }).run()
      db.insert(testSchema.permissions).values({ key: 'perm.c', name: 'Perm C', groupName: 'test', sortOrder: 3 }).run()
      const service = new RoleService(db)

      await service.updatePermissions(1, ['perm.a', 'perm.b'])
      let perms = await service.getPermissions(1)
      expect(perms).toEqual(['perm.a', 'perm.b'])

      await service.updatePermissions(1, ['perm.c'])
      perms = await service.getPermissions(1)
      expect(perms).toEqual(['perm.c'])
    })

    it('listAllPermissions returns grouped permissions', async () => {
      const db = createTestDb()
      db.insert(testSchema.permissions).values({ key: 'x.one', name: 'One', groupName: 'group-x', sortOrder: 1 }).run()
      db.insert(testSchema.permissions).values({ key: 'x.two', name: 'Two', groupName: 'group-x', sortOrder: 2 }).run()
      const service = new RoleService(db)

      const grouped = await service.listAllPermissions()
      expect(grouped['group-x']).toHaveLength(2)
    })
  })
})
