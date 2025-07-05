 /**
 * PostgreSQL适配器
 * 提供PostgreSQL数据库的SQL生成和数据库内省功能
 */

import { Pool } from 'pg'
import { PostgreSQLSqlGenerator } from './sql-generator'
import { PostgreSQLIntrospector } from './introspect'
import * as fs from 'fs'
import * as path from 'path'

/**
 * PostgreSQL连接配置
 */
export interface PostgreSQLConfig {
    host: string
    port: number
    user: string
    password: string
    database: string
    ssl?: boolean
    pool?: {
        max?: number
        idleTimeoutMillis?: number
        connectionTimeoutMillis?: number
    }
}

/**
 * PostgreSQL适配器类
 * 提供完整的PostgreSQL数据库操作功能
 */
export class PostgreSQLAdapter {
    private pool: Pool
    private introspector: PostgreSQLIntrospector

    constructor(config: PostgreSQLConfig) {
        this.pool = new Pool({
            host: config.host,
            port: config.port,
            user: config.user,
            password: config.password,
            database: config.database,
            ssl: config.ssl,
            ...config.pool
        })

        this.introspector = new PostgreSQLIntrospector(this.pool)
    }

    /**
     * 创建SQL生成器
     * @param table 表名
     * @example
     * const sql = adapter.createSqlGenerator<User>('users')
     *   .select('id', 'name', 'email')
     *   .where({ status: 'active' })
     *   .limit(10)
     */
    createSqlGenerator<T extends Record<string, any>>(table: string): PostgreSQLSqlGenerator<T> {
        return new PostgreSQLSqlGenerator<T>(table)
    }

    /**
     * 执行查询
     * @param sql SQL语句
     * @param params 参数数组
     * @example
     * const result = await adapter.query('SELECT * FROM users WHERE id = $1', [1])
     */
    async query(sql: string, params?: any[]): Promise<any> {
        const result = await this.pool.query(sql, params || [])
        // console.log(result,'result')
        return result
    }

    /**
     * 执行查询并返回单条结果
     * @param sql SQL语句
     * @param params 参数数组
     */
    async queryOne<T = any>(sql: string, params?: any[]): Promise<T | null> {
        const result = await this.pool.query(sql, params || [])
        return result.rows[0] || null
    }

    /**
     * 执行查询并返回结果数组
     * @param sql SQL语句
     * @param params 参数数组
     */
    async queryMany<T = any>(sql: string, params?: any[]): Promise<T[]> {
        const result = await this.pool.query(sql, params || [])
        return result.rows
    }

    /**
     * 获取数据库内省器
     */
    getIntrospector(): PostgreSQLIntrospector {
        return this.introspector
    }

    /**
     * 获取所有表信息
     * @param schema 数据库模式，默认为'public'
     */
    async getAllTables(schema: string = 'public') {
        return await this.introspector.getAllTables(schema)
    }

    /**
     * 获取表结构信息
     * @param tableName 表名
     * @param schema 数据库模式，默认为'public'
     */
    async getTableStructure(tableName: string, schema: string = 'public') {
        return await this.introspector.getTableStructure(tableName, schema)
    }

    /**
     * 生成表的TypeScript接口
     * @param tableName 表名
     * @param schema 数据库模式，默认为'public'
     */
    async generateTableInterface(tableName: string, schema: string = 'public', includeComments: boolean = true) {
        const columns = await this.introspector.getTableStructure(tableName, schema)
        const primaryKeys = await this.introspector.getPrimaryKeys(tableName, schema)
        const tables = await this.introspector.getAllTables(schema)
        const table = tables.find(t => t.table_name === tableName)
        
        if (!table) {
            throw new Error(`Table ${tableName} not found`)
        }

        return this.introspector.generateInterface(
            tableName,
            table.table_comment,
            columns,
            primaryKeys,
            includeComments
        )
    }

    /**
     * 生成所有表的TypeScript接口
     * @param schema 数据库模式，默认为'public'
     */
    async generateAllInterfaces(schema: string = 'public', includeComments: boolean = true) {
        return await this.introspector.generateAllInterfaces(schema, includeComments)
    }

