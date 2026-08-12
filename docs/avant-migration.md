# Étude avant migration du générateur de jointures PHP

## Objet

Ce document prépare la migration de `ITRocks\Framework\Sql\Join` vers
`@itrocks/sql-join`. Il inventorie le comportement PHP, les dépendances à
injecter et les fonctionnalités à livrer par paliers.

Le package TypeScript doit rester indépendant du framework et de tout moteur de
base de données. Une table et une propriété sont donc des valeurs génériques :
classe, type, objet de réflexion, objet libre ou chaîne. Leur interprétation est
fournie à `sqlJoinDependsOn(...)`.

Sources étudiées, à la révision PHP `8454258fc92574cc5ad35207293311f56d7fbb42` :

- [`Join.php`](/home/baptiste/itrocks/boust/itrocks/framework/sql/join/Join.php:10) : modèle et rendu d'une jointure ;
- [`Joins.php`](/home/baptiste/itrocks/boust/itrocks/framework/sql/join/Joins.php:24) : génération depuis des chemins de propriétés ;
- [`Subquery.php`](/home/baptiste/itrocks/boust/itrocks/framework/sql/join/Subquery.php:10) : jointure d'une sous-requête ;
- [`Join_Test.php`](/home/baptiste/itrocks/boust/itrocks/framework/sql/join/Join_Test.php:16) : seuls tests unitaires dédiés ;
- [`Link_Table.php`](/home/baptiste/itrocks/boust/itrocks/framework/sql/Link_Table.php:13) et
  [`Link_Class.php`](/home/baptiste/itrocks/boust/itrocks/framework/reflection/Link_Class.php:10) : conventions complexes appelées par `Joins`.

## Périmètre du package

`sql-join` doit posséder le modèle de jointure et la résolution des chemins. Il
ne doit connaître ni la réflexion it.rocks, ni les annotations, ni le DAO, ni un
dialecte SQL. Le framework ou l'application adaptera ses propres métadonnées au
contrat de dépendances du package.

Le portage ne vise pas une traduction ligne à ligne. Il faut préserver les
fonctionnalités publiques utiles : ajouter une ou plusieurs jointures depuis
des chemins de propriétés, obtenir leur SQL et retrouver l'alias d'une table à
partir de son chemin avec l'équivalent de
[`getAlias(path)`](/home/baptiste/itrocks/boust/itrocks/framework/sql/join/Joins.php:558).
Les autres accesseurs PHP ne seront repris que s'ils servent un consommateur ou
une fonctionnalité identifiée.

Deux implémentations TypeScript minimales existent actuellement dans
[`@itrocks/sql-build/join.ts`](/home/baptiste/itrocks/showtime/node_modules/@itrocks/sql-build/src/join.ts:2)
et [`@itrocks/sql-build/joins.ts`](/home/baptiste/itrocks/showtime/node_modules/@itrocks/sql-build/src/joins.ts:3).
Elles ne couvrent qu'une jointure explicite et une liste. À terme, `sql-join`
doit devenir propriétaire de ces concepts ; `sql-build` devra les importer ou
les réexporter, sans conserver une seconde implémentation. Lors de cette
migration, `@itrocks/sql-build` déclarera donc une dépendance à
`@itrocks/sql-join`. `sql-build` n'étant pas encore opérationnel, son portage
fera l'objet d'un chantier séparé.

Conséquences :

- aucune dépendance runtime obligatoire à un package `@itrocks` ;
- `typescript` reste une dépendance de développement ;
- pas de dépendance inverse vers `@itrocks/sql-build`, notamment pour
  `Subquery`, afin d'éviter un cycle ;
- les adaptateurs it.rocks (`ReflectClass`, `ReflectProperty`, décorateurs de
  stockage) appartiendront au framework ou à un package d'intégration.

## Inventaire de l'API PHP

### `Join`

Le modèle PHP expose quatre modes (`INNER`, `LEFT`, `OUTER`, `RIGHT`), trois
types fonctionnels (`SIMPLE`, `OBJECT`, `LINK`) et les données suivantes :
tables, alias, colonnes, objets de métadonnées, conditions secondaires et liens
vers d'autres jointures. Voir [les constantes et propriétés](/home/baptiste/itrocks/boust/itrocks/framework/sql/join/Join.php:13).
Le port TypeScript ne prendra pas en charge `OUTER JOIN`.

