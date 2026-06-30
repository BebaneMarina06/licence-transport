# Intégration Bamboo Pay — Licence Transport

Référence : **API_Bamboo_PAY-v9_TEST.pdf** (à la racine du dépôt).

## Flux utilisé : B — Paiement instantané

Sans redirection vers Bamboo Pay. Le client valide sur son téléphone (PIN Mobile Money), puis le marchand interroge le statut.

### 1. Initiation

`POST {BAMBOO_API_URL}/mobile/instant-payment`

| Paramètre | Type | Description |
|-----------|------|-------------|
| `phone` | string | Numéro du payeur (`07XXXXXXXX` pour Airtel, `241…` pour Moov) |
| `amount` | string | Montant |
| `payer_name` | string | Nom du payeur |
| `reference` | string | Référence marchand (`billing_id`) |
| `merchant_id` | string | Identifiant marchand |
| `callback_url` | string | Webhook marchand |
| `operateur` | string \| null | `airtel_money` ou `moov_money` |

**Auth** : Basic (username = identifiant marchand, password = mot de passe).

**Succès** — HTTP `202` :

```json
{
  "reference_bp": "TXN-2025-000381",
  "reference": "LT-...",
  "status": true,
  "message": null
}
```

**Échec métier** — HTTP `400` :

```json
{
  "reference_bp": "TXN-2025-000381",
  "reference": "LT-...",
  "status": false,
  "message": "Something went wrong"
}
```

### 2. Vérification du statut

`POST {BAMBOO_API_URL}/check-status/{transaction_id}` (repli `GET` si le serveur renvoie 405).

`transaction_id` = `billing_id` ou `reference_bp` (TXN-...).

**Succès** — HTTP `200` :

```json
{
  "message": "OK",
  "code": 200,
  "transaction": {
    "status": "completed",
    "code": 200,
    "message": "Statut completed"
  }
}
```

Statuts : `pending`, `completed`, `failed`.

### 3. Webhook (callback)

`POST {PUBLIC_API_URL}/api/payments/webhook/bamboo`

Corps JSON : `billingId`, `status`, `ref`, etc.

## URLs d'environnement

| Environnement | `BAMBOO_API_URL` |
|---------------|------------------|
| TEST (v9) | `https://devfront-bamboopay.ventis.group/api` |
| PROD v2 | `https://client-v2.bamboopay-ga.com/api` |

## Variables `.env`

```env
BAMBOO_API_URL=https://devfront-bamboopay.ventis.group/api
BAMBOO_USERNAME=
BAMBOO_PASSWORD=
BAMBOO_MERCHANT_ID=
BAMBOO_WEBHOOK_URL=http://127.0.0.1:8010/api/payments/webhook/bamboo
BAMBOO_DEBUG=true
```

## Code applicatif

| Fichier | Rôle |
|---------|------|
| `services/api/app/services/api_bamboo_pay.py` | Client HTTP v9 |
| `services/api/app/services/bamboo_payment.py` | Orchestration + base |
| `services/api/app/api/v1/endpoints/payments.py` | Routes API |

## Endpoints portail

| Méthode | Route |
|---------|-------|
| POST | `/api/v1/applications/{id}/pay` |
| GET | `/api/v1/applications/{id}/payment-status` |
| POST | `/api/payments/webhook/bamboo` |