    /**
     * 数据库内省：生成所有表的TypeScript接口并保存到指定目录
     * @param outputDir 输出目录路径
     * @param schema 数据库模式，默认为'public'
     * @param options 配置选项
     */
    async introspect(
        outputDir: string, 
        schema: string = 'public',
        options: {
            /** 是否生成单个文件，默认为false（每个表一个文件） */
            singleFile?: boolean
            /** 单个文件的文件名，当singleFile为true时使用 */
            fileName?: string
            /** 是否包含表注释，默认为true */
            includeComments?: boolean
            /** 是否包含导入语句，默认为true */
            includeImports?: boolean
            /** 自定义导入语句 */
            customImports?: string[]
        } = {}
    ): Promise<{
        success: boolean
        message: string
        files: string[]
        tables: string[]
    }> {
        try {
            // 确保输出目录存在
            if (!fs.existsSync(outputDir)) {
                fs.mkdirSync(outputDir, { recursive: true })
            }

            const {
                singleFile = false,
                fileName = 'database-types.ts',
                includeComments = true,
                includeImports = true,
                customImports = []
            } = options

            // 获取所有表信息
            const tables = await this.getAllTables(schema)
            if (tables.length === 0) {
                return {
                    success: false,
                    message: `在模式 '${schema}' 中没有找到任何表`,
                    files: [],
                    tables: []
                }
            }

            const generatedFiles: string[] = []
            const tableNames: string[] = []

            if (singleFile) {
                // 生成单个文件
                const filePath = path.join(outputDir, fileName)
                let content = ''

                // 添加文件头注释
                content += `/**
 * 数据库类型定义
 * 自动生成于 ${new Date().toISOString()}
 * 模式: ${schema}
 * 表数量: ${tables.length}
 */\n\n`

                // 添加导入语句
                if (includeImports) {
                    const imports = [
                        '// 基础类型导入',
                        'export type { }',
                        '',
                        ...customImports
                    ]
                    content += imports.join('\n') + '\n\n'
                }

                // 生成所有表的接口
                for (const table of tables) {
                    const interfaceContent = await this.generateTableInterface(table.table_name, schema, includeComments)
                    content += interfaceContent + '\n\n'
                    tableNames.push(table.table_name)
                }

                // 添加导出索引
                content += `/**
 * 所有表接口的导出索引
 */\n`
                content += `export const DatabaseTables = {\n`
                
                // 使用 Map 来跟踪已使用的键，确保唯一性
                const usedKeys = new Map<string, number>()
                tables.forEach(table => {
                    const interfaceName = this.introspector.tableNameToInterfaceName(table.table_name)
                    let key = table.table_name
                    
                    // 如果键已存在，添加后缀
                    if (usedKeys.has(key)) {
                        const count = usedKeys.get(key)! + 1
                        usedKeys.set(key, count)
                        key = `${table.table_name}_${count}`
                    } else {
                        usedKeys.set(key, 1)
                    }
                    
                    content += `  ${key}: '${interfaceName}',\n`
                })
                content += `} as const\n\n`

                content += `export type DatabaseTableNames = typeof DatabaseTables[keyof typeof DatabaseTables]\n`

                // 写入文件
                fs.writeFileSync(filePath, content, 'utf-8')
                generatedFiles.push(filePath)

                return {
                    success: true,
                    message: `成功生成 ${tables.length} 个表的类型定义到文件: ${filePath}`,
                    files: generatedFiles,
                    tables: tableNames
                }

            } else {
                // 为每个表生成单独的文件
                for (const table of tables) {
                    const interfaceContent = await this.generateTableInterface(table.table_name, schema, includeComments)
                    const interfaceName = this.introspector.tableNameToInterfaceName(table.table_name)
                    const fileName = `${interfaceName}.ts`
                    const filePath = path.join(outputDir, fileName)

                    let content = ''

                    // 添加文件头注释
                    content += `/**
 * ${table.table_comment || table.table_name} 表类型定义
 * 自动生成于 ${new Date().toISOString()}
 * 模式: ${schema}
 */\n\n`

                    // 添加导入语句
                    if (includeImports) {
                        const imports = [
                            '// 基础类型导入',
                            'export type { }',
                            '',
                            ...customImports
                        ]
                        content += imports.join('\n') + '\n'
                    }

                    content += interfaceContent

                    // 写入文件
                    fs.writeFileSync(filePath, content, 'utf-8')
                    generatedFiles.push(filePath)
                    tableNames.push(table.table_name)
                }

                // 生成索引文件
                const indexFilePath = path.join(outputDir, 'index.ts')
                let indexContent = `/**
 * 数据库类型定义索引
 * 自动生成于 ${new Date().toISOString()}
 * 模式: ${schema}
 */\n\n`

                // 导出所有接口
                tables.forEach(table => {
                    const interfaceName = this.introspector.tableNameToInterfaceName(table.table_name)
                    indexContent += `export * from './${interfaceName}'\n`
                })

                indexContent += `\n/**
 * 所有表接口的导出索引
 */\n`
                indexContent += `export const DatabaseTables = {\n`
                
                // 使用 Map 来跟踪已使用的键，确保唯一性
                const usedKeys = new Map<string, number>()
                tables.forEach(table => {
                    const interfaceName = this.introspector.tableNameToInterfaceName(table.table_name)
                    let key = table.table_name
                    
                    // 如果键已存在，添加后缀
                    if (usedKeys.has(key)) {
                        const count = usedKeys.get(key)! + 1
                        usedKeys.set(key, count)
                        key = `${table.table_name}_${count}`
                    } else {
                        usedKeys.set(key, 1)
                    }
                    
                    indexContent += `  ${key}: '${interfaceName}',\n`
                })
                indexContent += `} as const\n\n`

                indexContent += `export type DatabaseTableNames = typeof DatabaseTables[keyof typeof DatabaseTables]\n`

                fs.writeFileSync(indexFilePath, indexContent, 'utf-8')
                generatedFiles.push(indexFilePath)

                return {
                    success: true,
                    message: `成功生成 ${tables.length} 个表的类型定义文件到目录: ${outputDir}`,
                    files: generatedFiles,
                    tables: tableNames
                }
            }

        } catch (error) {
            return {
                success: false,
                message: `内省失败: ${error instanceof Error ? error.message : String(error)}`,
                files: [],
                tables: []
            }
        }
    }

