import { depends } from './dependencies'

export interface Join<TableDefinition = unknown, ColumnDefinition = unknown>
	extends JoinRequired<TableDefinition>, JoinDefaults<ColumnDefinition> {}

export class Join<TableDefinition = unknown, ColumnDefinition = unknown>
{

	constructor(options: JoinOptions<TableDefinition, ColumnDefinition>)
	{
		this.leftAlias             = options.leftAlias ?? ''
		this.leftColumn            = options.leftColumn
		this.leftColumnDefinition  = options.leftColumnDefinition
		this.leftTable             = options.leftTable
		this.leftTableDefinition   = options.leftTableDefinition
		this.like                  = options.like ?? false
		this.mode                  = options.mode ?? JoinMode.left
		this.rightAlias            = options.rightAlias ?? ''
		this.rightColumn           = options.rightColumn ?? 'id'
		this.rightColumnDefinition = options.rightColumnDefinition
		this.rightTable            = options.rightTable
		this.rightTableDefinition  = options.rightTableDefinition
		this.secondary             = [...(options.secondary ?? [])]
		this.type                  = options.type ?? JoinType.simple
	}

	leftSql(): string
	{
		return qualified(this.leftAlias || this.leftTable, this.leftColumn)
	}

	rightSql(): string
	{
		return qualified(this.rightAlias || this.rightTable, this.rightColumn)
	}

	toSql(): string
	{
		const quote = depends.quoteIdentifier
		const alias = this.rightAlias
		const table = quote(this.rightTable)
		const as    = alias ? ` AS ${quote(alias)}` : ''
		let sql = `${this.mode} JOIN ${table}${as} ON ${this.leftSql()}`
			+ ` ${this.like ? 'LIKE' : '='} ${this.rightSql()}`
		for (const condition of this.secondary) {
			sql += ` AND ${qualified(this.leftAlias || this.leftTable, condition.leftColumn)}`
			sql += ` ${condition.like ? 'LIKE' : '='} `
			sql += qualified(alias || this.rightTable, condition.rightColumn)
		}
		return sql
	}

}

export type JoinCondition = {
	leftColumn:  string
	like?:       boolean
	rightColumn: string
}

type JoinDefaults<ColumnDefinition> = {
	leftAlias:             string
	leftColumnDefinition:  ColumnDefinition | undefined
	like:                  boolean
	mode:                  JoinMode
	rightAlias:            string
	rightColumn:           string
	rightColumnDefinition: ColumnDefinition | undefined
	secondary:             JoinCondition[]
	type:                  JoinType
}

export enum JoinMode {
	inner = 'INNER',
	left  = 'LEFT',
	right = 'RIGHT'
}

export type JoinOptions<TableDefinition = unknown, ColumnDefinition = unknown> =
	JoinRequired<TableDefinition> & Partial<JoinOptionsDefaults<ColumnDefinition>>

type JoinOptionsDefaults<ColumnDefinition> =
	Omit<JoinDefaults<ColumnDefinition>, 'secondary'> & { secondary: readonly JoinCondition[] }

type JoinRequired<TableDefinition> = {
	leftColumn:           string
	leftTable:            string
	leftTableDefinition:  TableDefinition
	rightTable:           string
	rightTableDefinition: TableDefinition
}

export enum JoinType {
	link   = 'link',
	object = 'object',
	simple = 'simple'
}

function qualified(alias: string, column: string): string
{
	const quote = depends.quoteIdentifier
	return `${quote(alias)}.${quote(column)}`
}
