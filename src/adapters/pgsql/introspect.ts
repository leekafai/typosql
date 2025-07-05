import { Pool, PoolClient } from 'pg'

/**
 * PostgreSQL数据库内省器
 * 用于从数据库结构自动生成TypeScript接口
 */
export class PostgreSQLIntrospector {
    private pool: Pool

    constructor(pool: Pool) {
        this.pool = pool
    }

    /**
     * PostgreSQL类型到TypeScript类型的映射
     */
    private static readonly TYPE_MAP: Record<string, string> = {
        'integer': 'number',
        'bigint': 'number',
        'numeric': 'number',
        'decimal': 'number',
        'real': 'number',
        'double precision': 'number',
        'smallint': 'number',
        'text': 'string',
        'character varying': 'string',
        'character': 'string',
        'varchar': 'string',
        'char': 'string',
        'timestamp': 'string',
        'timestamp with time zone': 'string',
        'date': 'string',
        'time': 'string',
        'boolean': 'boolean',
        'json': 'Record<string, any>',
        'jsonb': 'Record<string, any>',
        'uuid': 'string',
        'bytea': 'Buffer',
        'array': 'any[]'
    }

    /**
     * 获取所有表的信息
     * @param schema 数据库模式，默认为'public'
     */
    async getAllTables(schema: string = 'public'): Promise<TableInfo[]> {
        const query = `
            SELECT 
                t.table_name,
                MAX(d.description) as table_comment
            FROM information_schema.tables t
            LEFT JOIN pg_description d ON d.objoid = (
                SELECT c.oid 
                FROM pg_class c 
                WHERE c.relname = t.table_name 
                AND c.relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = $1)
            )
            WHERE t.table_schema = $1
            GROUP BY t.table_name
            ORDER BY t.table_name
        `
        const result = await this.pool.query(query, [schema])
        // console.log(result.rows,'getAllTables')
        return result.rows
    }

    /**
     * 获取表的结构信息
     * @param tableName 表名
     * @param schema 数据库模式，默认为'public'
     */
    async getTableStructure(tableName: string, schema: string = 'public'): Promise<ColumnInfo[]> {
        const query = `
            SELECT 
                c.column_name,
                c.data_type,
                c.is_nullable,
                c.column_default,
                c.udt_name,
                c.character_maximum_length,
                c.numeric_precision,
                c.numeric_scale,
                d.description as column_comment
            FROM information_schema.columns c
            LEFT JOIN pg_description d ON d.objoid = (
                SELECT c2.oid 
                FROM pg_class c2 
                WHERE c2.relname = $1 
                AND c2.relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = $2)
            ) AND d.objsubid = c.ordinal_position
            WHERE c.table_schema = $2 
            AND c.table_name = $1
            ORDER BY c.ordinal_position
        `
        const result = await this.pool.query(query, [tableName, schema])
        return result.rows
    }

    /**
     * 获取表的主键信息
     * @param tableName 表名
     * @param schema 数据库模式，默认为'public'
     */
    async getPrimaryKeys(tableName: string, schema: string = 'public'): Promise<string[]> {
        const query = `
            SELECT 
                kcu.column_name
            FROM information_schema.table_constraints tc
            JOIN information_schema.key_column_usage kcu 
                ON tc.constraint_name = kcu.constraint_name
                AND tc.table_schema = kcu.table_schema
            WHERE tc.constraint_type = 'PRIMARY KEY'
                AND tc.table_name = $1
                AND tc.table_schema = $2
            ORDER BY kcu.ordinal_position
        `
        const result = await this.pool.query(query, [tableName, schema])
        return result.rows.map(row => row.column_name)
    }

    /**
     * 获取表的外键信息
     * @param tableName 表名
     * @param schema 数据库模式，默认为'public'
     */
    async getForeignKeys(tableName: string, schema: string = 'public'): Promise<ForeignKeyInfo[]> {
        const query = `
            SELECT 
                kcu.column_name,
                ccu.table_name AS foreign_table_name,
                ccu.column_name AS foreign_column_name,
                rc.update_rule,
                rc.delete_rule
            FROM information_schema.table_constraints AS tc
            JOIN information_schema.key_column_usage AS kcu
                ON tc.constraint_name = kcu.constraint_name
                AND tc.table_schema = kcu.table_schema
            JOIN information_schema.constraint_column_usage AS ccu
                ON ccu.constraint_name = tc.constraint_name
                AND ccu.table_schema = tc.table_schema
            JOIN information_schema.referential_constraints AS rc
                ON tc.constraint_name = rc.constraint_name
            WHERE tc.constraint_type = 'FOREIGN KEY'
                AND tc.table_name = $1
                AND tc.table_schema = $2
        `
        const result = await this.pool.query(query, [tableName, schema])
        return result.rows
    }

    /**
     * 获取表的索引信息
     * @param tableName 表名
     * @param schema 数据库模式，默认为'public'
     */
    async getIndexes(tableName: string, schema: string = 'public'): Promise<IndexInfo[]> {
        const query = `
            SELECT 
                i.relname as index_name,
                a.attname as column_name,
                ix.indisunique as is_unique,
                ix.indisprimary as is_primary
            FROM pg_class t
            JOIN pg_index ix ON t.oid = ix.indrelid
            JOIN pg_class i ON ix.indexrelid = i.oid
            JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = ANY(ix.indkey)
            JOIN pg_namespace n ON n.oid = t.relnamespace
            WHERE t.relname = $1
                AND n.nspname = $2
            ORDER BY i.relname, a.attnum
        `
        const result = await this.pool.query(query, [tableName, schema])
        return result.rows
    }

