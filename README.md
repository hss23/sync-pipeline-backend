# Sync Pipeline Backend

This project is a small backend service built with Node.js and Express to collect and store records from different sources like HubSpot, Google Calendar, and payments. It helps bring data from multiple places into one simple local pipeline so it can be synced, viewed, and tested easily.

## Tech Stack

- Node.js
- Express.js
- dotenv
- Node.js test runner

## Run Locally

```bash
npm install
npm run dev
```

The server starts on port 3000 by default.

## Main Endpoints

- GET /health — checks if the service is running
- POST /sync — starts a sync process
- GET /records — view stored records
- POST /webhook/:source — receive webhook data from a source
- GET /admin/status — check sync status

## Env Vars

```env
PORT=3000
SYNC_DATA_DIR=data
HUBSPOT_ACCESS_TOKEN=
GOOGLE_CALENDAR_CLIENT_ID=
GOOGLE_CALENDAR_CLIENT_SECRET=
GOOGLE_CALENDAR_ACCESS_TOKEN=
GOOGLE_CALENDAR_REFRESH_TOKEN=
```

These values are optional for basic local testing, because the app can also run with sample data when credentials are not available.

## Sources

- HubSpot contacts
- Google Calendar events
- Payments records

## References

- HubSpot API: https://developers.hubspot.com/docs/api/crm/contacts
- Google Calendar API: https://developers.google.com/calendar
- Postman collection: postman/Sync Pipeline Backend API.postman_collection.json

## AI Usage

- Copilot: For generating test cases and testing the apis
- ChatGpt For Calendar Api Integration: https://chatgpt.com/share/6a6acaee-810c-83e8-a4d4-8b7a9285d39d
