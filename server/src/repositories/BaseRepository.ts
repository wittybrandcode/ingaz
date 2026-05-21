import { eq, count, sql } from 'drizzle-orm'

export class BaseRepository<T extends Record<string, unknown>> {
  protected db: any
  protected table: any
  protected primaryKey: string = 'id'

  constructor(db: any, table: any, primaryKey?: string) {
    this.db = db
    this.table = table
    if (primaryKey) this.primaryKey = primaryKey
  }

  async findById(id: number | string): Promise<T | null> {
    const [row] = await this.db
      .select()
      .from(this.table)
      .where(eq(this.table[this.primaryKey], id))
      .limit(1)
    return row || null
  }

  async findAll(page = 1, pageSize = 20, orderBy?: any): Promise<{ data: T[]; total: number; pages: number; page: number; pageSize: number }> {
    page = Math.max(1, page)
    pageSize = Math.min(100, Math.max(1, pageSize))
    const offset = (page - 1) * pageSize

    const [totalRow] = await this.db
      .select({ count: count() })
      .from(this.table)
    const total = totalRow?.count ?? 0

    let query = this.db.select().from(this.table).limit(pageSize).offset(offset)
    if (orderBy) query = query.orderBy(orderBy)
    const data = await query

    return { data: data as T[], total, pages: Math.ceil(total / pageSize), page, pageSize }
  }

  async create(values: Partial<T>): Promise<T> {
    const [row] = await this.db.insert(this.table).values(values).returning()
    return row as T
  }

  async update(id: number | string, values: Partial<T>): Promise<T | null> {
    const [row] = await this.db
      .update(this.table)
      .set(values)
      .where(eq(this.table[this.primaryKey], id))
      .returning()
    return row || null
  }

  async delete(id: number | string): Promise<boolean> {
    const [row] = await this.db
      .delete(this.table)
      .where(eq(this.table[this.primaryKey], id))
      .returning({ id: this.table[this.primaryKey] })
    return !!row
  }

  async countAll(): Promise<number> {
    const [row] = await this.db
      .select({ count: count() })
      .from(this.table)
    return row?.count ?? 0
  }
}
