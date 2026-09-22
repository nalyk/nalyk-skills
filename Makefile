# Repo test suite: validate every plugin manifest and hooks module the
# way Claude Code's loader will, so a plugin that would fail to load is
# caught here rather than in a session, then run the unit tests plugins
# ship alongside their hooks, and the engine tests (`*.test.ts`, run by
# `claude plugin test` against the real engine rather than a fake).
#
# tests/proctor-configured is Proctor loaded with every userConfig option
# set away from its default. The engine refuses a hooks module or test
# import from outside a plugin's folder, symlinks included, so the module
# and the test world are copied in fresh and compared byte for byte.

PLUGINS := $(sort $(patsubst %/.claude-plugin/plugin.json,%,$(wildcard plugins/*/.claude-plugin/plugin.json)))
UNIT_TESTS := $(sort $(wildcard plugins/*/tests/*.test.mjs))
ENGINE_PLUGINS := $(sort $(patsubst %/tests/engine/,%,$(dir $(wildcard plugins/*/tests/engine/*.test.ts))))

.PHONY: test
test:
	@fail=0; \
	for p in $(PLUGINS); do \
		if claude plugin validate "$$p" >/dev/null 2>&1; then \
			echo "ok    $$p"; \
		else \
			echo "FAIL  $$p"; \
			claude plugin validate "$$p" 2>&1 | sed -n 's/^/        /p'; \
			fail=1; \
		fi; \
	done; \
	for t in $(UNIT_TESTS); do \
		if node "$$t"; then \
			echo "ok    $$t"; \
		else \
			echo "FAIL  $$t"; \
			fail=1; \
		fi; \
	done; \
	for p in $(ENGINE_PLUGINS); do \
		if claude plugin test "$$p" > "$$p/tests/engine/.last-run.log" 2>&1; then \
			echo "ok    $$p (engine: $$(grep -oE '^ *[0-9]+ pass' "$$p/tests/engine/.last-run.log" | tr -s ' ' | sed 's/^ //'))"; \
		else \
			echo "FAIL  $$p (engine)"; \
			grep -E '^\(fail\)|Error|Expected|Received' "$$p/tests/engine/.last-run.log" | sed 's/^/        /'; \
			fail=1; \
		fi; \
	done; \
	cfg=tests/proctor-configured; \
	cp plugins/proctor/hooks/proctor.tsx $$cfg/hooks/proctor.tsx; \
	cp plugins/proctor/tests/engine/world.ts $$cfg/engine/world.ts; \
	if ! cmp -s plugins/proctor/hooks/proctor.tsx $$cfg/hooks/proctor.tsx; then \
		echo "FAIL  $$cfg (stale copy of proctor.tsx)"; fail=1; \
	elif claude plugin test $$cfg > $$cfg/engine/.last-run.log 2>&1; then \
		echo "ok    $$cfg (engine: $$(grep -oE '^ *[0-9]+ pass' $$cfg/engine/.last-run.log | tr -s ' ' | sed 's/^ //'))"; \
	else \
		echo "FAIL  $$cfg (engine)"; \
		grep -E '^\(fail\)|Error|Expected|Received' $$cfg/engine/.last-run.log | sed 's/^/        /'; \
		fail=1; \
	fi; \
	exit $$fail
