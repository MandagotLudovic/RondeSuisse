# Ronde Suisse

Outil de gestion de tournoi de **draft Magic** en **rondes suisses**, matchs en **BO3**, avec un timer sur chaque étape.

## Installer sur Android

L'application est en ligne à l'adresse **https://rondesuisse.netlify.app/**

C'est une PWA : elle s'installe depuis Chrome comme une vraie appli (icône sur l'écran d'accueil, plein écran, **fonctionne hors connexion**). Ouvrir l'adresse dans **Chrome**, puis appuyer sur le bouton **📲 Installer** en haut de la page (ou menu ⋮ → **Installer l'application**).

Sur mobile, l'écran reste allumé pendant qu'un timer tourne, et le téléphone vibre et sonne à la fin du temps.

### Mettre à jour le site

Le dépôt GitHub est relié à Netlify : chaque nouveau commit poussé sur la branche publiée est mis en ligne automatiquement. L'appli installée se met à jour à la prochaine ouverture avec du réseau.

## Utilisation sur ordinateur

Ouvrir `index.html` dans un navigateur (double-clic), ou l'adresse en ligne ci-dessus.

Le tournoi est **sauvegardé automatiquement** dans le navigateur : on peut fermer ou recharger la page sans rien perdre, même pendant qu'un timer tourne. Les boutons **Exporter / Importer** permettent de sauvegarder le tournoi dans un fichier `.json` ou de le reprendre sur un autre appareil.

## Déroulé

1. **Configuration** : nom du tournoi, liste des joueurs (un par ligne), durées par défaut de chaque étape.
2. **Placement à la table** : tirage aléatoire des places (bouton « Nouveau tirage ») et timer.
3. **Draft** : timer.
4. **Construction de deck** : timer.
5. **Rondes 1, 2, 3** : appariements, timer de ronde, saisie des scores BO3.
6. **Classement** affiché après chaque ronde.
7. Après la ronde 3 : **ajouter une ronde supplémentaire** (autant que nécessaire) ou **terminer le tournoi**.
8. **Résultats finaux** : podium, classement et historique des rondes.

### Timer

- Durée modifiable à chaque étape (champ « Durée »), en plus des valeurs par défaut.
- Démarrer / Pause / Reprendre / Réinitialiser, ajustement −5 / −1 / +1 / +5 min en cours de route.
- Passe à l'orange à 5 min de la fin, au rouge avec un signal sonore à 0, puis affiche le temps dépassé.
- Mode plein écran.

## Règles appliquées

- **Ronde 1** : appariement aléatoire.
- **Rondes suivantes** : les joueurs à égalité de points s'affrontent (ordre aléatoire au sein d'un même total), **sans revanche** tant que c'est possible.
- **Nombre impair** : le joueur le moins bien classé n'ayant pas encore eu de bye reçoit un **bye** (= victoire 2-0).
- **Points** : victoire 3, nul 1, défaite 0. Scores possibles : 2-0, 2-1, 1-0, 1-1, 0-0 (nul / ID), 0-1, 1-2, 0-2.
- **Départages** (ordre officiel Magic) : points, **OMW %**, **GW %**, **OGW %**, avec un plancher de 33 % pour les pourcentages.
- **Abandon** : depuis le classement, un joueur peut être retiré des prochains appariements (il reste dans le classement) puis réintégré si besoin.
- Les résultats de la dernière ronde restent modifiables depuis le classement, et les appariements d'une ronde peuvent être annulés.

## Structure

```
index.html            page principale
css/style.css         styles (thème clair / sombre, mobile)
js/swiss.js           appariements, points, départages
js/timer.js           timer
js/state.js           données du tournoi et sauvegarde
js/app.js             écrans et navigation
js/pwa.js             installation (PWA)
sw.js                 service worker (hors connexion)
manifest.webmanifest  nom, icônes et couleurs de l'appli installée
icons/                icônes
tests/swiss.test.js   tests de la logique suisse
```

## Tests

```
node --test tests/*.test.js
```
