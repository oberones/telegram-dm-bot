.PHONY: install typecheck build test test-engine test-server migrate docker-local-up docker-local-down docker-local-build docker-prod-build docker-prod-config clean

install:
	npm install

typecheck:
	npm run typecheck

build:
	npm run build

test:
	npm run test:engine
	npm run test:server
	npm run typecheck
	npm run build

test-engine:
	npm run test:engine

test-server:
	npm run test:server

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
