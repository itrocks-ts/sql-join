import { Dependencies }     from '../cjs/sql-join.js'
import { Joins }            from '../cjs/sql-join.js'
import { sqlJoinDependsOn } from '../cjs/sql-join.js'

type TableDefinition = {
	columns: Record<string, ColumnDefinition>
	table:   string
}

type ColumnDefinition = {
	column:  string
	scalar:  boolean
	target?: TableDefinition
}

const tableDefinition: TableDefinition = {
	columns: {
		number: { column: 'number', scalar: true }
	},
	table: 'orders'
}

const metadataDependencies: Partial<Dependencies<TableDefinition, ColumnDefinition>> = {
	columnDefinitionOf:  (definition, column) => definition.columns[column],
	columnDefinitionsOf: definition => definition.columns,
	columnOf:            definition => definition.column,
	scalarOf:            definition => definition.scalar,
	tableDefinitionIdentity: definition => definition.table,
	tableDefinitionOf:   definition => definition.target,
	tableOf:             definition => definition.table
}

sqlJoinDependsOn<TableDefinition, ColumnDefinition>(metadataDependencies)

const joins = new Joins<TableDefinition, ColumnDefinition>(tableDefinition, ['number'])
const columnDefinition: ColumnDefinition | undefined = joins.getColumnDefinition('number')

void columnDefinition

// @ts-expect-error Joins must receive the configured TableDefinition.
new Joins<TableDefinition, ColumnDefinition>('Order')

sqlJoinDependsOn<TableDefinition, ColumnDefinition>({
	// @ts-expect-error Every column dependency must receive ColumnDefinition.
	columnOf: (definition: { incompatible: true }) => String(definition.incompatible)
})

sqlJoinDependsOn<TableDefinition, ColumnDefinition>({
	// @ts-expect-error Every table dependency must receive TableDefinition.
	tableOf: (definition: { incompatible: true }) => String(definition.incompatible)
})

sqlJoinDependsOn<TableDefinition, ColumnDefinition>({
	// @ts-expect-error columnDefinitionsOf must return the configured ColumnDefinition type.
	columnDefinitionsOf: () => ({ invalid: { incompatible: true } })
})
