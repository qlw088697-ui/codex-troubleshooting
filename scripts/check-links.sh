#!/usr/bin/env bash
# 检查仓库内 Markdown 的相对链接是否指向真实存在的文件（锚点自动剥离，外链跳过）
# 用法：bash scripts/check-links.sh   （本地与 CI 通用）
set -u
cd "$(dirname "$0")/.." || exit 1

status=0
found=0
while IFS=$'\t' read -r md path; do
  [ -n "$path" ] || continue
  found=$((found + 1))
  if [ ! -e "$path" ]; then
    echo "BROKEN  $md -> $path"
    status=1
  fi
done < <(
  find . -name '*.md' -not -path './.git/*' | sort | while IFS= read -r md; do
    dir=$(dirname "$md")
    grep -oE '\]\([^)]+\)' "$md" | while IFS= read -r m; do
      t="${m#](}"
      t="${t%)}"
      t="${t%%#*}"
      case "$t" in
        '' | http://* | https://* | mailto:* | '<'*) continue ;;
      esac
      printf '%s\t%s\n' "$md" "$dir/$t"
    done
  done
)

if [ "$status" -eq 0 ]; then
  echo "check-links: ${found} 个相对链接全部有效"
else
  echo "check-links: 存在失效链接，请修复后再提交"
fi
exit "$status"
