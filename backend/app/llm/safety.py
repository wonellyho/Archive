"""LLM 출력 안전성 필터(기능8 ④) — 개인정보(PII) 마스킹 + 기본 유해 표현 차단.

문구추천 출력은 짧은 한국어 문구라 PII/유해가 섞일 확률은 낮지만, "출력 안전성"
계층을 명시적으로 둔다. 스키마·길이 강제(parse_result)는 이 필터 앞단.
"""

import re

_MASK = "▇"

# PII 패턴 — 마스킹 대상
_EMAIL = re.compile(r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}")
_RRN = re.compile(r"\b\d{6}[-\s]?\d{7}\b")  # 주민등록번호
_PHONE = re.compile(r"\b01[016789][-\s]?\d{3,4}[-\s]?\d{4}\b")  # 휴대폰
_LONGNUM = re.compile(r"\b\d{12,}\b")  # 카드번호 등 12자리 이상 연속 숫자
_PII_PATTERNS = (_EMAIL, _RRN, _PHONE, _LONGNUM)

# 최소 유해어 세트(데모 수준) — 포함 시 해당 문구 제거.
_HARMFUL = (
    "씨발", "시발", "개새끼", "새끼", "병신", "지랄", "좆", "엿먹",
    "자살", "죽어라", "꺼져", "fuck", "shit", "bitch", "asshole",
)


def mask_pii(text: str) -> str:
    """텍스트 안의 PII(이메일·주민번호·전화·장문 숫자)를 마스킹한다."""
    for pattern in _PII_PATTERNS:
        text = pattern.sub(_MASK, text)
    return text


def is_harmful(text: str) -> bool:
    """유해어 포함 여부(대소문자 무시)."""
    low = text.lower()
    return any(word in low for word in _HARMFUL)


def sanitize_taglines(taglines: list[str]) -> list[str]:
    """유해 문구는 제거하고, 남은 문구의 PII는 마스킹한다."""
    result: list[str] = []
    for tagline in taglines:
        if is_harmful(tagline):
            continue
        result.append(mask_pii(tagline))
    return result


def sanitize_mood(mood: str) -> str:
    """무드가 유해하면 비우고, 아니면 PII만 마스킹."""
    if is_harmful(mood):
        return ""
    return mask_pii(mood)
