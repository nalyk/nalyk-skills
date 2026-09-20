# Repo test suite: validate every plugin manifest and hooks module the
# way Claude Code's loader will, so a plugin that would fail to load is
# caught here rather than in a session.

PLUGINS := $(sort $(patsubst %/.claude-plugin/plugin.json,%,$(wildcard plugins/*/.claude-plugin/plugin.json)))

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
	exit $$fail