Comportements publics observés, à reprendre lorsqu'ils servent le nouveau
contrat :

- `foreignSql()` et `masterSql()` construisent une référence qualifiée
  ([source](/home/baptiste/itrocks/boust/itrocks/framework/sql/join/Join.php:147)) ;
- `newInstance(...)` initialise toutes les données principales
  ([source](/home/baptiste/itrocks/boust/itrocks/framework/sql/join/Join.php:165)) ;
- `toSql()` rend la jointure, ses conditions secondaires et les opérateurs `=`
  ou `LIKE` ([source](/home/baptiste/itrocks/boust/itrocks/framework/sql/join/Join.php:197)) ;
- la conversion en chaîne ajoute le type entre crochets à des fins de diagnostic
  ([source](/home/baptiste/itrocks/boust/itrocks/framework/sql/join/Join.php:138)).

En TypeScript, les noms peuvent suivre les conventions usuelles (`foreignSql`,
`toSql`, `toString`), mais le contrat fonctionnel doit rester reconnaissable.
La construction principale utilisera des options nommées plutôt que la longue
fabrique positionnelle PHP.

### `Joins`

`Joins` mémorise la table racine, les tables et propriétés rencontrées, les
jointures indexées par chemin et le compteur d'alias. Le constructeur peut
résoudre immédiatement plusieurs chemins
([source](/home/baptiste/itrocks/boust/itrocks/framework/sql/join/Joins.php:110)).

API publique observée :

- ajout idempotent et récursif d'un chemin avec `add()`
  ([source](/home/baptiste/itrocks/boust/itrocks/framework/sql/join/Joins.php:129)) ;
- ajout d'une jointure déjà construite avec `addJoin()`
  ([source](/home/baptiste/itrocks/boust/itrocks/framework/sql/join/Joins.php:225)) ;
- ajout en lot avec `addMultiple()`
  ([source](/home/baptiste/itrocks/boust/itrocks/framework/sql/join/Joins.php:346)) ;
- lecture d'un alias, d'une jointure ou de toutes les jointures avec `getAlias`,
  `getJoin`, `getJoins` et `rootAlias`
  ([source](/home/baptiste/itrocks/boust/itrocks/framework/sql/join/Joins.php:558)) ;
- lecture des tables et propriétés associées aux chemins avec `getClass`,
  `getClasses`, `getClassNames`, `getClassProperties`, `getProperties` et
  `getProperty` ([source](/home/baptiste/itrocks/boust/itrocks/framework/sql/join/Joins.php:572)) ;
- accès à la table racine avec `getStartingClass` et `getStartingClassName`
  ([source](/home/baptiste/itrocks/boust/itrocks/framework/sql/join/Joins.php:731)) ;
- accès spécialisés N-N et classes de lien avec `getIdLinkJoin`,
  `getLinkedJoin`, `getLinkedJoins` et `getLinkedTables`
  ([source](/home/baptiste/itrocks/boust/itrocks/framework/sql/join/Joins.php:620)) ;
- fabrique `newInstance()`
  ([source](/home/baptiste/itrocks/boust/itrocks/framework/sql/join/Joins.php:759)).

Les accesseurs spécialisés ne seront pas ajoutés comme simples stubs. Ils
entreront dans l'API avec le palier qui leur donne un comportement, après
confirmation de leur utilité pour un consommateur.

### `Subquery`

`Subquery` hérite de `Join`, accepte une requête et une clause `ON`, puis produit
toujours un `INNER JOIN` ([source](/home/baptiste/itrocks/boust/itrocks/framework/sql/join/Subquery.php:25)).
Le port peut accepter des chaînes ou utiliser une fonction injectée de rendu ;
il ne doit pas importer les builders SQL du framework.

## Dépendances fonctionnelles à injecter

L'API cible devrait suivre le modèle `sqlJoinDependsOn(partialDependencies)` :
un appel fusionne les fonctions reçues avec des valeurs par défaut déterministes.
Les dépendances doivent être fixées avant la première résolution si les
métadonnées sont mises en cache.

Les noms ci-dessous décrivent le besoin, pas encore une signature définitive.

