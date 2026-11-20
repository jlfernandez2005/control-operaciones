.PHONY: install seed seed-full dev start test test-e2e docker-up docker-down docker-logs cert-init cert-renew backup migrate

install:
	npm install

seed:
	npm run db:seed

seed-full:
	npm run db:seed:full

dev:
	npm run dev

start:
	npm start

test:
	npm test

test-e2e:
	npm run test:e2e

docker-up:
	docker compose up -d --build

docker-down:
	docker compose down

docker-logs:
	docker compose logs -f app

cert-init:
	docker compose run --rm certbot certonly --webroot -w /var/www/certbot \
		-d $(DOMAIN) --email $(EMAIL) --agree-tos --no-eff-email

cert-renew:
	docker compose run --rm certbot renew

backup:
	@mkdir -p backups
	@docker compose exec -T app sh -c 'cp /app/data/control.db /app/data/control.db.bak'
	@docker compose cp app:/app/data/control.db backups/control-$$(date +%Y%m%d-%H%M%S).db
	@echo "Backup guardado en backups/"

migrate:
	npm run migrate:v2 -- --file $(FILE) --user $(USER) --pass $(PASS)