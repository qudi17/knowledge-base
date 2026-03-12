from __future__ import annotations

import json
from pathlib import Path

from .models import Case


def load_cases(path: str | Path) -> list[Case]:
    cases: list[Case] = []
    with open(path, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            raw = json.loads(line)
            cases.append(Case(**raw))
    return cases
