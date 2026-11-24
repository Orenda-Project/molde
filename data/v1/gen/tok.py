#!/usr/bin/env python3
# stdin: JSON list of program strings -> stdout: JSON list of planned-token counts (lang/tokens.py keyword_count)
import sys, json, os
sys.path.insert(0, os.environ.get('LANG_DIR', '/tmp/molde-data2/lang'))
import tokens  # noqa
xs = json.load(sys.stdin)
print(json.dumps([tokens.keyword_count(x) for x in xs]))
