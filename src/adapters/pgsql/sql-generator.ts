 /**
 * PostgreSQL SQL生成器
 * 用于快速生成PostgreSQL SQL语句，支持参数化查询防止SQL注入
 */
export class PostgreSQLSqlGenerator<T extends Record<string, any>> {
    private _select: (keyof T | string)[] = []
    private _from: string = ''
    private _joins: { type: string; table: string; condition: string }[] = []
    private _where: string[] = []
    private _groupBy: (keyof T | string)[] = []
    private _orderBy: { column: keyof T | string; direction: 'ASC' | 'DESC' }[] = []
    private _limit: number = 0
    private _offset: number = 0
    private _params: any[] = []
    private _type: 'SELECT' | 'INSERT' | 'UPDATE' | 'DELETE' = 'SELECT'
    private _insertData?: Partial<T> | Partial<T>[]
    private _updateData?: Partial<T>
    private _upsertConflict?: {
        columns: (keyof T)[];
        update?: (keyof T)[];
    }

    constructor(table: string) {
        this._from = table
        this._params = []
    }

    /**
     * 处理列名，添加双引号（PostgreSQL标识符引用）
     * @private
     */
    private _formatColumnName(column: string): string {
        if (column === '*') return column
        return `"${column}"`
    }

    /**
     * 选择要查询的列
     * @example
     * sql.select('id', 'name')  // 字段名会有类型提示
     */
    select<K extends keyof T>(...columns: K[]): this {
        if (!columns.length) {
            columns = ['*' as K]
        }
        this._select.push(...columns)
        return this
    }

    /**
     * 设置查询的表
     */
    from(table: string): this {
        this._from = table
        return this
    }

    /**
     * 添加JOIN子句
     */
    join(table: string, condition: string, type: 'INNER' | 'LEFT' | 'RIGHT' | 'FULL' = 'INNER'): this {
        this._joins.push({ type, table, condition })
        return this
    }

    /**
     * 添加WHERE条件
     * @example
     * // 使用对象条件
     * sql.where({ status: 'active', age: 18 })
     * // 使用字符串条件
     * sql.where('age > 18')
     */
    where(condition: string | {
        [K in keyof T]?: T[K] | {
            $eq?: T[K];
            $neq?: T[K];
            $gt?: T[K];
            $gte?: T[K];
            $lt?: T[K];
            $lte?: T[K];
            $like?: string;
            $in?: T[K][];
            $nin?: T[K][];
            $isNull?: boolean;
        }
    }): this {
        if (typeof condition === 'string') {
            this._where.push(condition)
        } else {
            const conditions = Object.entries(condition).map(([key, value]) => {
                if (value === null || value === undefined) {
                    this._params.push(null)
                    return `"${key}" IS NULL`
                }

                if (typeof value === 'object' && value !== null) {
                    const operators = Object.entries(value as any)
                    const conditions = operators.map(([op, val]) => {
                        switch (op) {
                            case '$eq':
                                this._params.push(val)
                                return `"${key}" = $${this._params.length}`
                            case '$neq':
                                this._params.push(val)
                                return `"${key}" != $${this._params.length}`
                            case '$gt':
                                this._params.push(val)
                                return `"${key}" > $${this._params.length}`
                            case '$gte':
                                this._params.push(val)
                                return `"${key}" >= $${this._params.length}`
                            case '$lt':
                                this._params.push(val)
                                return `"${key}" < $${this._params.length}`
                            case '$lte':
                                this._params.push(val)
                                return `"${key}" <= $${this._params.length}`
                            case '$like':
                                this._params.push(val)
                                return `"${key}" LIKE $${this._params.length}`
                            case '$in':
                                const inValues = val as any[]
                                inValues.forEach(v => this._params.push(v))
                                return `"${key}" IN (${inValues.map((_, i) => `$${this._params.length - inValues.length + i + 1}`).join(', ')})`
                            case '$nin':
                                const ninValues = val as any[]
                                ninValues.forEach(v => this._params.push(v))
                                return `"${key}" NOT IN (${ninValues.map((_, i) => `$${this._params.length - ninValues.length + i + 1}`).join(', ')})`
                            case '$isNull':
                                return `"${key}" IS ${val ? 'NULL' : 'NOT NULL'}`
                            default:
                                return ''
                        }
                    }).filter(Boolean)
                    return conditions.join(' AND ')
                }

                this._params.push(value)
                return `"${key}" = $${this._params.length}`
            })
            this._where.push(...conditions.filter(Boolean))
        }
        return this
    }

    /**
     * 添加GROUP BY子句
     */
    groupBy(...columns: (keyof T | string)[]): this {
        this._groupBy.push(...columns)
        return this
    }

    /**
     * 添加ORDER BY子句
     */
    orderBy(column: keyof T | string, direction: 'ASC' | 'DESC' = 'ASC'): this {
        this._orderBy.push({ column, direction })
        return this
    }

    /**
     * 设置LIMIT
     */
    limit(limit: number): this {
        this._limit = limit
        return this
    }

    /**
     * 设置OFFSET
     */
    offset(offset: number): this {
        this._offset = offset
        return this
    }

    /**
     * 插入数据
     * @param data 要插入的数据
     * @param options 插入选项
     */
    insert(data: Partial<T>, options?: {
        onConflict?: {
            columns: (keyof T)[];
            update?: (keyof T)[];
        }
    }): this {
        this._type = 'INSERT'
        this._insertData = data
        this._upsertConflict = options?.onConflict
        return this
    }

