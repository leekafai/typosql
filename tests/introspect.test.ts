import { PostgreSQLAdapter } from '../src/adapters/pgsql'
import dotenv from 'dotenv'
import fs from 'fs'
import path from 'path'

// 尝试加载环境变量
try {
    dotenv.config({ path: path.join(__dirname, '../.env.dev'), encoding: 'utf-8' })
} catch (error) {
    console.log('⚠️ 未找到 .env.dev 文件，使用默认配置')
}

async function testIntrospect() {
    console.log('🔍 开始测试数据库内省功能')
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

    try {
        // 测试1: 生成单个文件
        console.log('\n📁 测试1: 生成单个文件')
        console.log('─'.repeat(40))
        
        const singleFileResult = await adapter.introspect(
            './generated-types/single-file',
            'public',
            {
                singleFile: true,
                fileName: 'all-tables.ts',
                includeComments: true,
                includeImports: true,
                // customImports: [
                //     "// 自定义类型导入",
                //     "import { BaseEntity } from '../types/base'",
                //     "import { Timestamp } from '../types/timestamp'"
                // ]
            }
        )

        if (singleFileResult.success) {
            console.log(`✅ ${singleFileResult.message}`)
            console.log(`📄 生成的文件: ${singleFileResult.files.join(', ')}`)
            console.log(`📊 处理的表: ${singleFileResult.tables.join(', ')}`)
        } else {
            console.log(`❌ ${singleFileResult.message}`)
        }

        // 测试2: 生成多个文件
        console.log('\n📁 测试2: 生成多个文件')
        console.log('─'.repeat(40))
        
        const multiFileResult = await adapter.introspect(
            './generated-types/multi-file',
            'public',
            {
                singleFile: false,
                includeComments: true,
                includeImports: true,
                customImports: [
                    "// 基础类型定义",
                    "export type ID = number | string",
                    "export type Timestamp = string | Date"
                ]
            }
        )

        if (multiFileResult.success) {
            console.log(`✅ ${multiFileResult.message}`)
            console.log(`📄 生成的文件数量: ${multiFileResult.files.length}`)
            console.log(`📊 处理的表: ${multiFileResult.tables.join(', ')}`)
            
            // 显示生成的文件列表
            console.log('\n📋 生成的文件列表:')
            multiFileResult.files.forEach(file => {
                const relativePath = path.relative(process.cwd(), file)
                console.log(`  - ${relativePath}`)
            })
        } else {
            console.log(`❌ ${multiFileResult.message}`)
        }

        // 测试3: 最小配置
        console.log('\n📁 测试3: 最小配置')
        console.log('─'.repeat(40))
        
        const minimalResult = await adapter.introspect(
            './generated-types/minimal',
            'public',
            {
                singleFile: true,
                includeComments: false,
                includeImports: false
            }
        )

        if (minimalResult.success) {
            console.log(`✅ ${minimalResult.message}`)
        } else {
            console.log(`❌ ${minimalResult.message}`)
        }

        // 显示生成的文件内容示例
        console.log('\n📖 生成文件内容示例')
        console.log('─'.repeat(40))
        
        if (singleFileResult.success && singleFileResult.files.length > 0) {
            const filePath = singleFileResult.files[0]
            if (fs.existsSync(filePath)) {
                const content = fs.readFileSync(filePath, 'utf-8')
                const lines = content.split('\n')
                console.log('📄 文件头部内容:')
                lines.slice(0, 20).forEach((line, index) => {
                    console.log(`${String(index + 1).padStart(3, ' ')}: ${line}`)
                })
                if (lines.length > 20) {
                    console.log(`    ... (共 ${lines.length} 行)`)
                }
            }
        }

        console.log('\n🎉 内省功能测试完成！')
        console.log('='.repeat(60))

    } catch (error) {
        console.error('\n💥 测试执行失败:', error)
        throw error
    } finally {
        await adapter.close()
        console.log('🔌 数据库连接已关闭')
    }
}

// 运行测试
testIntrospect().catch(e => {
    console.error('\n💥 测试执行失败:', e)
    process.exit(1)
})