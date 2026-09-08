import { DefaultNamingStrategy, type NamingStrategyInterface } from 'typeorm'

/** `bloogTitle` -> `bloog_title`, `APIKey` -> `api_key`. */
export function snakeCase(input: string): string {
  return input
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1_$2')
    .replace(/[\s.-]+/g, '_')
    .toLowerCase()
}

/**
 * Keeps database identifiers snake_case while entity properties stay camelCase.
 *
 * Written in-repo on purpose: the popular `typeorm-naming-strategies` package was
 * last published in 2022 against TypeORM 0.3, so it isn't a safe dependency on 1.x.
 */
export class SnakeNamingStrategy extends DefaultNamingStrategy implements NamingStrategyInterface {
  override tableName(targetName: string, userSpecifiedName: string | undefined): string {
    return userSpecifiedName ?? snakeCase(targetName)
  }

  // `customName` is declared as `string` upstream but is undefined in practice
  // whenever @Column() was given no explicit name.
  override columnName(
    propertyName: string,
    customName: string,
    embeddedPrefixes: string[],
  ): string {
    const prefix = embeddedPrefixes.length > 0 ? `${snakeCase(embeddedPrefixes.join('_'))}_` : ''
    return prefix + (customName ? customName : snakeCase(propertyName))
  }

  override relationName(propertyName: string): string {
    return snakeCase(propertyName)
  }

  override joinColumnName(relationName: string, referencedColumnName: string): string {
    return snakeCase(`${relationName}_${referencedColumnName}`)
  }

  override joinTableName(
    firstTableName: string,
    secondTableName: string,
    firstPropertyName: string,
    _secondPropertyName: string,
  ): string {
    return snakeCase(
      `${firstTableName}_${firstPropertyName.replace(/\./g, '_')}_${secondTableName}`,
    )
  }

  override joinTableColumnName(
    tableName: string,
    propertyName: string,
    columnName?: string,
  ): string {
    return snakeCase(`${tableName}_${columnName ?? propertyName}`)
  }

  override joinTableInverseColumnName(
    tableName: string,
    propertyName: string,
    columnName?: string,
  ): string {
    return this.joinTableColumnName(tableName, propertyName, columnName)
  }
}
