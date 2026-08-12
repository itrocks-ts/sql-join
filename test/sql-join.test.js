const assert = require('node:assert/strict')
const { test } = require('node:test')

const {
	Join,
	JoinMode,
	Joins,
	JoinType,
	Subquery,
	sqlJoinDependsOn
} = require('../cjs/sql-join.js')

const client = {
	table: 'clients',
	columns: {
		client: undefined,
		name:   { column: 'name', scalar: true },
		number: { column: 'number', scalar: true }
	}
}
client.columns.client = { column: 'client', target: client }

const orderLine = {
	table: 'order_lines',
	columns: {
		order:    undefined,
		quantity: { column: 'quantity', scalar: true }
	}
}

const order = {
	table: 'orders',
	columns: {
		client: { column: 'customer', mandatory: true, target: client },
		lines:  undefined,
		number: { column: 'number', scalar: true }
	}
}
orderLine.columns.order = { column: 'order', mandatory: true, target: order }
order.columns.lines = {
	column: 'lines',
		right: orderLine.columns.order,
	mandatory: true,
	multiple: true,
	target: orderLine
}

test('renders explicit joins, operators and qualified references with safe identifiers', () =>
{
	const join = new Join({
		leftAlias: 't0',
		leftColumn: 'id_client',
		leftTable: 'orders',
		leftTableDefinition: order,
		like: true,
		mode: JoinMode.RIGHT,
		rightAlias: 't`1',
		rightColumn: 'id',
		rightTable: 'cli`ents',
		rightTableDefinition: client,
		secondary: [{ leftColumn: 'tenant', like: true, rightColumn: 'tenant' }]
	})

	assert.equal(join.leftSql(), '`t0`.`id_client`')
	assert.equal(join.rightSql(), '`t``1`.`id`')
	assert.equal(join.leftTableDefinition, order)
	assert.equal(join.rightTableDefinition, client)
	assert.equal(
		join.toSql(),
		'RIGHT JOIN `cli``ents` AS `t``1` ON `t0`.`id_client` LIKE `t``1`.`id`'
			+ ' AND `t0`.`tenant` LIKE `t``1`.`tenant`'
	)
	assert.equal(join.sql(), join.toSql())
	assert.equal(join.toString(), join.toSql())
})

test('remembers scalar column paths without creating joins', () =>
{
	const joins = new Joins(order, ['number'])

	assert.equal(joins.hasColumnPath('number'), true)
	assert.equal(joins.getJoin('number'), null)
	assert.equal(joins.getOrderedJoins().length, 0)
	assert.equal(joins.getAlias('number'), 't0')
	assert.equal(joins.getStartingTable(), 'orders')
	assert.equal(joins.getStartingTableDefinition(), order)
	assert.equal(joins.getColumnDefinition('number'), order.columns.number)
})

test('creates object joins recursively and keeps optional descendants left joined', () =>
{
	client.columns.client.mandatory = false
	const joins = new Joins(order, ['client.client.name'], 'query_')
	const first = joins.getJoin('client')
	const second = joins.getJoin('client.client')

	assert.equal(joins.rootAlias(), 'query_t0')
	assert.equal(first.mode, JoinMode.INNER)
	assert.equal(first.type, JoinType.SIMPLE)
	assert.equal(first.leftColumn, 'id_customer')
	assert.equal(first.leftColumnDefinition, order.columns.client)
	assert.equal(first.leftTable, 'orders')
	assert.equal(first.leftTableDefinition, order)
	assert.equal(first.rightTable, 'clients')
	assert.equal(first.rightTableDefinition, client)
	assert.equal(first.rightAlias, 'query_t1')
	assert.equal(second.mode, JoinMode.LEFT)
	assert.equal(second.leftAlias, 'query_t1')
	assert.equal(second.rightAlias, 'query_t2')
	assert.equal(joins.getJoin('client.client.name'), null)
	assert.equal(joins.getTableDefinition('client'), client)
	assert.equal(joins.getTable('client'), 'clients')
	assert.deepEqual([...joins.getTables().values()], ['orders', 'clients', 'clients'])
})

