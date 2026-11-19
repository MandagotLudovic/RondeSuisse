# Ronde Suisse

Outil de gestion de tournoi de **draft Magic** en **rondes suisses**, matchs en **BO3**, avec un timer sur chaque étape.

## Installer sur Android

L'application est une PWA : une fois en ligne, elle s'installe depuis Chrome comme une vraie appli (icône sur l'écran d'accueil, plein écran, **fonctionne hors connexion**).

**1. Mise en ligne (une seule fois)** via GitHub Pages, gratuit :
GitHub → dépôt *RondeSuisse* → **Settings** → **Pages** → *Source* : **Deploy from a branch** → choisir la branche `ccr-4618e1f7-dh3ccx` et le dossier **/ (root)** → **Save**.
Après une minute environ, l'app est disponible à l'adresse :
**https://mandagotludovic.github.io/RondeSuisse/**

**2. Installation sur le téléphone** : ouvrir cette adresse dans **Chrome**, puis appuyer sur le bouton **📲 Installer** en haut de la page (ou menu ⋮ → **Installer l'application** / **Ajouter à l'écran d'accueil**).

Sur mobile, l'écran reste allumé pendant qu'un timer tourne, et le téléphone vibre et sonne à la fin du temps.

## Utilisation sur ordinateur

Ouvrir `index.html` dans un navigateur (double-clic), ou l'adresse GitHub Pages ci-dessus.

Le tournoi est **sauvegardé automatiquement** dans le navigateur : on peut fermer ou recharger la page sans rien perdre, même pendant qu'un timer tourne. Les boutons **Exporter / Importer** permettent de sauvegarder le tournoi dans un fichier `.json` ou de le reprendre sur un autre appareil.

## Déroulé

1. **Configuration** : nom du tournoi, liste des joueurs (un par ligne), durées par défaut de chaque étape.
2. **Draft** : timer.
3. **Placement à la table** : tirage aléatoire des places (bouton « Nouveau tirage ») et timer.
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
