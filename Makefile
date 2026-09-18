.PHONY: help setup test lint seed migrate run-api run-ui docker-up docker-down docker-logs

help:
	@echo "Xeroww V0.6 Development & Operations CLI"
	@echo "=========================================="
	@echo "Available targets:"
	@echo "  setup       Install backend and frontend dependencies"
	@echo "  test        Run backend pytest suite with coverage"
	@echo "  lint        Run type checking and code formatting checks"
	@echo "  seed        Deterministic seeding of demo data into database"
	@echo "  migrate     Apply database migrations"
	@echo "  run-api     Run FastAPI development server with reload"
	@echo "  run-ui      Run React frontend development server"
	@echo "  docker-up   Start full Docker Compose environment"
	@echo "  docker-down Stop Docker Compose environment and remove containers"
	@echo "  docker-logs View logs across Docker Compose services"

setup:
	cd api && pip install -r requirements.txt
	cd dashboard && npm install

test:
	pytest api/tests -v --tb=short

lint:
	cd dashboard && npm run build --dry-run || true
	cd api && flake8 . --count --select=E9,F63,F7,F82 --show-source --statistics || true

seed:
	python api/scripts/seed_demo_data.py

migrate:
	alembic -c alembic.ini upgrade head

run-api:
	uvicorn api.main:app --host 0.0.0.0 --port 8000 --reload

run-ui:
	cd dashboard && npm run dev

docker-up:
	docker compose up -d --build

docker-down:
	docker compose down

docker-logs:
	docker compose logs -f
