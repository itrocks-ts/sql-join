import { dependencies } from './dependencies.js'
import { Join }         from './join.js'
import { JoinMode }     from './join.js'

export class Subquery<Query = unknown, Where = unknown> extends Join<undefined, never>
{

	query?: Query
	where?: Where

	constructor(query?: Query, where?: Where, rightAlias = '')
	{
		super({
			leftColumn: '',
			leftTable: '',
			leftTableDefinition: undefined,
			mode: JoinMode.INNER,
			rightAlias,
			rightTable: '',
			rightTableDefinition: undefined
		})
		this.query = query
		this.where = where
	}

	override toSql(): string
	{
		const depends = dependencies()
		const alias   = this.rightAlias ? ` ${depends.quoteIdentifier(this.rightAlias)}` : ''
		return `INNER JOIN (${depends.renderSql(this.query)})${alias}`
			+ ` ON ${depends.renderSql(this.where)}`
	}

}
