# Dependency configuration

`@itrocks/sql-join` resolves application metadata through dependencies supplied
to `sqlJoinDependsOn()`. Call it before constructing the first `Joins` instance
when overriding the defaults.

## Defaults

The default configuration accepts table definitions with a `columns` record
and column definitions with conventional metadata properties:

| Dependency | Default behaviour |
|---|---|
| `columnDefinitionOf` | Reads the named entry from `tableDefinition.columns`. |
| `columnDefinitionsOf` | Reads `tableDefinition.columns`, or an empty record. |
| `columnOf` | Reads `name` and appends `_id` for relationships. |
| `componentOf` | Reads `component` from the column named in the table definition. |
| `isCollection` | Reads `multiple`, or checks whether `kind` is `collection`. |
| `isScalar` | Reads `scalar`, or infers it from `kind` and the absence of `target`. |
| `quoteIdentifier` | Quotes identifiers with backticks and doubles embedded backticks. |
| `renderSql` | Converts the value to a string. |
| `requiredOf` | Reads `required` from the column named in the table definition. |
| `rightColumnDefinitionOf` | Reads `right`. |
| `splitColumnPath` | Splits on the last dot outside parentheses. |
| `storedAsValueOf` | Reads `storedAsValue`, then `stored`. |
| `tableDefinitionOf` | Reads `target`. |
| `tableOf` | Reads `table`, or converts the definition to a string. |

`componentOf` and `requiredOf` receive the table definition and column name,
matching metadata accessors that operate on a target and property. Other
column dependencies receive the already resolved column definition.

## Generic configuration

Supply only the dependencies whose defaults do not match your metadata:

```ts
import { sqlJoinDependsOn } from '@itrocks/sql-join'

sqlJoinDependsOn<TableDefinition, ColumnDefinition>({
	columnDefinitionOf:  (table, property) => table.properties[property],
	columnDefinitionsOf: table => table.properties,
	componentOf:         (table, property) => table.properties[property].component,
	isCollection:        property => property.collection,
	isScalar:            property => property.primitive,
	requiredOf:          (table, property) => table.properties[property].required,
	tableDefinitionOf:   property => property.target,
	tableOf:             table => table.sqlName
})
```

Partial configuration preserves the defaults for omitted dependencies.

## it.rocks framework configuration

The framework supplies these mappings in its composition root:

- `columnDefinitionOf` reads the named entry returned by `columnDefinitionsOf`.
- `columnDefinitionsOf`, `columnOf`, `rightColumnDefinitionOf`,
  `tableDefinitionOf`, and `tableOf` come from the framework's
  [SQL JOIN reflection adapter](https://github.com/itrocks-ts/framework/blob/main/src/sql-join-dependencies.ts).
- `componentOf` is supplied directly by
  [`componentOf` from `@itrocks/composition`](https://github.com/itrocks-ts/composition#componentof).
- `isCollection` checks whether the reflected property type is a collection.
- `isScalar` checks whether the reflected property has no target table.
- `requiredOf` is supplied directly by
  [`requiredOf` from `@itrocks/required`](https://github.com/itrocks-ts/required#requiredof).
- `storedAsValueOf` uses
  [`storeOf` from `@itrocks/store`](https://github.com/itrocks-ts/store#storeof)
  to check whether the reflected target type is stored.

See the current
[`bind()` implementation](https://github.com/itrocks-ts/framework/blob/main/src/dependencies.ts)
for the source of truth.
