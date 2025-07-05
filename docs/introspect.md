 # 数据库内省功能

TypeSQL 提供了强大的数据库内省功能，可以自动从数据库结构生成 TypeScript 接口定义。

## 功能特性

- 🔍 **自动扫描数据库表结构**
- 📝 **生成 TypeScript 接口定义**
- 📁 **支持单文件和多文件输出**
- 💬 **包含表和字段注释**
- 🔧 **可自定义导入语句**
- 📊 **生成表索引和类型导出**

## 基本用法

### 1. 初始化适配器

```typescript
import { PostgreSQLAdapter } from 'typosql/adapters/pgsql'

const adapter = new PostgreSQLAdapter({
    host: 'localhost',
    port: 5432,
    user: 'postgres',
    password: 'password',
    database: 'my_database'
})
```

### 2. 执行内省

```typescript
// 基本用法 - 生成多个文件
const result = await adapter.introspect('./generated-types')

if (result.success) {
    console.log(result.message)
    console.log('生成的文件:', result.files)
    console.log('处理的表:', result.tables)
} else {
    console.error('内省失败:', result.message)
}
```

## 配置选项

### 输出模式

#### 多文件模式（默认）

每个表生成一个独立的 TypeScript 文件，并创建一个 `index.ts` 索引文件。

```typescript
const result = await adapter.introspect('./types', 'public', {
    singleFile: false  // 默认值
})
```

生成的文件结构：
```
types/
├── User.ts          // 用户表接口
├── Product.ts       // 产品表接口
├── Order.ts         // 订单表接口
└── index.ts         // 导出索引
```

#### 单文件模式

所有表的接口定义生成到一个文件中。

```typescript
const result = await adapter.introspect('./types', 'public', {
    singleFile: true,
    fileName: 'database-types.ts'
})
```

### 完整配置选项

```typescript
const result = await adapter.introspect(
    './generated-types',  // 输出目录
    'public',             // 数据库模式
    {
        // 输出模式
        singleFile: false,                    // 是否生成单个文件
        fileName: 'database-types.ts',        // 单文件模式的文件名
        
        // 内容配置
        includeComments: true,                // 是否包含注释
        includeImports: true,                 // 是否包含导入语句
        customImports: [                      // 自定义导入语句
            "import { BaseEntity } from '../types/base'",
            "import { Timestamp } from '../types/timestamp'"
        ]
    }
)
```

## 生成的接口示例

### 表结构
```sql
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) NOT NULL,
    email VARCHAR(100) UNIQUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE users IS '用户表';
COMMENT ON COLUMN users.username IS '用户名';
COMMENT ON COLUMN users.email IS '邮箱地址';
```

### 生成的 TypeScript 接口

```typescript
/**
 * 用户表类型定义
 * 自动生成于 2024-01-15T10:30:00.000Z
 * 模式: public
 */

// 基础类型导入
export type { }

/**
 * 用户表
 */
export interface Users {
    /** 主键 */
    id: number;
    /** 用户名 */
    username: string;
    /** 邮箱地址 */
    email: string | null;
    /** 创建时间 */
    created_at: string | null;
    /** 更新时间 */
    updated_at: string | null;
}
```

### 索引文件（多文件模式）

```typescript
/**
 * 数据库类型定义索引
 * 自动生成于 2024-01-15T10:30:00.000Z
 * 模式: public
 */

export * from './Users'
export * from './Products'
export * from './Orders'

/**
 * 所有表接口的导出索引
 */
export const DatabaseTables = {
  users: 'Users',
  products: 'Products',
  orders: 'Orders',
} as const

export type DatabaseTableNames = typeof DatabaseTables[keyof typeof DatabaseTables]
```

## 使用生成的类型

### 1. 导入类型

```typescript
// 多文件模式
import { Users, Products } from './generated-types'

// 单文件模式
import { Users, Products } from './generated-types/database-types'
```

### 2. 在查询构建器中使用

```typescript
import { PostgreSQLQueryBuilder } from 'typosql/adapters/pgsql'

// 使用生成的类型
const userQuery = PostgreSQLQueryBuilder.from<Users>('users', adapter)
const users = await userQuery.select().where({ username: 'john' }).execMany()
```

### 3. 类型安全的 CRUD 操作

```typescript
// 插入 - 类型安全
await userQuery.insert({
    username: 'john_doe',
    email: 'john@example.com'
}).exec()

// 更新 - 类型安全
await userQuery.where({ id: 1 }).update({
    email: 'new-email@example.com'
}).exec()

// 查询 - 类型安全
const user = await userQuery.select()
    .where({ username: 'john_doe' })
    .execOne()
// user 的类型是 Users | null
```

## 高级用法

### 自定义类型映射

如果需要自定义 PostgreSQL 类型到 TypeScript 类型的映射，可以修改内省器的 `TYPE_MAP`：

```typescript
// 在 src/adapters/pgsql/introspect.ts 中
private static readonly TYPE_MAP: Record<string, string> = {
    // 默认映射
    'integer': 'number',
    'text': 'string',
    // 自定义映射
    'my_custom_type': 'MyCustomType',
    'enum_status': "'active' | 'inactive' | 'pending'"
}
```

### 批量处理多个模式

```typescript
// 处理多个数据库模式
const schemas = ['public', 'auth', 'analytics']

for (const schema of schemas) {
    const result = await adapter.introspect(
        `./generated-types/${schema}`,
        schema,
        { singleFile: true }
    )
    
    if (result.success) {
        console.log(`✅ ${schema} 模式处理成功`)
    }
}
```

### 集成到构建流程

```typescript
// package.json 脚本
{
  "scripts": {
    "generate-types": "ts-node scripts/generate-types.ts",
    "build": "npm run generate-types && tsc"
  }
}
```

```typescript
// scripts/generate-types.ts
import { PostgreSQLAdapter } from '../src/adapters/pgsql'

async function generateTypes() {
    const adapter = new PostgreSQLAdapter({
        // 数据库配置
    })
    
    try {
        const result = await adapter.introspect('./src/types')
        if (result.success) {
            console.log('✅ 类型生成成功')
        } else {
            console.error('❌ 类型生成失败:', result.message)
            process.exit(1)
        }
    } finally {
        await adapter.close()
    }
}

generateTypes()
```

## 注意事项

1. **权限要求**: 内省功能需要数据库的读取权限，特别是对 `information_schema` 的访问权限。

2. **性能考虑**: 对于大型数据库，内省过程可能需要一些时间，建议在开发环境中使用。

3. **类型更新**: 当数据库结构发生变化时，需要重新运行内省来更新类型定义。

4. **版本控制**: 建议将生成的类型文件添加到版本控制中，但标记为自动生成。

5. **CI/CD 集成**: 可以在 CI/CD 流程中集成内省功能，确保类型定义与数据库结构保持同步。

## 错误处理

内省方法返回的结果对象包含详细的错误信息：

```typescript
const result = await adapter.introspect('./types')

if (!result.success) {
    console.error('内省失败:', result.message)
    // 可能的错误：
    // - 数据库连接失败
    // - 权限不足
    // - 输出目录创建失败
    // - 文件写入失败
}
```