#!/bin/bash
# auto-ralph: Fast context detection script
# Outputs JSON with detected context for Ralph Loop prompt generation
#
# Usage: detect-context.sh [directory]
#   directory: Optional project directory (defaults to current directory)

set -e

# ============================================================================
# P0 FIX: Dependency check
# ============================================================================
check_dependencies() {
    local missing=""

    if ! command -v jq &>/dev/null; then
        missing="${missing}jq "
    fi

    if [[ -n "$missing" ]]; then
        cat >&2 <<EOF
(AUTONALYK) ERROR: Missing dependencies: ${missing}

To install on Ubuntu/Debian:
  sudo apt install jq

To install on macOS:
  brew install jq

To install on Windows (via chocolatey):
  choco install jq
EOF
        exit 1
    fi
}

# Run dependency check first
check_dependencies

# ============================================================================
# Settings reader (v2.0)
# ============================================================================
read_settings() {
    local settings_file="$HOME/.claude/auto-ralph.local.md"
    # Require a complete frontmatter block (at least two '---' lines);
    # otherwise the sed range would slurp the file to EOF.
    if [[ -f "$settings_file" ]] && \
       [[ "$(grep -c '^---$' "$settings_file" || true)" -ge 2 ]]; then
        sed -n '/^---$/,/^---$/p' "$settings_file" | grep -v '^---$' | grep -v '^#' || true
    fi
}

# Get a specific setting value (falls back to default when unset/invalid)
get_setting() {
    local key="$1"
    local default="$2"
    local value
    value=$(read_settings | grep "^${key}:" | head -1 | sed 's/^[^:]*: *//' | tr -d ' ' || true)
    echo "${value:-$default}"
}

# ============================================================================
# P2 FIX: Directory parameter
# ============================================================================
PROJECT_DIR="${1:-.}"
if [[ ! -d "$PROJECT_DIR" ]]; then
    echo "(AUTONALYK) ERROR: Directory not found: $PROJECT_DIR" >&2
    exit 1
fi
cd "$PROJECT_DIR" || exit 1