| Besoin | Fonction ou résultat attendu | Palier |
|---|---|---:|
| Identité d'une table | clé stable permettant les caches et comparaisons | 1 |
| Nom SQL d'une table | équivalent générique de `Dao::storeNameOf` | 1 |
| Normalisation d'une table | équivalent de `Builder::className`, sans imposer une classe | 1 |
| Propriétés d'une table | liste ou dictionnaire de descripteurs | 1 |
| Propriété par nom | résolution locale d'un segment de chemin | 1 |
| Découpage d'un chemin | fonction consciente des parenthèses ; une valeur par défaut locale est possible | 1 |
| Description d'une propriété | nom stocké, caractère scalaire/objet, cible, multiplicité, obligation et stockage en valeur | 1 |
| Relation inverse | `foreignAnnotationOf(property)` comme demandé par les specs | 1 |
| Nom de colonne | équivalent de `Store_Name_Annotation::of` | 1 |
| Propriété composante | information équivalente à `@component` | 1 |
| Sécurisation d'un nom SQL | fonction de citation ; valeur par défaut avec accents graves, remplaçable par l'adaptateur du `DataSource` | 1 |
| Rendu SQL externe | rendu d'une sous-requête ou expression fournie par un autre package | 1 |
| Table de jointure N-N | `{ table, masterColumn, foreignColumn }` calculé par l'adaptateur | 2 |
| Nature de la relation | équivalent de `Link_Annotation::of`, au moins collection ou map | 2 |
| Résolution d'une table nommée | résolution d'un nom utilisé par un chemin inverse dans le contexte courant | 3 |
| Polymorphisme | table abstraite, vue, discriminateur et table source | 4 |
| Classe de lien | parent lié, propriété composite, propriétés propres et éventuel `linkSame` | 5 |

Le contrat gagnerait à regrouper les faits cohérents dans des descriptions
retournées par peu de fonctions, plutôt qu'à reproduire chaque méthode de la
réflexion PHP. Il doit néanmoins permettre des adaptateurs fins ;
`foreignAnnotationOf` reste donc un point d'extension explicite.

Les dépendances PHP remplacées par ce contrat sont notamment :

- normalisation de classe et classe source :
  [`Builder::className` et `sourceClassName`](/home/baptiste/itrocks/boust/itrocks/framework/builder/Builder.php:90) ;
- nom de table : [`Dao::storeNameOf`](/home/baptiste/itrocks/boust/itrocks/framework/dao/Dao.php:699) ;
- réflexion des classes et propriétés : imports de
  [`Joins.php`](/home/baptiste/itrocks/boust/itrocks/framework/sql/join/Joins.php:4) ;
- annotations `foreign`, `link`, `store`, `store_name`, `mandatory` et
  `component`, utilisées dans
  [`addSimpleJoin()`](/home/baptiste/itrocks/boust/itrocks/framework/sql/join/Joins.php:467) ;
- conventions de table N-N :
  [`Link_Table`](/home/baptiste/itrocks/boust/itrocks/framework/sql/Link_Table.php:40) ;
- résolution des noms courts pour les chemins inverses :
  [`Namespaces::defaultFullClassName`](/home/baptiste/itrocks/boust/itrocks/framework/tools/Namespaces.php:67) ;
- réflexion spécifique des classes de lien :
  [`Link_Class`](/home/baptiste/itrocks/boust/itrocks/framework/reflection/Link_Class.php:27).

## Plan fonctionnel par paliers

### Palier 1 — socle utilisable

Objectif : générer correctement les jointures courantes d'un modèle simple,
sans connaissance du framework.

À réaliser :

1. Modèle `Join` typé : mode, type, tables, alias, colonnes et métadonnées
   génériques des deux propriétés.
2. Rendu d'une jointure explicite et références qualifiées. La fonction de
   sécurisation entoure par défaut les identifiants d'accents graves et échappe
   ceux qu'ils contiennent ; elle est remplaçable avec
   `sqlJoinDependsOn(...)`, par exemple par celle du `DataSource` MySQL.
3. Construction de `Joins` depuis une table racine et allocation déterministe
   de `t0`, `t1`, etc., préfixables.
4. Ajout idempotent d'un ou plusieurs chemins de propriétés ; création
   récursive des jointures intermédiaires.
5. Propriété scalaire : mémoriser le chemin sans créer de jointure.
6. Relation objet simple : `INNER JOIN` si tout le chemin est obligatoire,
   sinon `LEFT JOIN`.
7. Collection 1-N avec propriété inverse réelle : jointure de l'identifiant de
   la table maîtresse vers la colonne étrangère.
