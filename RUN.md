# DOCKER
cd C:/Users/yukta/ConnectEd
docker compose up

# BACKEND
cd C:/Users/yukta/ConnectEd/backend
venv\Scripts\activate
uvicorn app.main:app --host [IP_ADDRESS] --port 8000 --reload

# FRONTEND
cd C:/Users/yukta/ConnectEd/frontend
pnpm dev

# NGROK
ngrok http --url=homothetic-kourtney-supportlessly.ngrok-free.dev 8000
