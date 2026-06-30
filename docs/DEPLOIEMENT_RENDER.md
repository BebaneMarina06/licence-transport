# Déploiement sur Render — Plateforme Licence de Transport

Ce guide déploie l'ensemble de la plateforme sur [Render](https://render.com) :

| Composant | Type Render | Description |
|-----------|-------------|-------------|
| `licence-transport-db` | PostgreSQL | Base de données managée |
| `licence-transport-api` | Web Service (Docker) | API FastAPI + disque pour les fichiers |
| `licence-transport-portail` | Static Site | Portail citoyen **et** backoffice admin (`/admin`) |

> Le tout est décrit dans le fichier [`render.yaml`](../render.yaml) (Blueprint Render).

---

## Prérequis

1. Un compte Render (https://dashboard.render.com).
2. Le dépôt poussé sur GitHub (déjà fait : `BebaneMarina06/licence-transport`).
3. Connecter GitHub à Render (autorisation du dépôt).

---

## Étape 1 — Créer le Blueprint

1. Sur le dashboard Render : **New → Blueprint**.
2. Sélectionner le dépôt `licence-transport`.
3. Render lit `render.yaml` et propose de créer les 3 ressources.
4. Cliquer **Apply**. Render crée la base, l'API et le site.

Au premier déploiement, Render demande les variables marquées `sync: false`
(secrets et URLs). On peut laisser les paiements/SMS/mail désactivés au début et
les renseigner plus tard.

---

## Étape 2 — Renseigner les URLs croisées

L'API et le portail ont besoin de connaître leurs URLs respectives. Une fois les
services créés, Render attribue des URLs du type :

- API : `https://licence-transport-api.onrender.com`
- Portail : `https://licence-transport-portail.onrender.com`

### Sur le service API (`licence-transport-api` → Environment)

| Variable | Valeur |
|----------|--------|
| `PUBLIC_API_URL` | `https://licence-transport-api.onrender.com` |
| `FRONTEND_URL` | `https://licence-transport-portail.onrender.com` |
| `CORS_ORIGINS` | `https://licence-transport-portail.onrender.com` |

### Sur le site portail (`licence-transport-portail` → Environment)

| Variable | Valeur |
|----------|--------|
| `VITE_API_URL` | `https://licence-transport-api.onrender.com` |

> Après modification de `VITE_API_URL`, relancer un **Manual Deploy** du portail
> (la variable est injectée au moment du build Vite).

---

## Étape 3 — Vérifier le démarrage

- API : ouvrir `https://licence-transport-api.onrender.com/health`
  → doit répondre `{"status":"ok","service":"Licence Transport Gabon"}`.
- Au premier démarrage, l'API crée les tables et insère les données de base
  (types de licences, comptes staff de démonstration via `app/seed.py`).
- Portail : ouvrir `https://licence-transport-portail.onrender.com`.

---

## Étape 4 — Activer paiement / e-mail / SMS (optionnel)

Renseigner sur l'API les variables correspondantes puis redéployer :

**BambooPay**
```
BAMBOO_USERNAME, BAMBOO_PASSWORD, BAMBOO_MERCHANT_ID
BAMBOO_RETURN_URL  = https://licence-transport-portail.onrender.com/payment/result
BAMBOO_WEBHOOK_URL = https://licence-transport-api.onrender.com/api/payments/webhook/bamboo
```

**E-mail** : passer `MAIL_ENABLED=true` et renseigner `MAIL_HOST`, `MAIL_FROM_ADDRESS`.
⚠️ Le relais SMTP interne Ventis (IP privée, port 25) n'est **pas** joignable depuis
Render. Pour la production sur Render, utiliser un fournisseur public (SendGrid,
Mailgun, Gmail authentifié…) avec `MAIL_USE_AUTH=true`.

**SMS** : passer `SMS_ENABLED=true` et renseigner `SMS_API_KEY`, `SMS_SENDER_ID`.

---

## Points d'attention

### Fichiers uploadés (documents + licences PDF)
L'API stocke les fichiers sur un **disque persistant** monté sur `/app/uploads`
(défini dans `render.yaml`). Le disque nécessite au minimum le plan **Starter**
de l'API. Sans disque (plan gratuit), les fichiers sont perdus à chaque redéploiement.

### Base de données gratuite
Le plan PostgreSQL `free` expire après 90 jours. Pour la production, passer la base
en plan payant (`basic` ou supérieur) dans `render.yaml` ou via le dashboard.

### Veille (plans gratuits)
Un Web Service gratuit s'endort après 15 min d'inactivité ; la première requête
suivante prend ~30 s (cold start). Le plan Starter reste actif en permanence.

### Migrations
Le schéma est créé/mis à jour automatiquement au démarrage de l'API
(`create_all` + `upgrade_schema` dans `app/main.py`). Aucune commande Alembic
manuelle n'est nécessaire.

---

## Mise à jour de l'application

Avec `autoDeploy: true`, chaque `git push` sur `main` redéclenche automatiquement
le build de l'API et du portail. Pour forcer un déploiement : **Manual Deploy →
Deploy latest commit** sur le service concerné.
