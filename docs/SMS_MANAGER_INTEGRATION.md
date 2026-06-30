# Intégration SMS Manager — Partenaires externes

Référence : **API_SMS_Manager_Partenaires (2).docx** (racine du dépôt) / `documentation_sms_manager.pdf`

**Production :** `https://sms-manager.ventis.group`  
**Version API :** 1.1

## Configuration (`services/api/.env`)

```env
SMS_MANAGER_URL=https://sms-manager.ventis.group
SMS_API_KEY=<VOTRE_CLE_SMS_MANAGER>
SMS_SENDER_ID=VENTIS
SMS_ENABLED=true
```

- `SMS_API_KEY` : clé partenaire SMS Manager (format documenté par Ventis, en-tête `X-API-Key`)
- `SMS_SENDER_ID` : expéditeur **obligatoire**, actif et attribué au partenaire dans SMS Manager

## Endpoint utilisé

`POST https://sms-manager.ventis.group/api/v1/sms`

```json
{
  "destinationAddress": "24177861364",
  "message": "Votre message",
  "senderId": "VENTIS",
  "isOTP": false
}
```

Numéros Gabon : `241` + 8 chiffres (ex. `077861364` → `24177861364`).

## Envoi dans l'application

Le numéro est lu sur le **compte citoyen** (`User.phone`, renseigné à l'inscription ou à la connexion).

| Événement | SMS |
|-----------|-----|
| Dossier approuvé → paiement | Oui |
| Paiement Mobile Money reçu | Oui |
| Licence délivrée (confirmation backoffice) | Oui (+ e-mail PDF) |

Les échecs SMS sont journalisés mais **ne bloquent pas** la délivrance de licence.

## Réseau

Les APIs d'envoi de messages sont **externes** : aucune connexion VPN n'est requise.

| Canal | Accès |
|-------|--------|
| SMS Manager | `https://sms-manager.ventis.group` (HTTPS public) |
| E-mail (licence PDF) | Relais SMTP Gmail via **IP + port** (`MAIL_HOST` / `MAIL_PORT`), **sans authentification** (`MAIL_USE_AUTH=false`) |

## Fichiers

- `app/services/api_sms_manager.py` — client HTTP
- `app/services/sms.py` — envoi vers le demandeur
- `app/services/notifications.py` — SMS aux changements de statut
- `app/services/payment.py` — SMS à la délivrance de licence

## Test rapide

```bash
curl -X POST "https://sms-manager.ventis.group/api/v1/sms" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: <VOTRE_CLE_SMS_MANAGER>" \
  -d '{
    "destinationAddress": "24177861364",
    "message": "Test DGTT licence transport",
    "senderId": "VENTIS",
    "isOTP": false
  }'
```

Réponse attendue : HTTP `201` avec `status: "sent"`.