    /**
     * 批量插入数据
     * @param dataArray 要插入的数据数组
     * @param options 插入选项
     */
    insertMany(dataArray: Partial<T>[], options?: {
        onConflict?: {
            columns: (keyof T)[];
            update?: (keyof T)[];
        }
    }): this {
        this._type = 'INSERT'
        this._insertData = dataArray
        this._upsertConflict = options?.onConflict
        return this
    }

    /**
     * 更新数据
     * @param data 要更新的数据
     */
    update(data: Partial<T>): this {
        this._type = 'UPDATE'
        this._updateData = data
        return this
    }

    /**
     * 删除数据
     */
    delete(): this {
        this._type = 'DELETE'
        return this
    }

    /**
     * 获取SQL语句（不包含参数）
     */
    getSql(): string {
        switch (this._type) {
            case 'SELECT':
                return this._getSelectSql()
            case 'INSERT':
                return this._getInsertSql()
            case 'UPDATE':
                return this._getUpdateSql()
            case 'DELETE':
                return this._getDeleteSql()
            default:
                throw new Error(`Unsupported query type: ${this._type}`)
        }
    }

    /**
     * 获取SELECT SQL
     * @private
     */
    private _getSelectSql(): string {
        const columns = this._select.length > 0 
            ? this._select.map(col => this._formatColumnName(col as string)).join(', ')
            : '*'
        
        let sql = `SELECT ${columns} FROM "${this._from}"`
        
        // 添加JOIN
        if (this._joins.length > 0) {
            sql += ' ' + this._joins.map(join => 
                `${join.type} JOIN "${join.table}" ON ${join.condition}`
            ).join(' ')
        }
        
        // 添加WHERE
        if (this._where.length > 0) {
            sql += ' WHERE ' + this._where.join(' AND ')
        }
        
        // 添加GROUP BY
        if (this._groupBy.length > 0) {
            sql += ' GROUP BY ' + this._groupBy.map(col => this._formatColumnName(col as string)).join(', ')
        }
        
        // 添加ORDER BY
        if (this._orderBy.length > 0) {
            sql += ' ORDER BY ' + this._orderBy.map(order => 
                `${this._formatColumnName(order.column as string)} ${order.direction}`
            ).join(', ')
        }
        
        // 添加LIMIT
        if (this._limit > 0) {
            sql += ` LIMIT ${this._limit}`
        }
        
        // 添加OFFSET
        if (this._offset > 0) {
            sql += ` OFFSET ${this._offset}`
        }
        
        return sql
    }

    /**
     * 获取INSERT SQL
     * @private
     */
    private _getInsertSql(): string {
        if (!this._insertData) {
            throw new Error('No insert data provided')
        }

        // 明确 dataArray 类型
        const dataArray: Partial<T>[] = Array.isArray(this._insertData)
            ? this._insertData as Partial<T>[]
            : [this._insertData as Partial<T>];

        if (dataArray.length === 0) {
            throw new Error('No data to insert')
        }

        const columns = Object.keys(dataArray[0]) as (keyof T)[];
        const values = dataArray.map((data) => {
            const rowValues = columns.map((col) => {
                this._params.push(data[col]);
                return `$${this._params.length}`;
            });
            return `(${rowValues.join(', ')})`;
        });

        let sql = `INSERT INTO "${this._from}" ("${columns.join('", "')}") VALUES ${values.join(', ')}`;

        // 添加ON CONFLICT (PostgreSQL UPSERT)
        if (this._upsertConflict) {
            sql += ` ON CONFLICT ("${this._upsertConflict.columns.join('", "')}")`;
            if (this._upsertConflict.update) {
                const updates = this._upsertConflict.update.map((col) => {
                    this._params.push(dataArray[0][col]);
                    return `"${String(col)}" = $${this._params.length}`;
                });
                sql += ` DO UPDATE SET ${updates.join(', ')}`;
            } else {
                sql += ' DO NOTHING';
            }
        }

        return sql;
    }

    /**
     * 获取UPDATE SQL
     * @private
     */
    private _getUpdateSql(): string {
        if (!this._updateData) {
            throw new Error('No update data provided')
        }

        const updates = Object.entries(this._updateData).map(([key, value]) => {
            this._params.push(value)
            return `"${key}" = $${this._params.length}`
        })

        let sql = `UPDATE "${this._from}" SET ${updates.join(', ')}`

        // 添加WHERE
        if (this._where.length > 0) {
            console.log('WHERE conditions:', this._where)
            sql += ' WHERE ' + this._where.join(' AND ')
        }

        return sql
    }

    /**
     * 获取DELETE SQL
     * @private
     */
    private _getDeleteSql(): string {
        let sql = `DELETE FROM "${this._from}"`

        // 添加WHERE
        if (this._where.length > 0) {
            sql += ' WHERE ' + this._where.join(' AND ')
        }

        return sql
    }

    /**
     * 获取SQL语句和参数
     * @returns { sql: string; params: any[] }
     */
    getSqlWithParams(): { sql: string; params: any[] } {
        const sql = this.getSql()
        return { sql, params: [...this._params] }
    }

    /**
     * 清空查询状态
     */
    clear(): this {
        this._select = []
        // 不清空表名，保持 this._from 不变
        this._joins = []
        this._where = []
        this._groupBy = []
        this._orderBy = []
        this._limit = 0
        this._offset = 0
        this._params = []
        this._type = 'SELECT'
        this._insertData = undefined
        this._updateData = undefined
        this._upsertConflict = undefined
        return this
    }

    /**
     * 重置查询状态（保护方法）
     */
    protected reset(): void {
        this.clear()
    }
}