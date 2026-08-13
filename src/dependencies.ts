
export type ColumnDefinitions<ColumnDefinition> = Readonly<Record<string, ColumnDefinition>>

export type Dependencies<TableDefinition, ColumnDefinition> = {
	columnDefinitionOf:      (tableDefinition: TableDefinition, column: string) => ColumnDefinition | undefined
	columnDefinitionsOf:     (tableDefinition: TableDefinition) => ColumnDefinitions<ColumnDefinition>
	columnOf:                (columnDefinition: ColumnDefinition) => string
	componentOf:             (columnDefinition: ColumnDefinition) => boolean
	mandatoryOf:             (columnDefinition: ColumnDefinition) => boolean
	multipleOf:              (columnDefinition: ColumnDefinition) => boolean
	quoteIdentifier:         (identifier: string) => string
	renderSql:               (value: unknown) => string
	rightColumnDefinitionOf: (columnDefinition: ColumnDefinition) => ColumnDefinition | undefined
	scalarOf:                (columnDefinition: ColumnDefinition) => boolean
	splitColumnPath:         (columnPath: string) => [leftPath: string, column: string]
	storedAsValueOf:         (columnDefinition: ColumnDefinition) => boolean
	tableDefinitionIdentity: (tableDefinition: TableDefinition) => unknown
	tableDefinitionOf:       (columnDefinition: ColumnDefinition) => TableDefinition | undefined
	tableOf:                 (tableDefinition: TableDefinition) => string
}

type FreeColumnDefinition = {
	column?:        unknown
	component?:     unknown
	kind?:          unknown
	mandatory?:     unknown
	multiple?:      unknown
	right?:         unknown
	scalar?:        unknown
	stored?:        unknown
	storedAsValue?: unknown
	target?:        unknown
}

type FreeTableDefinition = {
	columns?: ColumnDefinitions<unknown>
	table?:   unknown
}

function asFreeColumnDefinition(columnDefinition: unknown): FreeColumnDefinition
{
	return isObject(columnDefinition) ? columnDefinition : {}
}

function asFreeTableDefinition(tableDefinition: unknown): FreeTableDefinition
{
	return isObject(tableDefinition) ? tableDefinition : {}
}

function defaultColumnDefinitionOf(tableDefinition: unknown, column: string): unknown | undefined
{
	return depends.columnDefinitionsOf(tableDefinition)[column]
}

function defaultColumnDefinitionsOf(tableDefinition: unknown): ColumnDefinitions<unknown>
{
	return asFreeTableDefinition(tableDefinition).columns ?? {}
}

function defaultColumnOf(columnDefinition: unknown): string
{
	if (typeof columnDefinition === 'string') return columnDefinition
	const column = asFreeColumnDefinition(columnDefinition).column
	return (typeof column === 'string') ? column : ''
}

function defaultScalarOf(columnDefinition: unknown): boolean
{
	if (typeof columnDefinition === 'string') return true
	const freeColumnDefinition = asFreeColumnDefinition(columnDefinition)
	const kind = (typeof freeColumnDefinition.kind === 'string')
		? freeColumnDefinition.kind
		: undefined
	return (typeof freeColumnDefinition.scalar === 'boolean')
		? freeColumnDefinition.scalar
		: ((kind === 'scalar') || (freeColumnDefinition.target === undefined))
}

function defaultSplitColumnPath(columnPath: string): [string, string]
{
	let parentheses = 0
	for (let index = columnPath.length - 1; index >= 0; index --) {
		const character = columnPath[index]
		if (character === ')') parentheses ++
		else if (character === '(') parentheses --
		else if ((character === '.') && !parentheses) {
			return [columnPath.slice(0, index), columnPath.slice(index + 1)]
		}
	}
	return ['', columnPath]
}

function defaultTableOf(tableDefinition: unknown): string
{
	if (typeof tableDefinition === 'string') return tableDefinition
	const table = asFreeTableDefinition(tableDefinition).table
	return (typeof table === 'string') ? table : String(tableDefinition)
}

function isObject(value: unknown): value is Record<string, unknown>
{
	return (typeof value === 'object') && (value !== null)
}

export const depends: Dependencies<unknown, unknown> = {
	columnDefinitionOf:        defaultColumnDefinitionOf,
	columnDefinitionsOf:       defaultColumnDefinitionsOf,
	columnOf:                  defaultColumnOf,
	componentOf:               columnDefinition => Boolean(asFreeColumnDefinition(columnDefinition).component),
	mandatoryOf:               columnDefinition => Boolean(asFreeColumnDefinition(columnDefinition).mandatory),
	multipleOf:                columnDefinition => Boolean(asFreeColumnDefinition(columnDefinition).multiple)
		|| (asFreeColumnDefinition(columnDefinition).kind === 'collection'),
	quoteIdentifier:           identifier => '`' + identifier.replaceAll('`', '``') + '`',
	renderSql:                 value => String(value),
	rightColumnDefinitionOf:   columnDefinition => asFreeColumnDefinition(columnDefinition).right,
	scalarOf:                  defaultScalarOf,
	splitColumnPath:           defaultSplitColumnPath,
	storedAsValueOf:           columnDefinition => Boolean(
		asFreeColumnDefinition(columnDefinition).storedAsValue
		?? asFreeColumnDefinition(columnDefinition).stored
	),
	tableDefinitionIdentity:   tableDefinition => depends.tableOf(tableDefinition),
	tableDefinitionOf:         columnDefinition => asFreeColumnDefinition(columnDefinition).target,
	tableOf:                   defaultTableOf
}

export function sqlJoinDependsOn<TableDefinition, ColumnDefinition>(
	dependencies: Partial<Dependencies<TableDefinition, ColumnDefinition>>
) {
	Object.assign(depends, dependencies)
}
