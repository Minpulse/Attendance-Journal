PORT = 3000
URL = http://localhost:$(PORT)

install:
	@npm install

run:
	@echo "Открытие электронного журнала"
	@node server/server.js

open:
	@sleep 1 && (xdg-open $(URL) || open $(URL) || cmd.exe /c start $(URL))

start:
	@make -j 2 run open
