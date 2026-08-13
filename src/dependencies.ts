
export type ColumnDefinitions<ColumnDefinition> = Readonly<Record<string, ColumnDefinition>>

export type Dependencies<TableDefinition, ColumnDefinition> = {
	columnDefinitionOf:      (tableDefinition: TableDefinition, column: string) => ColumnDefinition | undefined
	columnDefinitionsOf:     (tableDefinition: TableDefinition) => ColumnDefinitions<ColumnDefinition>
	columnOf:                (columnDefinition: ColumnDefinition) => string
	componentOf:             (tableDefinition: TableDefinition, column: string) => boolean
	isCollection:            (columnDefinition: ColumnDefinition) => boolean
	isScalar:                (columnDefinition: ColumnDefinition) => boolean
	quoteIdentifier:         (identifier: string) => string
	renderSql:               (value: unknown) => string
	requiredOf:              (tableDefinition: TableDefinition, column: string) => boolean
	rightColumnDefinitionOf: (columnDefinition: ColumnDefinition) => ColumnDefinition | undefined
	splitColumnPath:         (columnPath: string) => [leftPath: string, column: string]
	storedAsValueOf:         (columnDefinition: ColumnDefinition) => boolean
	tableDefinitionOf:       (columnDefinition: ColumnDefinition) => TableDefinition | undefined
	tableOf:                 (tableDefinition: TableDefinition) => string
}

type FreeColumnDefinition = {
 	component?:     unknown
	kind?:          unknown
	multiple?:      unknown
	name?:          unknown
	required?:      unknown
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
	const name = asFreeColumnDefinition(columnDefinition).name
	if (typeof name !== 'string') return ''
	return name + (depends.isScalar(columnDefinition) ? '' : '_id')
}

function defaultComponentOf(tableDefinition: unknown, column: string): boolean
{
	return Boolean(asFreeColumnDefinition(depends.columnDefinitionOf(tableDefinition, column)).component)
}

function defaultRequiredOf(tableDefinition: unknown, column: string): boolean
{
	return Boolean(asFreeColumnDefinition(depends.columnDefinitionOf(tableDefinition, column)).required)
}

function defaultIsScalar(columnDefinition: unknown): boolean
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
	componentOf:               defaultComponentOf,
	isCollection:              columnDefinition => Boolean(asFreeColumnDefinition(columnDefinition).multiple)
		|| (asFreeColumnDefinition(columnDefinition).kind === 'collection'),
	isScalar:                  defaultIsScalar,
	quoteIdentifier:           identifier => '`' + identifier.replaceAll('`', '``') + '`',
	renderSql:                 value => String(value),
	requiredOf:                defaultRequiredOf,
	rightColumnDefinitionOf:   columnDefinition => asFreeColumnDefinition(columnDefinition).right,
	splitColumnPath:           defaultSplitColumnPath,
	storedAsValueOf:           columnDefinition => Boolean(
		asFreeColumnDefinition(columnDefinition).storedAsValue
		?? asFreeColumnDefinition(columnDefinition).stored
	),
	tableDefinitionOf:         columnDefinition => asFreeColumnDefinition(columnDefinition).target,
	tableOf:                   defaultTableOf
}

export function sqlJoinDependsOn<TableDefinition, ColumnDefinition>(
	dependencies: Partial<Dependencies<TableDefinition, ColumnDefinition>>
) {
	Object.assign(depends, dependencies)
}