# ============================================================================
# Output JSON (with jq for proper escaping)
# ============================================================================
output_json() {
    local git_status="$1"
    local git_diff_files="$2"
    local recent_commits="$3"
    local test_status="$4"
    local error_logs="$5"
    local file_structure="$6"
    local docker_status="$7"

    jq -n \
        --arg git_status "$git_status" \
        --arg modified_files "$git_diff_files" \
        --arg recent_commits "$recent_commits" \
        --arg test_status "$test_status" \
        --arg errors "$error_logs" \
        --arg structure "$file_structure" \
        --arg docker "$docker_status" \
        --arg max_iterations "$(get_setting "max_iterations" "25")" \
        --arg score_threshold "$(get_setting "score_threshold" "3")" \
        --arg skip_explore_for_score "$(get_setting "skip_explore_for_score" "4")" \
        --arg auto_execute "$(get_setting "auto_execute" "false")" \
        --arg docker_analysis "$(get_setting "docker_analysis" "true")" \
        '{
          git: {
            status: $git_status,
            modified_files: $modified_files,
            recent_commits: $recent_commits
          },
          tests: { status: $test_status },
          errors: $errors,
          structure: $structure,
          docker: $docker,
          settings: {
            max_iterations: (($max_iterations | tonumber?) // 25),
            score_threshold: (($score_threshold | tonumber?) // 3),
            skip_explore_for_score: (($skip_explore_for_score | tonumber?) // 4),
            auto_execute: ($auto_execute == "true"),
            docker_analysis: ($docker_analysis != "false")
          }
        }'
}

# ============================================================================
# Git detection
# ============================================================================
detect_git() {
    if git rev-parse --is-inside-work-tree &>/dev/null; then
        git status --short 2>/dev/null || echo ""
    else
        echo "not a git repo"
    fi
}

detect_git_diff_files() {
    if git rev-parse --is-inside-work-tree &>/dev/null; then
        git diff --name-only HEAD 2>/dev/null | head -20 || echo ""
    else
        echo ""
    fi
}

detect_recent_commits() {
    if git rev-parse --is-inside-work-tree &>/dev/null; then
        git log --oneline -5 2>/dev/null || echo ""
    else
        echo ""
    fi
}

# ============================================================================
# Test framework detection
# ============================================================================
detect_tests() {
    local test_status=""

    # Node.js
    if [[ -f "package.json" ]]; then
        if grep -q '"test"' package.json 2>/dev/null; then
            test_status="npm test available; "
        fi
        # Check for specific test frameworks
        if grep -q '"jest"' package.json 2>/dev/null; then
            test_status="${test_status}jest; "
        fi
        if grep -q '"mocha"' package.json 2>/dev/null; then
            test_status="${test_status}mocha; "
        fi
        if grep -q '"vitest"' package.json 2>/dev/null; then
            test_status="${test_status}vitest; "
        fi
    fi

    # Python
    if [[ -f "pytest.ini" ]] || [[ -f "pyproject.toml" ]] || [[ -f "setup.py" ]]; then
        test_status="${test_status}pytest available; "
    fi
    if [[ -d "tests" ]] || [[ -d "test" ]]; then
        test_status="${test_status}tests/ directory found; "
    fi

    # Go
    if [[ -f "go.mod" ]]; then
        test_status="${test_status}go test available; "
    fi

    # Rust
    if [[ -f "Cargo.toml" ]]; then
        test_status="${test_status}cargo test available; "
    fi

    # PHP
    if [[ -f "phpunit.xml" ]] || [[ -f "phpunit.xml.dist" ]]; then
        test_status="${test_status}phpunit available; "
    fi

    echo "${test_status:-NO_TESTS_DETECTED}"
}

# ============================================================================
# Error detection (expanded)
# ============================================================================
detect_errors() {
    local errors=""

    # Node.js
    if [[ -f "npm-debug.log" ]]; then
        errors="${errors}=== npm-debug.log ===\n$(tail -30 npm-debug.log 2>/dev/null)\n\n"
    fi

    # Yarn
    if [[ -f "yarn-error.log" ]]; then
        errors="${errors}=== yarn-error.log ===\n$(tail -30 yarn-error.log 2>/dev/null)\n\n"
    fi

    # Python
    if [[ -f ".pytest_cache/lastfailed" ]]; then
        errors="${errors}=== pytest lastfailed ===\n$(cat .pytest_cache/lastfailed 2>/dev/null)\n\n"
    fi

    # Generic error logs
    for logfile in error.log errors.log app.log; do
        if [[ -f "$logfile" ]]; then
            errors="${errors}=== $logfile ===\n$(tail -30 "$logfile" 2>/dev/null)\n\n"
        fi
    done

    echo -e "${errors:-no recent errors detected}"
}

# ============================================================================
# P2 FIX: Docker detection
# ============================================================================
detect_docker() {
    local docker_status=""

    # Check for Docker files
    if [[ -f "docker-compose.yml" ]] || [[ -f "docker-compose.yaml" ]]; then
        docker_status="docker-compose found; "

        # Try to get running containers (bounded: docker can hang on a dead daemon)
        if command -v docker &>/dev/null; then
            local running
            running=$(timeout 3 docker ps --format "{{.Names}}" 2>/dev/null | head -5 | tr '\n' ', ' || true)
            if [[ -n "$running" ]]; then
                docker_status="${docker_status}running: ${running}; "
            fi

            # Try to get recent logs from compose services (limit output)
            if command -v docker-compose &>/dev/null; then
                local logs
                logs=$(timeout 3 docker-compose logs --tail=20 2>/dev/null | tail -30 || true)
                if [[ -n "$logs" ]]; then
                    docker_status="${docker_status}\n=== docker-compose logs (last 20) ===\n${logs}"
                fi
            fi
        fi
    fi

    if [[ -f "Dockerfile" ]]; then
        docker_status="${docker_status}Dockerfile found; "
    fi

    echo -e "${docker_status:-no docker detected}"
}

# ============================================================================
# File structure detection
# ============================================================================
detect_structure() {
    local structure=""

    structure=$(ls -la 2>/dev/null | head -25)

    if [[ -d "src" ]]; then
        structure="${structure}\n\nsrc/:\n$(ls src/ 2>/dev/null | head -15)"
    fi

    if [[ -d "lib" ]]; then
        structure="${structure}\n\nlib/:\n$(ls lib/ 2>/dev/null | head -15)"
    fi

    if [[ -d "app" ]]; then
        structure="${structure}\n\napp/:\n$(ls app/ 2>/dev/null | head -15)"
    fi

    echo -e "$structure"
}

# ============================================================================
# Main
# ============================================================================
main() {
    local git_status=$(detect_git)
    local git_diff_files=$(detect_git_diff_files)
    local recent_commits=$(detect_recent_commits)
    local test_status=$(detect_tests)
    local error_logs=$(detect_errors)
    local file_structure=$(detect_structure)
    local docker_status=$(detect_docker)

    output_json "$git_status" "$git_diff_files" "$recent_commits" "$test_status" "$error_logs" "$file_structure" "$docker_status"
}

main "$@"
