# Order Management System — Frontend

React 18 + Vite single-page application for the Order Management System.

## Tech Stack

- React 18, React Router v6
- Axios (with automatic token refresh interceptor)
- Tailwind CSS
- Vite

## Development

```bash
npm install
VITE_API_URL=http://localhost:8000 npm run dev
```

App runs at http://localhost:5173 by default.

## Environment Variables

| Variable       | Description                     |
|----------------|---------------------------------|
| `VITE_API_URL` | Base URL of the backend API     |

## Build

```bash
VITE_API_URL=https://your-api.com npm run build
# Output is in dist/
```

## Docker

Built as part of the root `docker-compose.yml`. The `VITE_API_URL` build arg is passed in at image build time.

```bash
docker build --build-arg VITE_API_URL=http://localhost:8000 -t order-mgmt-frontend .
```

## Live Demo

https://order-management-black.vercel.app/
