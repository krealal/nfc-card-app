install:
	yarn install --frozen-lockfile

build-GetEntryFunction:
	yarn install --frozen-lockfile
	yarn build
	mkdir -p .aws-sam/build/GetEntryFunction
	cp -R node_modules dist .aws-sam/build/GetEntryFunction/

build-PutAdminUserFunction:
	yarn install --frozen-lockfile
	yarn build
	mkdir -p .aws-sam/build/PutAdminUserFunction
	cp -R node_modules dist .aws-sam/build/PutAdminUserFunction/

build-PostAdminMessageFunction:
	yarn install --frozen-lockfile
	yarn build
	mkdir -p .aws-sam/build/PostAdminMessageFunction
	cp -R node_modules dist .aws-sam/build/PostAdminMessageFunction/

build:
	yarn install --frozen-lockfile
	yarn build

