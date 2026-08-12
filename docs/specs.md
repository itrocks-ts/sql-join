@itrocks/sql-join est un package indépendant de tout framework qui gère une structure de données représentant les
jointures en SQL standard.

Le modèle distingue uniquement quatre notions pour décrire les tables et leurs champs :

- `TableDefinition` : objet libre décrivant une table ; l'intégration it.rocks pourra utiliser un `ReflectionClass` ;
- `ColumnDefinition` : objet libre décrivant une colonne ; l'intégration pourra utiliser une propriété réfléchie ;
- `table` : chaîne contenant le nom SQL d'une table ;
- `column` : chaîne contenant le nom SQL d'une colonne.

Le package conserve les définitions et les noms SQL dans chaque jointure. Il ne doit introduire aucune notion
intermédiaire de classe, type, propriété ou nom de propriété dans son contrat.

Les fonctions permettant de passer d'une définition à une autre ou à son nom SQL sont injectées avec
`sqlJoinDependsOn(...)`. Elles permettent notamment de :

- trouver une `ColumnDefinition` depuis une `TableDefinition` et un segment de chemin ;
- trouver la `TableDefinition` cible d'une `ColumnDefinition` ;
- obtenir `table` depuis une `TableDefinition` et `column` depuis une `ColumnDefinition` ;
- obtenir la définition de colonne droite d'une collection 1-N.

`new Joins(tableDefinition)` reçoit directement la définition racine. `add(columnPath)` parcourt une chaîne telle que
`client.address.city`, résout les définitions successives avec les dépendances et génère les jointures nécessaires.

Toutes les dépendances externes au répertoire PHP `framework/sql/join` doivent être remplacées par ce contrat injecté.
