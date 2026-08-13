import { Dependencies } from './dependencies'
import { depends }      from './dependencies'
import { Join }         from './join'
import { JoinMode }     from './join'
import { JoinType }     from './join'

export class Joins<TableDefinition = unknown, ColumnDefinition = unknown>
{

	readonly aliasPrefix: string

	private aliasCounter = 1
	private readonly columnDefinitionsByTableDefinition = new Map<TableDefinition, ReadonlyMap<string, ColumnDefinition>>()
	private readonly joinsByColumnPath                  = new Map<string, Join<TableDefinition, ColumnDefinition> | null>()
	private readonly orderedJoins:                      Join<TableDefinition, ColumnDefinition>[] = []
	private readonly startingTable:                     string
	private readonly startingTableDefinition:           TableDefinition
	private readonly tableDefinitions                   = new Map<string, TableDefinition>()

	private get depends(): Dependencies<TableDefinition, ColumnDefinition>
	{
		return depends as Dependencies<TableDefinition, ColumnDefinition>
	}

	constructor(startingTableDefinition: TableDefinition, columnPaths: readonly string[] = [], aliasPrefix = '')
	{
		this.aliasPrefix             = aliasPrefix
		this.startingTableDefinition = startingTableDefinition
		this.startingTable           = this.depends.tableOf(startingTableDefinition)
		this.tableDefinitions.set('', startingTableDefinition)
		this.rememberColumnDefinitions(startingTableDefinition)
		this.addMultiple(columnPaths)
	}

	add(columnPath: string, depth = 0): Join<TableDefinition, ColumnDefinition> | null
	{
		if (this.joinsByColumnPath.has(columnPath)) return this.joinsByColumnPath.get(columnPath) ?? null
		if (!columnPath) throw new Error('A column path cannot be empty')

		const [leftPath, column] = this.depends.splitColumnPath(columnPath)
		if (!column) throw new Error(`The column path '${columnPath}' has no final column`)
		if (leftPath && !this.joinsByColumnPath.has(leftPath)) this.add(leftPath, depth + 1)

		const leftTableDefinition = this.tableDefinitions.get(leftPath)
		if (leftTableDefinition === undefined) {
			throw new Error(`The column path '${leftPath}' does not resolve to a table definition`)
		}
		const columnDefinition = this.columnDefinitionAt(leftTableDefinition, column)
		if (columnDefinition === undefined) {
			throw new Error(`Unknown column '${column}' on table '${this.depends.tableOf(leftTableDefinition)}'`)
		}
		if (this.depends.isScalar(columnDefinition) || this.depends.storedAsValueOf(columnDefinition)) {
			this.joinsByColumnPath.set(columnPath, null)
			return null
		}
		const rightTableDefinition = this.depends.tableDefinitionOf(columnDefinition)
		if (rightTableDefinition === undefined) {
			throw new Error(`Relationship column '${columnPath}' has no target table definition`)
		}

		const join = this.createJoin(
			leftTableDefinition,
			rightTableDefinition,
			column,
			columnDefinition,
			leftPath,
			columnPath,
			depth
		)
		this.tableDefinitions.set(columnPath, rightTableDefinition)
		this.rememberColumnDefinitions(rightTableDefinition)
		this.joinsByColumnPath.set(columnPath, join)
		this.orderedJoins.push(join)
		return join
	}

	addJoin(join: Join<TableDefinition, ColumnDefinition>, columnPath?: string): void
	{
		if (!join.rightAlias) join.rightAlias = this.nextAlias()
		this.orderedJoins.push(join)
		if (columnPath !== undefined) {
			this.joinsByColumnPath.set(columnPath, join)
			this.tableDefinitions.set(columnPath, join.rightTableDefinition)
			this.rememberColumnDefinitions(join.rightTableDefinition)
		}
	}

	addMultiple(columnPaths: readonly string[]): this
	{
		for (const columnPath of columnPaths) this.add(columnPath)
		return this
	}

	getAlias(columnPath: string): string
	{
		return this.joinsByColumnPath.get(columnPath)?.rightAlias ?? this.rootAlias()
	}

	getColumnDefinition(columnPath: string, column?: string): ColumnDefinition | undefined
	{
		if (column !== undefined) return this.getColumnDefinitions(columnPath).get(column)
		const [leftPath, finalColumn] = this.depends.splitColumnPath(columnPath)
		return this.getColumnDefinitions(leftPath).get(finalColumn)
	}

	getColumnDefinitions(columnPath: string): ReadonlyMap<string, ColumnDefinition>
	{
		const tableDefinition = this.tableDefinitions.get(columnPath)
		return (tableDefinition === undefined) ? new Map() : this.columnDefinitionsFor(tableDefinition)
	}

	getJoin(columnPath: string): Join<TableDefinition, ColumnDefinition> | null
	{
		return this.joinsByColumnPath.get(columnPath) ?? null
	}

