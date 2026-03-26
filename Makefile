.PHONY: install typecheck build test test-db test-shared test-engine test-server test-crawler-domain test-crawler-engine test-crawler-generation release-version release-check migrate docker-local-up docker-local-down docker-local-build docker-prod-build docker-prod-config clean

install:
	npm install

typecheck:
	npm run typecheck

build:
	npm run build

test:
	npm run test:engine
	npm run test:crawler-engine
	npm run test:crawler-generation
	npm run test:crawler-domain
	npm run test:db
	npm run test:shared
	npm run test:server
	npm run typecheck
	npm run build

test-engine:
	npm run test:engine

test-crawler-domain:
	npm run test:crawler-domain

test-crawler-engine:
	npm run test:crawler-engine

test-crawler-generation:
	npm run test:crawler-generation

test-db:
	npm run test:db

test-shared:
	npm run test:shared

test-server:
	npm run test:server

release-version:
	node -p "require('./package.json').version"

release-check:
	npm run typecheck
	npm run test:engine
	npm run test:crawler-engine
	npm run test:crawler-generation
	npm run test:crawler-domain
	npm run test:db
	npm run test:shared
	npm run test:server
	npm run docker:prod:config
	npm run docker:prod:build

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
