import { PostgreSQLAdapter, PostgreSQLQueryBuilder } from '../../src/adapters/pgsql'
import dotenv from 'dotenv'
import fs from 'fs'
import path from 'path'

// 加载环境变量
const exist = fs.existsSync(path.join(__dirname, '../../.env.dev'))
console.log('Environment file exists:', exist)
dotenv.config({ path: path.join(__dirname, '../../.env.dev'), encoding: 'utf-8' })

import { KvStoreCopy } from '../../generated-types/minimal/database-types'

// 测试辅助函数
function assert(condition: any, message: string) {
    if (!condition) throw new Error(message)
}

function logTest(testName: string) {
    console.log(`\n🧪 ${testName}`)
    console.log('─'.repeat(50))
}

function logSuccess(message: string) {
    console.log(`✅ ${message}`)
}

function logError(message: string) {
    console.log(`❌ ${message}`)
}

async function main() {
    console.log('🚀 开始 PostgreSQL 适配器单元测试')
    console.log('='.repeat(60))

    // 初始化数据库连接
    const config = {
        host: process.env.POSTGRES_HOST || 'localhost',
        port: Number(process.env.POSTGRES_PORT) || 15433,
        user: process.env.POSTGRES_USER || 'postgres',
        password: process.env.POSTGRES_PASSWORD || '09Axtx#sxia3',
        database: process.env.POSTGRES_DATABASE || 'jx1273',
        ssl: false,
        pool: {
            max: 10,
            idleTimeoutMillis: 30000,
            connectionTimeoutMillis: 2000,
        }
    }
    
    console.log('📊 数据库配置:', {
        host: config.host,
        port: config.port,
        database: config.database,
        user: config.user
    })

    const adapter = new PostgreSQLAdapter(config)
    const sql = PostgreSQLQueryBuilder.from<KvStoreCopy>('kv_store_copy', adapter)

    try {
        // 测试前清理
        logTest('测试前清理')
        await sql.where({ name: { $isNull: false } }).delete().exec()
        logSuccess('表数据清理完成')

        // ==================== INSERT 测试 ====================
        logTest('INSERT 操作测试')

        // 单条插入
        console.log('📝 测试单条插入...')
        let result = await sql.insert({ name: 'test_key', value: 'test_value' }).exec()
        assert(result.rowCount === 1, '单条插入失败')
        logSuccess('单条插入成功')

        // 批量插入
        console.log('📝 测试批量插入...')
        result = await sql.insertMany([
            { name: 'key1', value: 'value1' },
            { name: 'key2', value: 'value2' },
            { name: 'key3', value: 'value3' }
        ]).exec()
        assert(result.rowCount === 3, '批量插入失败')
        logSuccess('批量插入成功')

        // 插入空值
        console.log('📝 测试插入空值...')
        result = await sql.insert({ name: 'null_key', value: null }).exec()
        assert(result.rowCount === 1, '插入空值失败')
        logSuccess('插入空值成功')

        // ==================== SELECT 测试 ====================
        logTest('SELECT 操作测试')

        // 全表查询
        console.log('📖 测试全表查询...')
        let rows = await sql.select().execMany()
        assert(Array.isArray(rows) && rows.length === 5, '全表查询失败')
        logSuccess(`全表查询成功，共 ${rows.length} 条记录`)

        // 条件查询
        console.log('📖 测试条件查询...')
        let one = await sql.select().where({ name: 'key1' }).execOne()
        assert(one && one.value === 'value1', '条件查询失败')
        logSuccess('条件查询成功')

        // 多条件查询
        console.log('📖 测试多条件查询...')
        rows = await sql.select().where({ name: 'key1', value: 'value1' }).execMany()
        assert(rows.length === 1, '多条件查询失败')
        logSuccess('多条件查询成功')

        // 排序查询
        console.log('📖 测试排序查询...')
        rows = await sql.select().orderBy('name', 'ASC').execMany()
        assert(rows.length > 0, '排序查询失败')
        logSuccess('排序查询成功')

        // 限制查询
        console.log('📖 测试限制查询...')
        rows = await sql.select().limit(2).execMany()
        assert(rows.length === 2, '限制查询失败')
        logSuccess('限制查询成功')

        // 复杂条件查询
        console.log('📖 测试复杂条件查询...')
        rows = await sql.select().where({ 
            name: { $in: ['key1', 'key2'] },
            value: { $like: 'value%' }
        }).execMany()
        assert(rows.length === 2, '复杂条件查询失败')
        logSuccess('复杂条件查询成功')

        // ==================== UPDATE 测试 ====================
        logTest('UPDATE 操作测试')

        // 单条更新
        console.log('✏️ 测试单条更新...')
        result = await sql.where({ name: 'key1' }).update({ value: 'updated_value' }).exec()
        assert(result.rowCount === 1, '单条更新失败')
        logSuccess('单条更新成功')

        // 验证更新结果
        one = await sql.select().where({ name: 'key1' }).execOne()
        assert(one && one.value === 'updated_value', '更新验证失败')
        logSuccess('更新验证成功')

        // 批量更新
        console.log('✏️ 测试批量更新...')
        result = await sql.where({ 
            name: { $in: ['key2', 'key3'] } 
        }).update({ value: 'batch_updated' }).exec()
        assert(result.rowCount === 2, '批量更新失败')
        logSuccess('批量更新成功')

        // 更新为空值
        console.log('✏️ 测试更新为空值...')
        result = await sql.where({ name: 'test_key' }).update({ value: null }).exec()
        assert(result.rowCount === 1, '更新为空值失败')
        logSuccess('更新为空值成功')

        // ==================== DELETE 测试 ====================
        logTest('DELETE 操作测试')

        // 条件删除
        console.log('🗑️ 测试条件删除...')
        result = await sql.where({ name: 'key1' }).delete().exec()
        assert(result.rowCount === 1, '条件删除失败')
        logSuccess('条件删除成功')

        // 验证删除结果
        one = await sql.select().where({ name: 'key1' }).execOne()
        assert(!one, '删除验证失败')
        logSuccess('删除验证成功')

        // 批量删除
        console.log('🗑️ 测试批量删除...')
        result = await sql.where({ 
            name: { $in: ['key2', 'key3'] } 
        }).delete().exec()
        assert(result.rowCount === 2, '批量删除失败')
        logSuccess('批量删除成功')

        // 全表删除
        console.log('🗑️ 测试全表删除...')
        result = await sql.where({ name: { $isNull: false } }).delete().exec()
        assert(result.rowCount >= 0, '全表删除失败')
        logSuccess('全表删除成功')

        // ==================== UPSERT 测试 ====================
        logTest('UPSERT 操作测试')

        // 插入新记录
        console.log('🔄 测试插入新记录...')
        await sql.insert({ name: 'upsert_key', value: 'initial_value' }).exec()
        logSuccess('插入新记录成功')

        // ON CONFLICT DO NOTHING
        console.log('🔄 测试 ON CONFLICT DO NOTHING...')
        result = await sql.insert(
            { name: 'upsert_key', value: 'new_value' },
            { onConflict: { columns: ['name'] } }
        ).exec()
        one = await sql.select().where({ name: 'upsert_key' }).execOne()
        assert(one && one.value === 'initial_value', 'ON CONFLICT DO NOTHING 失败')
        logSuccess('ON CONFLICT DO NOTHING 成功')

        // ON CONFLICT DO UPDATE
        console.log('🔄 测试 ON CONFLICT DO UPDATE...')
        result = await sql.insert(
            { name: 'upsert_key', value: 'updated_value' },
            { onConflict: { columns: ['name'], update: ['value'] } }
        ).exec()
        one = await sql.select().where({ name: 'upsert_key' }).execOne()
        assert(one && one.value === 'updated_value', 'ON CONFLICT DO UPDATE 失败')
        logSuccess('ON CONFLICT DO UPDATE 成功')

        // ==================== 数据库内省测试 ====================
        logTest('数据库内省测试')

        // 获取所有表
        console.log('🔍 测试获取所有表...')
        const tables = await adapter.getAllTables()
        assert(Array.isArray(tables) && tables.length > 0, '获取所有表失败')
        logSuccess(`获取所有表成功，共 ${tables.length} 个表`)

        // 获取表结构
        console.log('🔍 测试获取表结构...')
        const columns = await adapter.getTableStructure('kv_store_copy')
        assert(Array.isArray(columns) && columns.length > 0, '获取表结构失败')
        logSuccess(`获取表结构成功，共 ${columns.length} 个字段`)

        // 生成TypeScript接口
        console.log('🔍 测试生成TypeScript接口...')
        const iface = await adapter.generateTableInterface('kv_store_copy')
        assert(typeof iface === 'string' && iface.includes('interface'), '生成接口失败')
        logSuccess('生成TypeScript接口成功')

        // 测试内省功能 - 生成单个文件
        console.log('🔍 测试内省功能 - 生成单个文件...')
        const singleFileResult = await adapter.introspect(
            './test-generated/single',
            'public',
            {
                singleFile: true,
                fileName: 'test-types.ts',
                includeComments: true,
                includeImports: true
            }
        )
        assert(singleFileResult.success, `内省生成单个文件失败: ${singleFileResult.message}`)
        logSuccess(`内省生成单个文件成功: ${singleFileResult.message}`)

        // 测试内省功能 - 生成多个文件
        console.log('🔍 测试内省功能 - 生成多个文件...')
        const multiFileResult = await adapter.introspect(
            './test-generated/multi',
            'public',
            {
                singleFile: false,
                includeComments: true,
                includeImports: true
            }
        )
        assert(multiFileResult.success, `内省生成多个文件失败: ${multiFileResult.message}`)
        logSuccess(`内省生成多个文件成功: ${multiFileResult.message}`)

        // 清理测试数据
        logTest('测试后清理')
        await sql.where({ name: { $isNull: false } }).delete().exec()
        logSuccess('测试数据清理完成')

        console.log('\n🎉 所有测试通过！')
        console.log('='.repeat(60))

    } catch (error) {
        logError(`测试失败: ${error}`)
        throw error
    } finally {
        await adapter.close()
        console.log('🔌 数据库连接已关闭')
    }
}

main().catch(e => {
    console.error('\n💥 测试执行失败:', e)
    process.exit(1)
})