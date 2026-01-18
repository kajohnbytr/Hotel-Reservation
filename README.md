# Collab Web App

This is a React + Vite frontend. There is no backend in this repo; all data is mocked and stored in the browser (localStorage).

## Frontend (run locally)

Prerequisites:
- Node.js 18+ and npm

Install and start:
```
npm install
npm run dev
```

Open:
- http://localhost:5173

Build for production:
```
npm run build
npm run preview
```

## Backend

There is no backend service in this project. Bookings and auth are stored in localStorage:
- `aurora_user`
- `aurora_bookings`

## Credentials

No real credentials are required.
- Sign up with any name/email.
- Login is simulated and stored locally.

If you want real authentication or a server API, you’ll need to add a backend.
