# Just Us — Two-person chat app

This repo contains a starter skeleton for a private two-person chat app using React (frontend), Spring Boot (backend), and MongoDB.

Folders:
- `backend` — Spring Boot app
- `frontend` — React app

How to run
1. Start MongoDB and ensure it's reachable at `mongodb://localhost:27017`.
2. Backend: `mvn spring-boot:run` inside `backend`.
3. Frontend: `npm install` then `npm start` inside `frontend`.

Next steps
- Add authentication, only allow two users.
- Add media upload endpoints (GridFS) and client upload UI.
