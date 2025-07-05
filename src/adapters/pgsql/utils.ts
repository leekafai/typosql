 /**
 * PostgreSQL工具函数
 */

/**
 * 转义PostgreSQL标识符
 * @param identifier 标识符
 * @example
 * escapeIdentifier('user table') // 返回 '"user table"'
 * escapeIdentifier('normal_column') // 返回 '"normal_column"'
 */
export function escapeIdentifier(identifier: string): string {
    return `"${identifier.replace(/"/g, '""')}"`
}

/**
 * 转义PostgreSQL字符串值
 * @param value 字符串值
 * @example
 * escapeString("O'Reilly") // 返回 "O''Reilly"
 */
export function escapeString(value: string): string {
    return value.replace(/'/g, "''")
}

/**
 * 格式化PostgreSQL数组
 * @param array 数组值
 * @example
 * formatArray([1, 2, 3]) // 返回 "{1,2,3}"
 * formatArray(['a', 'b']) // 返回 "{a,b}"
 */
export function formatArray(array: any[]): string {
    const formatted = array.map(item => {
        if (typeof item === 'string') {
            return escapeString(item)
        }
        return item
    })
    return `{${formatted.join(',')}}`
}

/**
 * 解析PostgreSQL数组字符串
 * @param arrayString PostgreSQL数组字符串
 * @example
 * parseArray("{1,2,3}") // 返回 [1, 2, 3]
 * parseArray("{a,b}") // 返回 ["a", "b"]
 */
export function parseArray(arrayString: string): any[] {
    if (!arrayString.startsWith('{') || !arrayString.endsWith('}')) {
        throw new Error('Invalid PostgreSQL array format')
    }
    
    const content = arrayString.slice(1, -1)
    if (!content) return []
    
    const result: any[] = []
    let current = ''
    let inQuotes = false
    let i = 0
    
    while (i < content.length) {
        const char = content[i]
        
        if (char === '"' && (i === 0 || content[i - 1] !== '\\')) {
            inQuotes = !inQuotes
        } else if (char === ',' && !inQuotes) {
            result.push(parseValue(current.trim()))
            current = ''
        } else {
            current += char
        }
        
        i++
    }
    
    if (current) {
        result.push(parseValue(current.trim()))
    }
    
    return result
}

/**
 * 解析单个值
 * @param value 字符串值
 */
function parseValue(value: string): any {
    if (value === 'NULL') return null
    if (value === 'true') return true
    if (value === 'false') return false
    
    // 尝试解析数字
    const num = Number(value)
    if (!isNaN(num) && isFinite(num)) return num
    
    // 移除引号
    if (value.startsWith('"') && value.endsWith('"')) {
        return value.slice(1, -1).replace(/""/g, '"')
    }
    
    return value
}

/**
 * 生成PostgreSQL参数占位符
 * @param count 参数数量
 * @param startIndex 起始索引，默认为1
 * @example
 * generatePlaceholders(3) // 返回 "$1, $2, $3"
 * generatePlaceholders(2, 5) // 返回 "$5, $6"
 */
export function generatePlaceholders(count: number, startIndex: number = 1): string {
    const placeholders: string[] = []
    for (let i = 0; i < count; i++) {
        placeholders.push(`$${startIndex + i}`)
    }
    return placeholders.join(', ')
}

/**
 * 检查是否为有效的PostgreSQL表名
 * @param tableName 表名
 */
export function isValidTableName(tableName: string): boolean {
    // PostgreSQL表名规则：字母、数字、下划线，不能以数字开头
    const tableNameRegex = /^[a-zA-Z_][a-zA-Z0-9_]*$/
    return tableNameRegex.test(tableName)
}

/**
 * 检查是否为有效的PostgreSQL列名
 * @param columnName 列名
 */
export function isValidColumnName(columnName: string): boolean {
    // PostgreSQL列名规则：字母、数字、下划线，不能以数字开头
    const columnNameRegex = /^[a-zA-Z_][a-zA-Z0-9_]*$/
    return columnNameRegex.test(columnName)
}

/**
 * 生成PostgreSQL UUID
 * @returns 新的UUID字符串
 */
export function generateUUID(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        const r = Math.random() * 16 | 0
        const v = c === 'x' ? r : (r & 0x3 | 0x8)
        return v.toString(16)
    })
}

/**
 * 格式化PostgreSQL时间戳
 * @param date 日期对象
 * @returns ISO格式的时间戳字符串
 */
export function formatTimestamp(date: Date): string {
    return date.toISOString()
}

/**
 * 解析PostgreSQL时间戳
 * @param timestamp 时间戳字符串
 * @returns Date对象
 */
export function parseTimestamp(timestamp: string): Date {
    return new Date(timestamp)
}

/**
 * 构建PostgreSQL LIKE查询条件
 * @param column 列名
 * @param pattern 模式字符串
 * @param caseSensitive 是否区分大小写，默认为false
 * @example
 * buildLikeCondition('name', 'john') // 返回 "name ILIKE '%john%'"
 * buildLikeCondition('name', 'john', true) // 返回 "name LIKE '%john%'"
 */
export function buildLikeCondition(column: string, pattern: string, caseSensitive: boolean = false): string {
    const operator = caseSensitive ? 'LIKE' : 'ILIKE'
    const escapedPattern = escapeString(pattern)
    return `${escapeIdentifier(column)} ${operator} '%${escapedPattern}%'`
}

/**
 * 构建PostgreSQL IN查询条件
 * @param column 列名
 * @param values 值数组
 * @example
 * buildInCondition('status', ['active', 'pending']) // 返回 "status IN ('active', 'pending')"
 */
export function buildInCondition(column: string, values: any[]): string {
    const escapedValues = values.map(value => {
        if (typeof value === 'string') {
            return `'${escapeString(value)}'`
        }
        return value
    })
    return `${escapeIdentifier(column)} IN (${escapedValues.join(', ')})`
}