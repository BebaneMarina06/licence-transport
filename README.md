# Digitalisation des Licences de Transport — Gabon

Plateforme de dématérialisation des licences de transport pour la DGTT (Direction Générale des Transports Terrestres).

## Architecture

| Composant | Technologie | Port |
|-----------|-------------|------|
| Portail citoyen + backoffice agents | React + Vite + TypeScript | 5173 |
| Backoffice standalone (redirige vers portail) | React + Vite + TypeScript | 5174 |
| API | FastAPI + PostgreSQL | **8010** |

## Démarrage rapide

### 1. Infrastructure (PostgreSQL + Redis)

```bash
cp .env.example .env
docker compose up -d postgres redis
```

### 2. API Backend

```bash
# Option simple (Windows)
scripts\dev-api.bat

# Ou manuellement :
cd services/api
.venv\Scripts\activate
uvicorn app.main:app --reload --port 8010 --host 127.0.0.1
```

> **Port 8010** : port dédié à ce projet. Ne pas utiliser 8000 (autre API Ventis sur cette machine).

Vérification : http://127.0.0.1:8010/health doit afficher `"service":"Licence Transport Gabon"`.

L'API crée automatiquement les tables et insère les données initiales (types de licences + compte admin).

**Compte admin par défaut :**
- Email : `admin@dgtt.ga`
- Mot de passe : `Admin@2026!`

Documentation API : http://127.0.0.1:8010/docs

### 3. Portail citoyen

```bash
# Option simple (Windows)
scripts\dev-portal.bat

# Ou manuellement :
cd apps/portal-citoyen
npm install
npm run dev
```

> **Important :** ne pas définir `VITE_API_URL` en dev — le proxy Vite redirige `/api` vers `127.0.0.1:8010`.

→ http://localhost:5173

### 4. Backoffice (intégré au portail)

Le backoffice est accessible **depuis le portail citoyen** après connexion avec un compte agent DGTT :

- URL : http://localhost:5173/admin
- Compte test : `admin@dgtt.ga` / `Admin@2026!`
- Connexion unique : http://localhost:5173/connexion

> L'app `apps/backoffice` (port 5174) redirige automatiquement vers le portail.

### Ancien backoffice standalone (optionnel)

```bash
cd apps/backoffice
npm run dev
```

→ redirige vers le portail citoyen

## Fonctionnalités (Phase 0 + 1)

### Portail citoyen
- Page d'accueil avec types de licences
- Inscription / connexion
- Espace personnel (liste des dossiers)
- Création de demande de licence
- **Upload des 3 justificatifs** (carte grise, visite technique, assurance)
- Soumission du dossier (bloquée si pièces manquantes)
- Suivi avec historique des statuts

### Backoffice
- Connexion réservée au personnel (agent, superviseur, admin)
- Tableau de bord avec KPIs
- File d'instruction des dossiers
- Traitement : prise en charge, complément, approbation, rejet, paiement, délivrance
- **Génération PDF licence avec QR code** à la délivrance

### API
- Auth JWT (access + refresh tokens)
- RBAC par rôles
- Workflow de dossier avec transitions contrôlées
- Journal d'audit
- 5 types de licences officiels (source gouvernementale)

## Types de licences

Référence officielle : [Licence de transport — infrastructures.gouv.ga](https://infrastructures.gouv.ga/18-transport/20-documents-administratifs/329-licence-de-transport/)

| Code | Type | Tarif | Justificatifs |
|------|------|-------|---------------|
| AST | Autorisation Spéciale de Transport | 50 000 F CFA | Carte grise, Visite technique, Assurance |
| MIXTE | Licence Mixte | 200 000 F CFA | Carte grise, Visite technique, Assurance |
| VOYAGEURS | Licence transports voyageurs | 150 000 F CFA | Carte grise, Visite technique, Assurance |
| MARCHANDISES | Licence transports marchandises | 300 000 F CFA* | Carte grise, Visite technique, Assurance |
| EXCEPTIONNELLE | Licence Exceptionnelle | 400 000 F CFA | Carte grise, Visite technique, Assurance |

\* Tarif marchandises variable selon le tonnage (source officielle).  
\* Voyageurs : tarif indiqué pour véhicules de moins de 18 places.

## Workflow dossier

```
Brouillon → Soumis → En instruction → Approuvé → Attente paiement → Payé → Délivré
                ↓           ↓
             Rejeté    Complément demandé
```

## Vérification QR code

Lors de la délivrance, un PDF est généré avec un **QR code** pointant vers :

`GET /api/v1/verify/{numero_licence}?sig={signature}`

Réponse JSON : validité, titulaire, type, dates d'expiration.

Variable d'environnement : `PUBLIC_API_URL` (URL encodée dans le QR, ex. `http://127.0.0.1:8010`).

## Documentation

- **Expression de besoin** : `docs/Expression_de_besoin_Licence_Transport_Gabon.docx`
- Régénérer le document : `services\api\.venv\Scripts\python scripts\generate_expression_besoin.py`

## Prochaines étapes

- ~~Upload de pièces justificatives~~ (réalisé)
- ~~Paiement Mobile Money (Airtel / Orange / Moov)~~ — BambooPay instantané intégré
- ~~Génération PDF licence avec QR code~~ (réalisé)
- Notifications SMS / email
- Intégration Gabon Connect / SSO national
