# Repo test suite: validate every plugin manifest and hooks module the
# way Claude Code's loader will, so a plugin that would fail to load is
# caught here rather than in a session, then run the unit tests plugins
# ship alongside their hooks.

PLUGINS := $(sort $(patsubst %/.claude-plugin/plugin.json,%,$(wildcard plugins/*/.claude-plugin/plugin.json)))
UNIT_TESTS := $(sort $(wildcard plugins/*/tests/*.test.mjs))

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
	exit $$fail