    /**
     * 关闭数据库连接池
     */
    async close(): Promise<void> {
        await this.pool.end()
    }

    /**
     * 获取连接池实例
     */
    getPool(): Pool {
        return this.pool
    }
}

/**
 * 便捷的查询构建器
 * 结合SQL生成器和连接池的查询执行器
 */
export class PostgreSQLQueryBuilder<T extends Record<string, any>> extends PostgreSQLSqlGenerator<T> {
    private adapter: PostgreSQLAdapter

    constructor(table: string, adapter: PostgreSQLAdapter) {
        super(table)
        this.adapter = adapter
    }

    /**
     * 创建新的查询实例
     * @param table 表名
     * @param adapter 数据库适配器
     */
    static from<T extends Record<string, any>>(table: string, adapter: PostgreSQLAdapter): PostgreSQLQueryBuilder<T> {
        return new PostgreSQLQueryBuilder<T>(table, adapter)
    }

    /**
     * 执行查询并返回结果
     */
    async exec(): Promise<any> {
        const { sql, params } = this.getSqlWithParams()
        console.log(sql,'sql')
        console.log(params,'params')
        const result = await this.adapter.query(sql, params)
        // 执行后重置查询状态，但保留表名
        this.clear()
        return result
    }

    /**
     * 执行查询并返回单条结果
     */
    async execOne(): Promise<T | null> {
        const { sql, params } = this.getSqlWithParams()
        const result = await this.adapter.queryOne<T>(sql, params)
        // 执行后重置查询状态，但保留表名
        this.clear()
        return result
    }

    /**
     * 执行查询并返回结果数组
     */
    async execMany(): Promise<T[]> {
        const { sql, params } = this.getSqlWithParams()
        const result = await this.adapter.queryMany<T>(sql, params)
        // 执行后重置查询状态，但保留表名
        this.clear()
        return result
    }

    /**
     * 执行查询并返回结果数量
     */
    async execCount(): Promise<number> {
        const countSql = new PostgreSQLSqlGenerator<T>(this['_from'])
            .select('COUNT(*) as count')
        
        // 复制where条件
        countSql['_where'] = [...this['_where']]
        countSql['_params'] = [...this['_params']]

        const { sql, params } = countSql.getSqlWithParams()
        const result = await this.adapter.query(sql, params)
        return parseInt(result.rows[0].count)
    }
}

// 导出类型
export type { 
    PostgreSQLIntrospector,
    TableInfo,
    ColumnInfo,
    ForeignKeyInfo,
    IndexInfo,
    GeneratedInterface
} from './introspect'