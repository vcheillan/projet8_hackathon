# ⛏️ MineWatch : Outil de veille concurrentielle minière européenne

**Démo en ligne : [vcheillan.github.io/projet8_hackathon](https://vcheillan.github.io/projet8_hackathon/)**

Outil de surveillance des titres miniers et projets d'extraction en Europe, développé dans le cadre du hackathon Mines Paris – PSL (juillet 2026) pour **Métaux pour l'avenir**, startup française d'exploration minière.

![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-5-646CFF?logo=vite&logoColor=white)
![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL-3FCF8E?logo=supabase&logoColor=white)
![Leaflet](https://img.shields.io/badge/Leaflet-Maps-199900?logo=leaflet&logoColor=white)
![Deploy](https://img.shields.io/badge/Deploy-GitHub%20Pages-222?logo=github&logoColor=white)

---

## 🎯 Le problème

Le **Critical Raw Materials Act** (CRM Act, mai 2024) redige par la Comission Europeene fixe des objectifs ambitieux à l'UE pour 2030 : 
- au moins 10 % de la consommation de matières premières critiques extraite sur le sol européen
- 40 % transformée en Europe
- 25 % issue du recyclage
- pas plus de 65% en provenance d’un seul pays tiers<br>
Pour les acteurs de l'exploration minière, connaître en permanence l'état des projets concurrents qui demande quel permis, où, sur quelle substance est un enjeu stratégique.

Or cette information est **éclatée entre des dizaines de sources nationales hétérogènes** : API moderne en France (Camino), CSV quotidiens en Norvège, Shapefiles en Finlande, services ArcGIS en Espagne... Aucun outil ne centralise cette veille à l'échelle européenne.

## 💡 La solution

MineWatch agrège les registres miniers officiels de **pays européens** dans une base unique, interrogeable via une carte interactive avec :

- 🗺️ **Carte interactive** de tous les titres miniers avec statut administratif (mine active, demande initiale, valide, en modification, survie provisoire)
- 🔍 **Recherche et filtres** par nom, substance, commune, statut
- 📋 **Fiche détaillée** par titre : titulaire, surface, type de titre, région, source officielle
- 🛰️ **Imagerie satellite Sentinel-2** historique (2018-2025) pour observer l'évolution physique de chaque site
- 📤 **Export CSV** des résultats filtrés
- ➕ **Ajout manuel** de sites via formulaire

## 🌍 Sources de données intégrées

| Pays | Autorité | Type de source |
|---|---|---|
| 🇫🇷 France | Camino (Ministère de la Transition écologique) | API REST JSON |
| 🇳🇴 Norvège | DMF (Direktoratet for mineralforvaltning) | CSV quotidien |
| 🇫🇮 Finlande | GTK (Geological Survey of Finland) | ArcGIS REST |
| 🇸🇪 Suède | SGU / Bergsstaten | Services cartographiques |
| 🇪🇸 Espagne | IGME (Instituto Geológico y Minero) | ArcGIS REST |
| 🇨🇿 Tchéquie | CGS (Czech Geological Survey) | Services cartographiques |
| 🇳🇱 Pays-Bas | NLOG (TNO Geological Survey) | ArcGIS REST |
| 🇦🇹 Autriche | GeoSphere Austria | Services cartographiques |
| 🇵🇱 Pologne | PIG-PIB (MIDAS) | ArcGIS REST |
| 🇨🇭 Suisse | Swisstopo | API géo fédérale |
| 🛰️ — | Copernicus Data Space (Sentinel-2 L2A) | OGC WMS |

Toutes les sources sont **officielles, publiques et sous licence ouverte** (Etalab, NLOD, CC-BY ou équivalent).

## 🏗️ Architecture

```
┌────────────────────────────────────────────────────┐
│  Sources officielles (10 pays)                     │
│  Camino · DMF · GTK · SGU · IGME · CGS · NLOG ···  │
└───────────────────┬────────────────────────────────┘
                    │  syncMines.js (normalisation
                    │  + traduction substances FR)
                    ▼
┌────────────────────────────────────────────────────┐
│  Supabase (PostgreSQL)                             │
│  Table `mines` — schéma unifié multi-pays          │
│  Row Level Security · lecture publique             │
└───────────────────┬────────────────────────────────┘
                    │  SELECT temps réel
                    ▼
┌────────────────────────────────────────────────────┐
│  Frontend React (statique, GitHub Pages)           │
│  Leaflet · filtres · export · Sentinel-2           │
└────────────────────────────────────────────────────┘
```

**Choix d'architecture** : L'architecture est simple : frontend découplé + API de données + jobs de collecte. Le frontend est un site statique servi par CDN (GitHub Pages), les données sont servies en temps réel par Supabase, et la synchronisation des sources est un processus séparé.

Chaque source pays est un module indépendant (`src/services/<source>Api.js`) qui normalise les données vers un schéma commun : identifiant préfixé par source, substances traduites en français, statuts administratifs harmonisés, coordonnées WGS84.

## 🚀 Installation et développement

### Prérequis

- Node.js version 18 ou plus
- Un projet [Supabase](https://supabase.com) (gratuit)

### Lancer en local

```bash
git clone https://github.com/vcheillan/projet8_hackathon.git
cd projet8_hackathon/mining-watch
npm install
```

Créer un fichier `.env.local` :

```
VITE_SUPABASE_URL=https://<votre-projet>.supabase.co
VITE_SUPABASE_ANON_KEY=<votre-clé-anon>
```

Puis :

```bash
npm run dev
```

L'app tourne sur `http://localhost:5173`. Le proxy Vite (configuré dans `vite.config.js`) gère les appels CORS vers les APIs sources **en développement uniquement**.

### Synchroniser les données

Depuis l'app en local, le bouton de synchronisation (🔄) déclenche `syncFromApis()` qui interroge les 10 sources, normalise les résultats et les upsert dans Supabase. Compter 1-2 minutes pour une sync complète.

### Base de données

Table `mines` dans Supabase avec policy RLS de lecture publique :

```sql
CREATE POLICY "Read mines publicly"
ON mines FOR SELECT
TO anon
USING (true);
```

## 📦 Déploiement

Le déploiement est **automatisé via GitHub Actions** (`.github/workflows/deploy.yml`) : chaque push sur `main` reconstruit l'app et la publie sur GitHub Pages.

Configuration requise (une seule fois) :
1. Secrets du repo : `VITE_SUPABASE_URL` et `VITE_SUPABASE_ANON_KEY`
2. Settings → Pages → Source : « GitHub Actions »
3. `base` configuré dans `vite.config.js` (sous-chemin GitHub Pages)

## ⚠️ Limites connues et pistes d'évolution

- **Synchronisation manuelle** : la collecte des sources est déclenchée depuis un poste de développement. En production, elle serait automatisée quotidiennement via une Supabase Edge Function avec cron trigger — sans modification du frontend.
- **Couverture partielle** : l'Allemagne (registres par Länder, non centralisés) et l'Italie (registres régionaux) ne disposent pas de source nationale exploitable. Le Portugal (SIORMINP) et l'Irlande (GSI) sont les prochains candidats.
- **Historique des évolutions** : l'outil affiche l'état courant des titres. Un suivi des transitions (nouvelle demande, changement de statut) avec alertes email est la prochaine étape naturelle, la structure `sync_log` existe déjà en base.
- **Détection satellite** : l'imagerie Sentinel-2 est affichée mais non analysée. Un traitement automatique (détection de changement d'emprise) permettrait de repérer les débuts de travaux réels.

## 👥 Équipe : BONNA Baptiste, CHEILLAN Valentin DAVION-JOUFFRE Josselin, PAYSANT Raphaël, RICHARD Jules

Projet réalisé en 5 jours dans le cadre du hackathon d'informatique de Mines Paris – PSL, sujet n°8 « Outil de veille concurrentielle pour l'industrie minière en Europe » proposé par **Métaux pour l'avenir** (G. Alexandre & Maxime Porlier).

## 📄 Licence et données

Les données agrégées proviennent de sources publiques officielles sous licences ouvertes, chaque fiche mine référence sa source d'origine
