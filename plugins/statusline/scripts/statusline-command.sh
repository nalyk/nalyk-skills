#!/bin/bash
# Powerline statusline for Claude Code. Reads session JSON on stdin.
# Budget: <=5 external forks per render (1 jq + 2 git).

input=$(cat)

# Powerline glyphs via escapes (editor-safe; literal glyphs got lost before)
PL_R=$'\ue0b0'   # solid right arrow
PL_RS=$'\ue0b1'  # thin right arrow
PL_L=$'\ue0b2'   # solid left arrow

# Time via bash builtin (zero forks)
printf -v now '%(%H:%M)T' -1
printf -v hour '%(%H)T' -1
hour=$((10#$hour))

# Degraded fallback when jq is missing
if ! command -v jq >/dev/null 2>&1; then
    printf 'Claude | %s | %s\n' "${PWD##*/}" "$now"
    exit 0
fi

# ── Data extraction: ONE jq call ───────────────────────────────────────────
# Join with \x1f (unit separator): unlike tab, it is not IFS whitespace,
# so empty fields do not collapse and shift the read.
IFS=$'\x1f' read -r model cwd style vim_mode agent remaining total_in total_out <<EOF
$(jq -r '[
    (.model.display_name // "Claude"),
    (.workspace.current_dir // ""),
    (.output_style.name // ""),
    (.vim.mode // ""),
    (.agent.name // ""),
    (.context_window.remaining_percentage // ""),
    (.context_window.total_input_tokens // 0),
    (.context_window.total_output_tokens // 0)
] | map(tostring) | join("\u001f")' <<<"$input" 2>/dev/null)
EOF
model=${model:-Claude}
total_in=${total_in:-0}
total_out=${total_out:-0}

# ── Directory (pure bash, parent/leaf) ─────────────────────────────────────
if [ -n "$cwd" ]; then
    dir=${cwd##*/}
    parent=${cwd%/*}
    if [ -z "$parent" ] || [ "$parent" = "$cwd" ] || [ "$parent" = "$HOME" ]; then
        dir_display="$dir"
    else
        dir_display="${parent##*/}/${dir}"
    fi
else
    dir_display=${PWD##*/}
fi

# ── Git: ONE status call (porcelain v2 = branch + ahead/behind + counts) ───
git_seg=""
work="${cwd:-$PWD}"
if [ -d "$work" ] && timeout 1 git -C "$work" rev-parse --git-dir >/dev/null 2>&1; then
    branch="" oid="" ahead=0 behind=0 staged=0 modified=0 untracked=0
    while IFS= read -r line; do
        case "$line" in
            "# branch.head "*) branch=${line#"# branch.head "} ;;
            "# branch.oid "*)  oid=${line#"# branch.oid "} ;;
            "# branch.ab "*)
                ab=${line#"# branch.ab "}
                ahead=${ab%% *};  ahead=${ahead#+}
                behind=${ab##* }; behind=${behind#-}
                ;;
            "1 "* | "2 "*)
                xy=${line:2:2}
                [ "${xy:0:1}" != "." ] && staged=$((staged + 1))
                [ "${xy:1:1}" != "." ] && modified=$((modified + 1))
                ;;
            "u "*) modified=$((modified + 1)) ;;
            "? "*) untracked=$((untracked + 1)) ;;
        esac
    done < <(timeout 1 git -C "$work" --no-optional-locks status --porcelain=v2 --branch 2>/dev/null)

    [ "$branch" = "(detached)" ] && branch="➦ ${oid:0:7}"

    upstream=""
    [ "$ahead" -gt 0 ] 2>/dev/null && upstream="⇡${ahead}"
    [ "$behind" -gt 0 ] 2>/dev/null && upstream="${upstream}⇣${behind}"

    gstatus=""
    [ "$staged" -gt 0 ] && gstatus="${gstatus}●${staged} "
    [ "$modified" -gt 0 ] && gstatus="${gstatus}✎${modified} "
    [ "$untracked" -gt 0 ] && gstatus="${gstatus}◌${untracked} "
    if [ -z "$gstatus" ]; then gstatus="✔"; else gstatus="${gstatus% }"; fi

    [ -n "$branch" ] && git_seg=" ${branch} ${upstream}${upstream:+ }${gstatus} ${PL_RS}"
fi

# ── Context window meter ───────────────────────────────────────────────────
ctx_seg=""
if [ -n "$remaining" ]; then
    pct=${remaining%.*}
    total_k=$(( (total_in + total_out) / 1000 ))
    filled=$((pct / 10)); empty=$((10 - filled))
    meter=""
    for ((i = 0; i < filled; i++)); do meter="${meter}▰"; done
    for ((i = 0; i < empty; i++)); do meter="${meter}▱"; done
    if   [ "$pct" -ge 60 ]; then indicator="◉"
    elif [ "$pct" -ge 30 ]; then indicator="◎"
    else                         indicator="○"
    fi
    ctx_seg=" ${indicator} ${meter} ${pct}% ${PL_RS} ⚡${total_k}k"
fi

# ── Optional segments ──────────────────────────────────────────────────────
style_seg=""
[ -n "$style" ] && [ "$style" != "default" ] && style_seg=" ${PL_RS} ◈ ${style}"

agent_seg=""
[ -n "$agent" ] && agent_seg=" ${PL_RS} ⚡${agent}"

vim_seg=""
if [ -n "$vim_mode" ]; then
    case "$vim_mode" in
        NORMAL) vim_icon="◆" ;;
        INSERT) vim_icon="●" ;;
        VISUAL) vim_icon="◈" ;;
        *)      vim_icon="○" ;;
    esac
    vim_seg=" ${PL_RS} ${vim_icon} ${vim_mode}"
fi

# ── Time icon ──────────────────────────────────────────────────────────────
if   [ "$hour" -ge 6 ]  && [ "$hour" -lt 12 ]; then time_icon="☀"
elif [ "$hour" -ge 12 ] && [ "$hour" -lt 18 ]; then time_icon="◐"
elif [ "$hour" -ge 18 ] && [ "$hour" -lt 21 ]; then time_icon="◑"
else                                                time_icon="☽"
fi

# ── Model badge ────────────────────────────────────────────────────────────
case "$model" in
    *Opus*)   model_badge="◆ OPUS" ;;
    *Sonnet*) model_badge="◇ SONNET" ;;
    *Haiku*)  model_badge="○ HAIKU" ;;
    *)        model_badge="◈ ${model}" ;;
esac

# ── Assembly ───────────────────────────────────────────────────────────────
printf "╭─ %s %s 📂 %s%s%s%s%s%s %s %s %s\n" \
    "$model_badge" "$PL_R" "$dir_display" \
    "$git_seg" "$ctx_seg" "$style_seg" "$agent_seg" "$vim_seg" \
    "$PL_L" "$time_icon" "$now"