test('creates a one-to-many join through its right column definition', () =>
{
	const joins = new Joins(order).addMultiple(['lines.quantity'])
	const join = joins.getJoin('lines')

	assert.equal(join.mode, JoinMode.INNER)
	assert.equal(join.leftAlias, 't0')
	assert.equal(join.leftColumn, 'id')
	assert.equal(join.leftColumnDefinition, order.columns.lines)
	assert.equal(join.leftTable, 'orders')
	assert.equal(join.leftTableDefinition, order)
	assert.equal(join.rightAlias, 't1')
	assert.equal(join.rightColumn, 'id_order')
	assert.equal(join.rightColumnDefinition, orderLine.columns.order)
	assert.equal(join.rightTable, 'order_lines')
	assert.equal(join.rightTableDefinition, orderLine)
	assert.equal(joins.getColumnDefinition('lines.quantity'), orderLine.columns.quantity)
	assert.equal(
		joins.toSql(),
		'INNER JOIN `order_lines` AS `t1` ON `t0`.`id` = `t1`.`id_order`'
	)
})

test('is idempotent and accepts a manually constructed join', () =>
{
	const joins = new Joins(order)
	const generated = joins.add('client')
	assert.equal(joins.add('client'), generated)

	const manual = new Join({
		leftAlias: 't0',
		leftColumn: 'id',
		leftTable: 'orders',
		leftTableDefinition: order,
		rightTable: 'order_lines',
		rightTableDefinition: orderLine
	})
	joins.addJoin(manual, 'manual')

	assert.equal(manual.rightAlias, 't2')
	assert.equal(joins.getJoin('manual'), manual)
	assert.deepEqual(joins.getOrderedJoins(), [generated, manual])
})

test('reports incomplete relationship definitions', () =>
{
	const invalid = {
		columns: { children: { column: 'children', multiple: true, target: orderLine } },
		table: 'invalid'
	}
	assert.throws(() => new Joins(invalid, ['children']), /has no right column definition/)
	assert.throws(() => new Joins(order, ['missing']), /Unknown column 'missing'/)
})

test('renders subqueries without importing a query builder', () =>
{
	const subquery = new Subquery('SELECT id FROM orders', 'sq.id = t0.id', 'sq')
	assert.equal(
		subquery.toSql(),
		'INNER JOIN (SELECT id FROM orders) `sq` ON sq.id = t0.id'
	)
})

test('allows dependency adapters to use arbitrary definitions', () =>
{
	const columnLookups = []
	const reflected = {
		fields: new Map([
			['label', { field: 'label', primitive: true }]
		]),
		physical: 'reflected_rows'
	}
	sqlJoinDependsOn({
		columnDefinitionOf: (definition, column) => {
			columnLookups.push([definition, column])
			return definition.fields.get(column)
		},
		columnDefinitionsOf: definition => Object.fromEntries(definition.fields),
		columnOf: definition => definition.field,
		quoteIdentifier: identifier => `"${identifier}"`,
		renderSql: value => value.render(),
		scalarOf: definition => definition.primitive,
		tableDefinitionIdentity: definition => definition.physical,
		tableOf: definition => definition.physical
	})

	const joins = new Joins(reflected, ['label'])
	assert.deepEqual(columnLookups, [[reflected, 'label']])
	assert.equal(joins.getStartingTableDefinition(), reflected)
	assert.equal(joins.getStartingTable(), 'reflected_rows')
	assert.equal(joins.getColumnDefinition('label'), reflected.fields.get('label'))
	assert.equal(new Subquery({ render: () => 'SELECT 1' }, { render: () => '1 = 1' }, 'q').toSql(),
		'INNER JOIN (SELECT 1) "q" ON 1 = 1')
})
