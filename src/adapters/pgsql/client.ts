import { Client } from 'pg'
import { PostgreSQLConfig } from './index'

/**
 * PostgreSQL客户端管理器
 * 用于处理事务和单个连接
 */
export class PostgreSQLClient {
    private client: Client | null = null
    private isConnected: boolean = false
    private config: PostgreSQLConfig

    constructor(config: PostgreSQLConfig) {
        this.config = config
    }

    /**
     * 获取数据库客户端连接
     */
    async getClient(): Promise<Client> {
        if (!this.client) {
            this.client = new Client({
                host: this.config.host,
                port: this.config.port,
                user: this.config.user,
                password: this.config.password,
                database: this.config.database,
                ssl: this.config.ssl
            })
        }

        if (!this.isConnected) {
            await this.client.connect()
            this.isConnected = true
        }

        return this.client
    }

    /**
     * 开始事务
     * @example
     * const client = await postgresClient.getClient()
     * try {
     *   await client.query('BEGIN')
     *   // 执行事务操作
     *   await client.query('COMMIT')
     * } catch (e) {
     *   await client.query('ROLLBACK')
     *   throw e
     * }
     */
    async beginTransaction(): Promise<void> {
        const client = await this.getClient()
        await client.query('BEGIN')
    }

    /**
     * 提交事务
     */
    async commitTransaction(): Promise<void> {
        const client = await this.getClient()
        await client.query('COMMIT')
    }

    /**
     * 回滚事务
     */
    async rollbackTransaction(): Promise<void> {
        const client = await this.getClient()
        await client.query('ROLLBACK')
    }

    /**
     * 执行事务
     * @param callback 事务回调函数
     * @example
     * await postgresClient.transaction(async (client) => {
     *   await client.query('INSERT INTO users (name) VALUES ($1)', ['John'])
     *   await client.query('UPDATE users SET status = $1 WHERE name = $2', ['active', 'John'])
     * })
     */
    async transaction<T>(callback: (client: Client) => Promise<T>): Promise<T> {
        const client = await this.getClient()
        
        try {
            await client.query('BEGIN')
            const result = await callback(client)
            await client.query('COMMIT')
            return result
        } catch (error) {
            await client.query('ROLLBACK')
            throw error
        }
    }

    /**
     * 执行查询
     * @param sql SQL语句
     * @param params 参数数组
     */
    async query(sql: string, params?: any[]): Promise<any> {
        const client = await this.getClient()
        const result = await client.query(sql, params || [])
        return result.rows
    }

    /**
     * 执行查询并返回单条结果
     * @param sql SQL语句
     * @param params 参数数组
     */
    async queryOne<T = any>(sql: string, params?: any[]): Promise<T | null> {
        const client = await this.getClient()
        const result = await client.query(sql, params || [])
        return result.rows[0] || null
    }

    /**
     * 执行查询并返回结果数组
     * @param sql SQL语句
     * @param params 参数数组
     */
    async queryMany<T = any>(sql: string, params?: any[]): Promise<T[]> {
        const client = await this.getClient()
        const result = await client.query(sql, params || [])
        return result.rows
    }

    /**
     * 关闭连接
     */
    async close(): Promise<void> {
        if (this.client && this.isConnected) {
            await this.client.end()
            this.isConnected = false
            this.client = null
        }
    }

    /**
     * 检查连接状态
     */
    isConnectedToDatabase(): boolean {
        return this.isConnected
    }
}