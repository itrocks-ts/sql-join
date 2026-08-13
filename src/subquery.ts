import { depends }  from './dependencies'
import { Join }     from './join'
import { JoinMode } from './join'

export class Subquery<Query = unknown, Where = unknown> extends Join<undefined, never>
{

	constructor(
		public query?: Query,
		public where?: Where,
		rightAlias = ''
	) {
		super({
			leftColumn:           '',
			leftTable:            '',
			leftTableDefinition:  undefined,
			mode:                 JoinMode.inner,
			rightAlias,
			rightTable:           '',
			rightTableDefinition: undefined
		})
	}

	override toSql(): string
	{
		const alias = this.rightAlias
			? ` ${depends.quoteIdentifier(this.rightAlias)}`
			: ''
		return `INNER JOIN (${depends.renderSql(this.query)})${alias}`
			+ ` ON ${depends.renderSql(this.where)}`
	}

}