    /**
     * 生成TypeScript接口定义
     * @param tableName 表名
     * @param tableComment 表注释
     * @param columns 列信息
     * @param primaryKeys 主键列表
     */
    generateInterface(
        tableName: string, 
        tableComment: string | null, 
        columns: ColumnInfo[], 
        primaryKeys: string[] = [],
        includeComments: boolean = true
    ): string {
        const interfaceName = this.tableNameToInterfaceName(tableName)
        
        let interfaceContent = ''
        
        // 添加表注释
        if (includeComments && tableComment) {
            interfaceContent += `/**\n * ${tableComment}\n */\n`
        }
        
        interfaceContent += `export interface ${interfaceName} {\n`

        columns.forEach(column => {
            const tsType = this.getTypeScriptType(column)
            const isNullable = column.is_nullable === 'YES'
            const propertyName = column.column_name
            const hasDefault = column.column_default !== null
            const isPrimaryKey = primaryKeys.includes(propertyName)
            
            // 构建类型字符串
            let typeStr = tsType
            if (isNullable) {
                typeStr = `${tsType} | null`
            }
            
            // 添加列注释
            let comment = ''
            if (includeComments) {
                if (column.column_comment) {
                    comment += column.column_comment
                }
                if (hasDefault) {
                    if (comment) comment += '\n'
                    comment += `默认值: ${column.column_default}`
                }
                if (isNullable) {
                    if (comment) comment += '\n'
                    comment += '可为空'
                }
                if (isPrimaryKey) {
                    if (comment) comment += '\n'
                    comment += '主键'
                }
            }
            
            if (comment) {
                interfaceContent += `    /** ${comment} */\n`
            }
            
            interfaceContent += `    ${propertyName}${isNullable ? '?' : ''}: ${typeStr};\n`
        })

        interfaceContent += '}\n'
        return interfaceContent
    }

    /**
     * 将表名转换为接口名
     * @param tableName 表名
     */
    tableNameToInterfaceName(tableName: string): string {
        return tableName
            .split('_')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join('')
    }

    /**
     * 获取TypeScript类型
     * @param column 列信息
     */
    private getTypeScriptType(column: ColumnInfo): string {
        const dataType = column.data_type.toLowerCase()
        
        // 检查数组类型
        if (dataType.includes('array') || column.udt_name?.endsWith('[]')) {
            const baseType = this.getBaseType(column)
            return `${baseType}[]`
        }
        
        return this.getBaseType(column)
    }

    /**
     * 获取基础类型
     * @param column 列信息
     */
    private getBaseType(column: ColumnInfo): string {
        const dataType = column.data_type.toLowerCase()
        
        // 检查已知类型映射
        if (PostgreSQLIntrospector.TYPE_MAP[dataType]) {
            return PostgreSQLIntrospector.TYPE_MAP[dataType]
        }
        
        // 处理特殊类型
        if (dataType === 'character varying' && column.character_maximum_length) {
            return 'string'
        }
        
        if (dataType === 'numeric' && column.numeric_precision) {
            return 'number'
        }
        
        // 默认返回any
        return 'any'
    }

    /**
     * 生成完整的数据库接口文件
     * @param schema 数据库模式，默认为'public'
     */
    async generateAllInterfaces(schema: string = 'public', includeComments: boolean = true): Promise<GeneratedInterface[]> {
        const tables = await this.getAllTables(schema)
        const results: GeneratedInterface[] = []

        for (const table of tables) {
            const columns = await this.getTableStructure(table.table_name, schema)
            const primaryKeys = await this.getPrimaryKeys(table.table_name, schema)
            
            const interfaceContent = this.generateInterface(
                table.table_name,
                table.table_comment,
                columns,
                primaryKeys,
                includeComments
            )

            results.push({
                tableName: table.table_name,
                interfaceName: this.tableNameToInterfaceName(table.table_name),
                content: interfaceContent,
                columns,
                primaryKeys
            })
        }

        return results
    }
}

/**
 * 表信息接口
 */
export interface TableInfo {
    table_name: string
    table_comment: string | null
}

/**
 * 列信息接口
 */
export interface ColumnInfo {
    column_name: string
    data_type: string
    is_nullable: string
    column_default: string | null
    udt_name: string
    character_maximum_length: number | null
    numeric_precision: number | null
    numeric_scale: number | null
    column_comment: string | null
}

/**
 * 外键信息接口
 */
export interface ForeignKeyInfo {
    column_name: string
    foreign_table_name: string
    foreign_column_name: string
    update_rule: string
    delete_rule: string
}

/**
 * 索引信息接口
 */
export interface IndexInfo {
    index_name: string
    column_name: string
    is_unique: boolean
    is_primary: boolean
}

/**
 * 生成的接口信息
 */
export interface GeneratedInterface {
    tableName: string
    interfaceName: string
    content: string
    columns: ColumnInfo[]
    primaryKeys: string[]
}