 /**
 * PostgreSQL配置管理
 */

/**
 * 默认的PostgreSQL配置
 */
export const defaultPostgreSQLConfig = {
    host: 'localhost',
    port: 5432,
    user: 'postgres',
    password: '',
    database: 'postgres',
    ssl: false,
    pool: {
        max: 10,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 2000,
    }
}

/**
 * 从环境变量加载PostgreSQL配置
 */
export function loadPostgreSQLConfigFromEnv(): any {
    return {
        host: process.env.POSTGRES_HOST || defaultPostgreSQLConfig.host,
        port: parseInt(process.env.POSTGRES_PORT || defaultPostgreSQLConfig.port.toString()),
        user: process.env.POSTGRES_USER || defaultPostgreSQLConfig.user,
        password: process.env.POSTGRES_PASSWORD || defaultPostgreSQLConfig.password,
        database: process.env.POSTGRES_DATABASE || defaultPostgreSQLConfig.database,
        ssl: process.env.POSTGRES_SSL === 'true' || defaultPostgreSQLConfig.ssl,
        pool: {
            max: parseInt(process.env.POSTGRES_POOL_MAX || defaultPostgreSQLConfig.pool.max.toString()),
            idleTimeoutMillis: parseInt(process.env.POSTGRES_POOL_IDLE_TIMEOUT || defaultPostgreSQLConfig.pool.idleTimeoutMillis.toString()),
            connectionTimeoutMillis: parseInt(process.env.POSTGRES_POOL_CONNECTION_TIMEOUT || defaultPostgreSQLConfig.pool.connectionTimeoutMillis.toString()),
        }
    }
}

/**
 * 验证PostgreSQL配置
 */
export function validatePostgreSQLConfig(config: any): boolean {
    const requiredFields = ['host', 'port', 'user', 'password', 'database']
    
    for (const field of requiredFields) {
        if (!config[field]) {
            throw new Error(`Missing required PostgreSQL configuration: ${field}`)
        }
    }
    
    if (config.port < 1 || config.port > 65535) {
        throw new Error('Invalid PostgreSQL port number')
    }
    
    return true
}