	getJoins(): ReadonlyMap<string, Join<TableDefinition, ColumnDefinition> | null>
	{
		return this.joinsByColumnPath
	}

	getOrderedJoins(): readonly Join<TableDefinition, ColumnDefinition>[]
	{
		return this.orderedJoins
	}

	getStartingTable(): string
	{
		return this.startingTable
	}

	getStartingTableDefinition(): TableDefinition
	{
		return this.startingTableDefinition
	}

	getTable(columnPath: string): string | undefined
	{
		const tableDefinition = this.getTableDefinition(columnPath)
		return (tableDefinition === undefined) ? undefined : this.depends.tableOf(tableDefinition)
	}

	getTableDefinition(columnPath: string): TableDefinition | undefined
	{
		return this.tableDefinitions.get(columnPath)
	}

	getTableDefinitions(): ReadonlyMap<string, TableDefinition>
	{
		return this.tableDefinitions
	}

	getTables(): ReadonlyMap<string, string>
	{
		return new Map([...this.tableDefinitions].map(([columnPath, definition]) => [
			columnPath,
			this.depends.tableOf(definition)
		]))
	}

	hasColumnPath(columnPath: string): boolean
	{
		return this.joinsByColumnPath.has(columnPath)
	}

	rootAlias(): string
	{
		return `${this.aliasPrefix}t0`
	}

	sql(): string
	{
		return this.toSql()
	}

	toSql(): string
	{
		return this.orderedJoins.map(join => join.toSql()).join('\n')
	}

	private createJoin(
		leftTableDefinition: TableDefinition,
		rightTableDefinition: TableDefinition,
		column: string,
		columnDefinition: ColumnDefinition,
		leftPath: string,
		columnPath: string,
		depth: number
	): Join<TableDefinition, ColumnDefinition>
	{
		const leftTable  = this.depends.tableOf(leftTableDefinition)
		const mode       = this.depends.requiredOf(leftTableDefinition, column) && this.isRequiredPath(leftPath)
			? JoinMode.inner
			: JoinMode.left
		const rightTable = this.depends.tableOf(rightTableDefinition)
		if (this.depends.isCollection(columnDefinition) || this.depends.componentOf(leftTableDefinition, column)) {
			const rightColumnDefinition = this.depends.rightColumnDefinitionOf(columnDefinition)
			if (rightColumnDefinition === undefined) {
				throw new Error(`Relationship column '${columnPath}' has no right column definition`)
			}
			return new Join({
				leftAlias: this.aliasOfLeft(leftPath),
				leftColumn: 'id',
				leftColumnDefinition: columnDefinition,
				leftTable,
				leftTableDefinition,
				mode,
				rightAlias: this.nextAlias(),
				rightColumn: this.depends.columnOf(rightColumnDefinition),
				rightColumnDefinition,
				rightTable,
				rightTableDefinition,
				type: depth ? JoinType.simple : JoinType.object
			})
		}
		return new Join({
			leftAlias: this.aliasOfLeft(leftPath),
			leftColumn: this.depends.columnOf(columnDefinition),
			leftColumnDefinition: columnDefinition,
			leftTable,
			leftTableDefinition,
			mode,
			rightAlias: this.nextAlias(),
			rightColumn: 'id',
			rightTable,
			rightTableDefinition,
			type: depth ? JoinType.simple : JoinType.object
		})
	}

	private aliasOfLeft(leftPath: string): string
	{
		return leftPath ? this.getAlias(leftPath) : this.rootAlias()
	}

	private columnDefinitionAt(
		tableDefinition: TableDefinition, column: string
	): ColumnDefinition | undefined
	{
		return this.depends.columnDefinitionOf(tableDefinition, column)
			?? this.columnDefinitionsFor(tableDefinition).get(column)
	}

	private columnDefinitionsFor(tableDefinition: TableDefinition): ReadonlyMap<string, ColumnDefinition>
	{
		let columnDefinitions = this.columnDefinitionsByTableDefinition.get(tableDefinition)
		if (!columnDefinitions) {
			this.rememberColumnDefinitions(tableDefinition)
			columnDefinitions = this.columnDefinitionsByTableDefinition.get(tableDefinition) ?? new Map()
		}
		return columnDefinitions
	}

	private isRequiredPath(columnPath: string): boolean
	{
		if (!columnPath) return true
		return this.joinsByColumnPath.get(columnPath)?.mode === JoinMode.inner
	}

	private nextAlias(): string
	{
		return `${this.aliasPrefix}t${this.aliasCounter ++}`
	}

	private rememberColumnDefinitions(tableDefinition: TableDefinition): void
	{
		if (this.columnDefinitionsByTableDefinition.has(tableDefinition)) return
		const definitions = this.depends.columnDefinitionsOf(tableDefinition)
		this.columnDefinitionsByTableDefinition.set(tableDefinition, new Map(Object.entries(definitions)))
	}

}
