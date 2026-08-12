import { dependencies } from './dependencies.js'

export enum JoinMode {
	INNER = 'INNER',
	LEFT  = 'LEFT',
	RIGHT = 'RIGHT'
}

export enum JoinType {
	LINK   = 'LINK',
	OBJECT = 'OBJECT',
	SIMPLE = 'SIMPLE'
}

export type JoinCondition = {
	leftColumn:  string
	like?:       boolean
	rightColumn: string
}

export type JoinOptions<TableDefinition = unknown, ColumnDefinition = unknown> = {
	leftAlias?:             string
	leftColumn:             string
	leftColumnDefinition?:  ColumnDefinition
	leftTable:              string
	leftTableDefinition:    TableDefinition
	like?:                  boolean
	mode?:                  JoinMode
	rightAlias?:            string
	rightColumn?:           string
	rightColumnDefinition?: ColumnDefinition
	rightTable:             string
	rightTableDefinition:   TableDefinition
	secondary?:             readonly JoinCondition[]
	type?:                  JoinType
}

export class Join<TableDefinition = unknown, ColumnDefinition = unknown>
{

	leftAlias:              string
	leftColumn:             string
	leftColumnDefinition?:  ColumnDefinition
	leftTable:              string
	leftTableDefinition:    TableDefinition
	like:                   boolean
	mode:                   JoinMode
	rightAlias:             string
	rightColumn:            string
	rightColumnDefinition?: ColumnDefinition
	rightTable:             string
	rightTableDefinition:   TableDefinition
	secondary:              JoinCondition[]
	type:                   JoinType

	constructor(options: JoinOptions<TableDefinition, ColumnDefinition>)
	{
		this.leftAlias             = options.leftAlias ?? ''
		this.leftColumn            = options.leftColumn
		this.leftColumnDefinition  = options.leftColumnDefinition
		this.leftTable             = options.leftTable
		this.leftTableDefinition   = options.leftTableDefinition
		this.like                  = options.like ?? false
		this.mode                  = options.mode ?? JoinMode.LEFT
		this.rightAlias            = options.rightAlias ?? ''
		this.rightColumn           = options.rightColumn ?? 'id'
		this.rightColumnDefinition = options.rightColumnDefinition
		this.rightTable            = options.rightTable
		this.rightTableDefinition  = options.rightTableDefinition
		this.secondary             = [...(options.secondary ?? [])]
		this.type                  = options.type ?? JoinType.SIMPLE
	}

	leftSql(): string
	{
		return qualified(this.leftAlias || this.leftTable, this.leftColumn)
	}

	rightSql(): string
	{
		return qualified(this.rightAlias || this.rightTable, this.rightColumn)
	}

	sql(): string
	{
		return this.toSql()
	}

	toSql(): string
	{
		const quote = dependencies().quoteIdentifier
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

	toString(): string
	{
		return this.toSql()
	}

}

function qualified(alias: string, column: string): string
{
	const quote = dependencies().quoteIdentifier
	return `${quote(alias)}.${quote(column)}`
}