8. Accesseurs génériques de l'inventaire PHP et ajout manuel d'un `Join`.
9. `Subquery` limité à une requête et une condition déjà rendables, sans
   dépendance à `sql-build`.

Exemples de référence :

- `order.client.name` joint `orders.id_client` à `clients.id` ;
- `order.lines.quantity` joint `orders.id` à `order_lines.id_order` ;
- `order.number` ne crée aucune jointure.

Les tests PHP à porter en premier sont les propriétés simples, la relation
objet et la collection 1-N
([cas existants](/home/baptiste/itrocks/boust/itrocks/framework/sql/join/Join_Test.php:19)).

Critère de fin : ces cas fonctionnent avec des objets libres comme des objets
de réflexion ; aucun import runtime du framework n'est présent.

### Palier 2 — relations N-N par table de jointure

Une relation map nécessite deux jointures : table maîtresse vers table de lien,
puis table de lien vers table cible. Le PHP les relie par `linked_join` et
conserve aussi les colonnes de la table intermédiaire
([source](/home/baptiste/itrocks/boust/itrocks/framework/sql/join/Joins.php:298)).

À ajouter :

- description injectée de la table de jointure et de ses deux colonnes ;
- génération et ordre stables des deux `Join` ;
- `linkedJoin`, `getLinkedTables` et clés de chemins synthétiques, si elles sont
  encore nécessaires aux consommateurs ;
- parcours au-delà de la cible, par exemple `order.salesmen.name` ;
- port du [test map PHP](/home/baptiste/itrocks/boust/itrocks/framework/sql/join/Join_Test.php:96).

Les règles de pluralisation et les noms implicites de `Link_Table` ne doivent
pas être recopiés dans le cœur. Elles sont propres au modèle et au stockage ;
l'adaptateur fournit le résultat final.

### Palier 3 — chemins inverses

Le PHP accepte `Order_Line(order).quantity` pour partir d'une commande vers les
lignes dont la propriété `order` pointe vers elle. Il accepte aussi l'ancienne
syntaxe `Order_Line->order`, des conditions supplémentaires dans les
parenthèses et le préfixe `~` pour `LIKE`
([source](/home/baptiste/itrocks/boust/itrocks/framework/sql/join/Joins.php:385)).

À ajouter :

- résolution explicite d'une table cible et de sa propriété inverse ;
- chemins inverses directs, puis inverses via une table N-N ;
- port des [tests inverses PHP](/home/baptiste/itrocks/boust/itrocks/framework/sql/join/Join_Test.php:152).

La syntaxe obsolète `Classe->propriété` est abandonnée. Ce palier ne comprend
pas les conditions textuelles supplémentaires encodées dans les parenthèses.

### Palier 4 — polymorphisme de stockage

Le PHP ajoute implicitement des conditions sur une colonne `class` lorsqu'une
classe abstraite est stockée dans une vue suffixée `_view`, ou lorsqu'une
propriété pointe vers un type abstrait
([source](/home/baptiste/itrocks/boust/itrocks/framework/sql/join/Joins.php:180)).

Cette convention est très liée au DAO PHP. Elle exige avant développement :

- une description générique de la stratégie d'héritage en base ;
- le nom explicite de la colonne discriminante ;
- la valeur du discriminateur et sa conversion en paramètre SQL ;
- des tests dédiés, absents du package PHP.

Ne pas déduire ce comportement d'un suffixe de table dans le cœur TypeScript.
Le framework TypeScript ne le gère pas encore : ce palier est donc différé et
peu prioritaire. La cible future sera une classe abstraite ou une interface liée
à plusieurs tables du DAO. Leur consultation produira des instances concrètes
selon la table d'origine ; par exemple `documents` réunira devis, commandes et
factures.

### Palier 5 — classes de lien

Une classe de lien est une classe métier qui hérite d'une autre classe métier,
mais dont la table ne répète pas les colonnes du parent lié. Elle contient une
clé vers ce parent et les seules données propres à la relation.

Exemple demandé : `Order_Salesman extends Order` ajoute `salesman`. La table
`orders_salesmen` contient `id_order` et `id_salesman`, pas les colonnes de
`Order`. Si la classe ajoute aussi `percentage`, cette colonne appartient à la
table de lien.

