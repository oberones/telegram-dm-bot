.PHONY: install typecheck build test-engine migrate docker-local-up docker-local-down docker-local-build docker-prod-build docker-prod-config clean

install:
	npm install

typecheck:
	npm run typecheck

build:
	npm run build

test-engine:
	npm run test:engine

migrate:
	npm run migrate

docker-local-build:
	npm run docker:local:build

docker-local-up:
	npm run docker:local:up

docker-local-down:
	npm run docker:local:down

docker-prod-build:
	npm run docker:prod:build

docker-prod-config:
	npm run docker:prod:config

clean:
	rm -rf apps/*/dist packages/*/dist
