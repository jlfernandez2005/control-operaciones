.PHONY: install seed start dev test test-e2e docker-up docker-down backup
install:
	npm install
seed:
	npm run db:seed
start:
	npm start
dev:
	npm run dev
test:
	npm test
test-e2e:
	npm run test:e2e
docker-up:
	docker compose up -d --build
docker-down:
	docker compose down
backup:
	bash scripts/backup.sh
