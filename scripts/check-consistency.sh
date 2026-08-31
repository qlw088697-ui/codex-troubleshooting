#!/usr/bin/env bash
# 结构一致性检查：
#   1) docs/ 下每篇文档必须登记进 _sidebar.md
#   2) 中英配对文档（*.en.md）必须互相链接
# 用法：bash scripts/check-consistency.sh   （本地与 CI 通用）
set -u
cd "$(dirname "$0")/.." || exit 1

status=0

# 1) 侧边栏覆盖
while IFS= read -r f; do
  if ! grep -qF "$f" _sidebar.md; then
    echo "MISSING in _sidebar.md: $f"
    status=1
  fi
done < <(find docs -maxdepth 1 -name '*.md' | sort)

# 2) 中英互链
while IFS= read -r en; do
  zh="${en%.en.md}.md"
  if [ -f "$zh" ]; then
    base_en="$(basename "$en")"
    base_zh="$(basename "$zh")"
    grep -qF "$base_en" "$zh" || { echo "MISSING link: $zh -> $base_en"; status=1; }
    grep -qF "$base_zh" "$en" || { echo "MISSING link: $en -> $base_zh"; status=1; }
  fi
done < <(find docs -name '*.en.md' | sort)

if [ "$status" -eq 0 ]; then
  echo "check-consistency: OK"
else
  echo "check-consistency: 存在结构不一致，请修复后再提交"
fi
exit "$status"