Le dépôt PHP contient un exemple réel :
[`Quote_Salesman extends Salesman`](/home/baptiste/itrocks/boust/itrocks/framework/tests/objects/Quote_Salesman.php:6),
avec `quote`, `salesman` et `percentage`, ainsi qu'un second niveau
[`Quote_Salesman_Additional`](/home/baptiste/itrocks/boust/itrocks/framework/tests/objects/Quote_Salesman_Additional.php:4).

Le générateur PHP :

- détecte une ou plusieurs classes parentes liées ;
- trouve la propriété composite qui rattache chaque table ;
- ajoute une jointure de type `LINK` par niveau ;
- fusionne dans le chemin les propriétés propres des classes de lien tout en
  excluant les propriétés déjà héritées ;
- gère le cas ambigu de deux liens vers la même classe avec `link_same` ;
- corrige certains alias quand une table N-N traverse elle-même une classe de
  lien.

Voir [`addLinkedClass()`](/home/baptiste/itrocks/boust/itrocks/framework/sql/join/Joins.php:239)
et la définition PHP de [`@link` de classe](/home/baptiste/itrocks/boust/itrocks/framework/reflection/annotation/class_/Link_Annotation.php:12).

Avant ce palier, il faudra définir un contrat indépendant de l'héritage
TypeScript : parent lié, table propre, propriété composite, propriétés propres,
chaîne éventuelle de classes de lien et résolution des ambiguïtés. Cette
fonctionnalité ne doit pas compliquer le modèle de base tant que ces concepts
ne sont pas stabilisés.

### Palier 6 — conditions textuelles dans les chemins

Ce palier éventuel portera la mini-grammaire historique des conditions
secondaires placées dans les parenthèses d'un chemin inverse, les références de
colonnes, les valeurs SQL citées et le préfixe `~` signifiant `LIKE`
([source](/home/baptiste/itrocks/boust/itrocks/framework/sql/join/Joins.php:411)).

Les constantes entourées de guillemets et leur paramétrisation sont ignorées
jusque-là. Avant implémentation, il faudra définir et tester la grammaire ; une
API structurée restera préférable pour les nouveaux usages.

### Palier 7 — collections de chaînes

Cette fonctionnalité est attendue, mais différée. Le PHP reconnaît lui-même que
plusieurs stockages sont possibles : table associée, `SET` MySQL ou autre
représentation ([source](/home/baptiste/itrocks/boust/itrocks/framework/sql/join/Joins.php:478)).

Le cœur devra décrire le besoin sans supposer MySQL. L'adaptateur du moteur
fournira la stratégie de stockage et les éventuelles jointures. La position
exacte de ce palier pourra être réévaluée selon les premiers consommateurs.

### Dernier palier éventuel — diagnostic `[TYPE]`

Le suffixe `[TYPE]` ajouté par le `toString()` PHP n'est pas porté pour
l'instant. Avant de l'implémenter, une étude complète des usages dans le
framework PHP devra établir s'il apporte une fonctionnalité réelle. Il restera
le dernier palier et pourra être abandonné si aucun consommateur ne le requiert.

## Critique de l'existant et décisions proposées

### À corriger avant la migration

- `OUTER JOIN` n'est pas pris en charge. Le mode historique correspondant ne
  fait pas partie de l'API TypeScript.
- Les accents graves sont conservés par défaut, mais derrière une fonction
  unique qui sécurise tous les noms SQL : tables, colonnes et alias. Son
  implémentation par défaut entoure les identifiants et échappe les accents
  graves internes. Cette fonction est injectable avec
  `sqlJoinDependsOn(...)`. L'intégration MySQL pourra ainsi utiliser celle de
  son `DataSource` ; ce choix de dialecte n'appartient pas à `sql-join`.
- `newInstance` est une longue fabrique positionnelle dont la documentation
  inverse l'ordre de `foreign_alias` et `foreign_table`
  ([source](/home/baptiste/itrocks/boust/itrocks/framework/sql/join/Join.php:165)).
  La construction TypeScript utilisera des options nommées.
- Les conditions secondaires distinguent une constante d'une colonne en lisant
  son premier caractère `'` ou `"`, puis concatènent la valeur telle quelle
  ([source](/home/baptiste/itrocks/boust/itrocks/framework/sql/join/Join.php:201)).
  Les problématiques de constantes entre guillemets sont ignorées avant le
  palier 6.
