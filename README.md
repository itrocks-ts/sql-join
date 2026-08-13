[![npm version](https://img.shields.io/npm/v/@itrocks/sql-join?logo=npm)](https://www.npmjs.org/package/@itrocks/sql-join)
[![npm downloads](https://img.shields.io/npm/dm/@itrocks/sql-join)](https://www.npmjs.org/package/@itrocks/sql-join)
[![GitHub](https://img.shields.io/github/last-commit/itrocks-ts/sql-join?color=2dba4e&label=commit&logo=github)](https://github.com/itrocks-ts/sql-join)
[![issues](https://img.shields.io/github/issues/itrocks-ts/sql-join)](https://github.com/itrocks-ts/sql-join/issues)
[![discord](https://img.shields.io/discord/1314141024020467782?color=7289da&label=discord&logo=discord&logoColor=white)](https://25.re/ditr)

# sql-join

Builds and renders SQL JOIN clauses from relational table metadata.

The package is independent of a query builder. It works with the table and
column definitions exposed by the configured metadata dependencies.

## Requirements

- Node.js 24 or later.

## Installation

```bash
npm i @itrocks/sql-join
```

## Core idea

`Joins` starts from a table definition and resolves paths such as
`customer.address.city`. Each relationship in the path creates a `JOIN`; a
scalar final column is remembered without creating an extra clause.

The following definitions are only an example. Their shape adapts to the
metadata [dependencies](docs/dependencies.md) configured by the framework;
`sql-join` does not require definitions to know how they will be stored or
otherwise used. The `columns` property is kept here because the example model
uses the names `TableDefinition` and `ColumnDefinition`:

```ts
type TableDefinition = {
	columns: Record<string, ColumnDefinition>
	name:    string
}

type ColumnDefinition = {
	component?:     boolean
	kind?:          'collection' | 'scalar' | string
	multiple?:      boolean
	name:           string
	required?:      boolean
	right?:         ColumnDefinition
	scalar?:        boolean
	stored?:        boolean
	storedAsValue?: boolean
	target?:        TableDefinition
}
```

The property name in `columns` is the path segment. In this example, `name`
identifies a definition independently of its eventual use. The dependency
adapter is responsible for resolving definitions to physical SQL table and
column names. A definition is treated as scalar when it has no `target`, unless
`scalar` says otherwise.

An object relationship uses the SQL column resolved from its definition on the
left and the target table's `id` on the right. Collections and components
instead join the left table's `id` to the SQL column resolved from `right`, the
target definition that points back to the left table.

## Usage

```ts
import { Joins, sqlJoinDependsOn } from '@itrocks/sql-join'

type ColumnDefinition = {
	multiple?:  boolean
	name:       string
	required?:  boolean
	right?:     ColumnDefinition
	scalar?:    boolean
	target?:    TableDefinition
}

type TableDefinition = {
	columns: Record<string, ColumnDefinition>
	name:    string
}

const customers: TableDefinition = {
	name: 'Customer',
	columns: {
		name: { name: 'name', scalar: true }
	}
}

const orderLines: TableDefinition = {
	name: 'OrderLine',
	columns: {
		order:    { name: 'order' },
		quantity: { name: 'quantity', scalar: true }
	}
}

const orders: TableDefinition = {
	name: 'Order',
	columns: {
		customer: { name: 'customer', required: true, target: customers },
		lines:    { name: 'lines' },
		number:   { name: 'number', scalar: true }
	}
}

orderLines.columns.order = {
	name: 'order',
	required: true,
	target: orders
}
orders.columns.lines = {
	name: 'lines',
	multiple: true,
	required: true,
	right: orderLines.columns.order,
	target: orderLines
}

const tableNames: Record<string, string> = {
	Customer:  'customers',
	Order:     'orders',
	OrderLine: 'order_lines'
}

const columnNames: Record<string, string> = {
	customer: 'buyer_reference_id',
	order:    'parent_order_id'
}

sqlJoinDependsOn<TableDefinition, ColumnDefinition>({
	columnOf: definition => columnNames[definition.name] ?? definition.name,
	tableOf: definition => tableNames[definition.name] ?? definition.name
})

const joins = new Joins<TableDefinition, ColumnDefinition>(orders, [
	'customer.name',
	'lines.quantity'
])

console.log(joins.rootAlias())
// t0

console.log(joins.toSql())
// INNER JOIN `customers` AS `t1` ON `t0`.`buyer_reference_id` = `t1`.`id`
// INNER JOIN `order_lines` AS `t2` ON `t0`.`id` = `t2`.`parent_order_id`

console.log(joins.getAlias('customer'))
// t1
```

Alias the root table with `rootAlias()` in the surrounding query. Generated
aliases start at `t1`; pass an alias prefix to the constructor when several
`Joins` instances share one query.

## Behaviour

- A required relationship uses `INNER JOIN` only when every relationship
  before it is also required. Otherwise, it uses `LEFT JOIN`.
- Paths and intermediate relationships are added idempotently. Adding the same
  path again returns the previously generated `Join` or `null`.
- Scalar and `storedAsValue`/`stored` columns are registered as paths but do not
  generate a join. Use `hasColumnPath()` to distinguish them from unknown paths.
- Identifiers are quoted with backticks by default, and embedded backticks are
  doubled. SQL values and fragments are not escaped by this package.
- `toSql()` returns clauses separated by newlines, without a leading or trailing
  newline.

## Explicit joins

Use `Join` when the two sides and their physical columns are already known.

```ts
import { Join, JoinMode } from '@itrocks/sql-join'

const join = new Join({
	leftAlias: 't0',
	leftColumn: 'buyer_reference_id',
	leftTable: 'orders',
	leftTableDefinition: orders,
	mode: JoinMode.inner,
	rightAlias: 't1',
	rightColumn: 'id',
	rightTable: 'customers',
	rightTableDefinition: customers,
	secondary: [
		{ leftColumn: 'tenant_key', rightColumn: 'tenant_key' }
	]
})

console.log(join.toSql())
// INNER JOIN `customers` AS `t1` ON `t0`.`buyer_reference_id` = `t1`.`id` AND `t0`.`tenant_key` = `t1`.`tenant_key`
```

`mode` defaults to `JoinMode.left`, `rightColumn` to `id`, and aliases to an
empty string. Set `like: true` on the join or on a secondary condition to use
`LIKE` instead of `=`. Secondary conditions always compare qualified columns;
they do not accept literal values.

## Subquery joins

`Subquery` creates an `INNER JOIN` from a query and an `ON` expression.

```ts
import { Subquery } from '@itrocks/sql-join'

const join = new Subquery(
	'SELECT customer_reference_id, MAX(created_at) AS last_order FROM orders GROUP BY customer_reference_id',
	'latest.customer_reference_id = t0.id',
	'latest'
)

console.log(join.toSql())
// INNER JOIN (SELECT customer_reference_id, MAX(created_at) AS last_order FROM orders GROUP BY customer_reference_id) `latest` ON latest.customer_reference_id = t0.id
```

The query and `ON` expression are inserted as rendered SQL. Parameterize or
validate untrusted values before passing them to `Subquery`.

## API

### `Join`

```ts
new Join<TableDefinition, ColumnDefinition>(
	options: JoinOptions<TableDefinition, ColumnDefinition>
)

leftSql(): string
rightSql(): string
toSql(): string
```

`JoinOptions` requires the left and right table definitions, table names, and
the left column name. It optionally accepts aliases, column definitions,
`rightColumn`, `mode`, `type`, `like`, and `secondary` conditions. `leftSql()`
and `rightSql()` return quoted, qualified column references; `toSql()` renders
the complete clause.

### `Joins`

```ts
new Joins<TableDefinition, ColumnDefinition>(
	startingTableDefinition: TableDefinition,
	columnPaths: readonly string[] = [],
	aliasPrefix = ''
)

add(columnPath: string): Join<TableDefinition, ColumnDefinition> | null
addMultiple(columnPaths: readonly string[]): this
addJoin(join: Join<TableDefinition, ColumnDefinition>, columnPath?: string): void
toSql(): string
sql(): string
```

The constructor can resolve an initial list of paths. `add()` resolves one path
and returns its final relationship join, or `null` for a scalar path.
`addMultiple()` is chainable. `addJoin()` appends an existing join, assigns its
right alias when empty, and optionally registers it under a path. `sql()` is an
alias of `toSql()`.

Lookup methods expose the resolved model:

| Method | Result |
|---|---|
| `rootAlias()` | Root alias (`t0`, including the configured prefix). |
| `getAlias(path)` | Right alias for a relationship path, or the root alias when no join is registered. |
| `getJoin(path)` | Registered join, or `null` for scalar and unknown paths. |
| `getJoins()` | Read-only map of every registered path to its join or `null`. |
| `getOrderedJoins()` | Joins in SQL rendering order. |
| `hasColumnPath(path)` | Whether the path was registered, including scalar paths. |
| `getColumnDefinition(path, column?)` | Column at a full path, or a named column on the table at `path`. |
| `getColumnDefinitions(path)` | Read-only map of columns for the table at `path`; empty when unresolved. |
| `getTableDefinition(path)` | Table definition at `path`, with `''` representing the root. |
| `getTableDefinitions()` | Read-only map of paths to table definitions. |
| `getTable(path)` | Physical table name at `path`, or `undefined`. |
| `getTables()` | Map of paths to physical table names. |
| `getStartingTableDefinition()` | Root table definition. |
| `getStartingTable()` | Root physical table name. |

### `Subquery`

```ts
new Subquery<Query, Where>(query?: Query, where?: Where, rightAlias = '')
toSql(): string
```

Creates an `INNER JOIN` around the query and `ON` expression. The optional
alias is quoted as an identifier.

### Enums and types

```ts
enum JoinMode {
	inner = 'INNER',
	left  = 'LEFT',
	right = 'RIGHT'
}

enum JoinType {
	link   = 'link',
	object = 'object',
	simple = 'simple'
}

type JoinCondition = {
	leftColumn:  string
	like?:       boolean
	rightColumn: string
}
```

`JoinType` is descriptive metadata and does not change SQL rendering. The
package also exports the `JoinOptions` type.

## Limitations

- Automatic path resolution currently supports object relationships and
  one-to-many collections/components. Many-to-many join tables, inverse paths,
  polymorphic storage, and link classes are not resolved automatically.
- `FULL OUTER JOIN` is not supported. Explicit joins accept `INNER`, `LEFT`,
  and `RIGHT`; generated relationship joins use only `INNER` or `LEFT`.
- This package renders join clauses only. It does not build complete queries,
  bind parameters, or sanitize SQL fragments passed to `Subquery`.
