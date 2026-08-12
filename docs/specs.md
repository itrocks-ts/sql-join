
@itrocks/sql-join est un package indépendant de tout framework qui va simplement gérer une structure de données
représentant les jointures en SQL standard.

Il doit présenter les mêmes fonctions publiques que celles dans /home/baptiste/itrocks/boust/itrocks/framework/sql/join/*.php.

Par contre les objets supposés représenter une classe, une propriété, doivent être généralisés en des objets de types
libres pouvant représenter la structure décrivant une table pour la partie table (qui peut être une classe, un type, un objet de réflexion de classe,
ou même un objet libre, ou un string avec le nom de la table), et décrivant un champs (donc ça peut être une réflexion de propriété de classe, ou n'importe quoi
qui permette d'obtenir des infos sur la structure à donner à un champs).

Les fonctions qui, à partir d'un objet décrivant la table et d'un objet décrivant le champs, permettent d'obtenir les
éléments permettant d'avoir les infos plus "SQL" correspondantes, sont à injecter comme dépendance au package.
Autrement dit tous les use dans le script php qui vont chercher des dépendances en dehors de framwork/sql/join sont à traduire
dans cette version en typescript en des appels à des fonctions dynamiquement allouées par un appel à dépendances.

Exemple :
- Foreign_Annotation::of doit être une fonction envoyée dans sqlJoinDependsOn({ foreignAnnotationOf: () => ... }) 

Le module sql-join va référencer les classes définies dans join.ts et joins.ts.

Joins va afficher la méthode pour ajouter une jointure à partir d'un chemin.de.propriété, donc parcourant une structure arborescente
de property.path développée dans la version php d'it.rocks. Là aussi les fonctions à utiliser pour parcourir cette arborescence
seront à fournir comme dépendances.