- `getClassNames()` promet des classes uniques mais retourne simplement toutes
  les valeurs, doublons compris
  ([source](/home/baptiste/itrocks/boust/itrocks/framework/sql/join/Joins.php:584)).
  Le port dédoublonnera le résultat. Cette méthode fournit notamment au
  maintainer MySQL le contexte d'exécution, c'est-à-dire les tables impliquées
  dans la requête ; répéter une table ne fait pas échouer le traitement, mais
  provoque des vérifications inutiles.
- `t0` est la convention valide pour la table située immédiatement après le
  `FROM`, à gauche de la première jointure. `rootAlias()` doit donc retourner
  `t0`, avec le préfixe configuré le cas échéant. Toute allocation d'alias doit
  appliquer cette convention de façon cohérente.
- Le tableau PHP mélange `Join`, `null`, index numériques et clés synthétiques
  (`-link`, `-@link`). Le port utilisera des structures distinctes : un index
  direct par chemin pour les recherches, une liste ordonnée pour le rendu SQL
  et des relations typées pour les jointures intermédiaires. Les clés
  synthétiques historiques ne feront pas partie du nouveau contrat public.

### À différer ou abandonner

- La syntaxe inverse dépréciée `Classe->propriété` est abandonnée.
- Les conditions textuelles encodées dans le chemin et les valeurs SQL déjà
  citées sont différées au palier 6.
- Les collections de chaînes sont différées à un palier dédié, mais restent une
  fonctionnalité attendue et devront fonctionner avec des moteurs non MySQL.
- Le polymorphisme détecté par le suffixe `_view` est différé. La future
  fonctionnalité reposera sur un contrat explicite entre types abstraits et
  tables du DAO, pas sur un suffixe implicite.
- La fabrique d'instanciation du `Builder` PHP n'est pas portée. Ce mécanisme est
  transparent dans it.rocks TypeScript : les objets seront instanciés
  directement, sans dépendance injectée dédiée.
- `linked_class`, déclarée mais jamais alimentée dans ce package, est
  abandonnée.
- Le suffixe de diagnostic `[TYPE]` est différé au dernier palier éventuel,
  après étude de tous ses usages PHP.

### Manques de tests du PHP

Les tests dédiés couvrent les propriétés simples, relations objet, collections,
maps et chemins inverses. Ils ne couvrent pas :

- le SQL produit par `Join::toSql` ;
- `Subquery` ;
- les conditions secondaires et `LIKE` ;
- `RIGHT`, le mode historique `OUTER` et le préfixe d'alias ;
- le polymorphisme ;
- les classes de lien ;
- la plupart des accesseurs publics.

Chaque palier devra donc ajouter ses propres tests de contrat au lieu de se
limiter à traduire `Join_Test.php`.

La version TypeScript disposera d'une batterie complète de tests avec le runner
natif de Node.js. Le package exposera `npm test`, exécutant `node --test`. Les
tests couvriront chaque fonction publique prise en charge, le rendu SQL, les
erreurs de métadonnées et les interactions entre paliers. `OUTER JOIN`, exclu du
périmètre, n'aura pas de test de compatibilité.

## Ordre de migration recommandé

1. Fixer les types génériques table/propriété, le contrat de dépendances et le
   rendu d'identifiants.
2. Livrer et valider le palier 1 avec des fixtures libres, sans réflexion.
3. Écrire l'adaptateur it.rocks séparément et vérifier les mêmes scénarios avec
   `ReflectClass` et `ReflectProperty`.
4. Déplacer la propriété des classes minimales de `sql-build` vers `sql-join`,
   déclarer la dépendance de `sql-build` à ce package, puis préparer la migration
   séparée de `sql-build`.
5. Ajouter les relations N-N et les chemins inverses, puis les classes de lien,
   avec des fixtures dédiées.
6. Planifier selon les besoins le polymorphisme, les conditions textuelles et
   les collections de chaînes. Le numéro d'un palier décrit ici son périmètre,
   pas une obligation de livrer le polymorphisme avant les classes de lien.
7. N'étudier le suffixe `[TYPE]` qu'en dernier, après audit de ses usages PHP.

Le premier livrable utile s'arrête donc aux relations objet et collections 1-N.
Il conserve une architecture capable d'accueillir les tables N-N, puis les
fonctionnalités historiques complexes, sans les imposer à tous les usages.
