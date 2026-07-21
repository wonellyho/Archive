"""LLM 출력 안전성 필터(기능8 ④, G4) — PII 마스킹 + 유해 차단."""

import pytest

from app.llm.base import LLMError, parse_result
from app.llm.safety import is_harmful, mask_pii, sanitize_mood, sanitize_taglines


# ── PII 마스킹 ──


@pytest.mark.parametrize(
    "text,leaked",
    [
        ("연락 test@example.com 남김", "test@example.com"),
        ("전화 010-1234-5678 이야", "010-1234-5678"),
        ("주민 900101-1234567 유출", "900101-1234567"),
        ("카드 1234567890123456 노출", "1234567890123456"),
    ],
)
def test_mask_pii_removes_original(text, leaked):
    out = mask_pii(text)
    assert leaked not in out
    assert "▇" in out


def test_mask_pii_leaves_normal_text():
    assert mask_pii("밤에 스며드는 편지") == "밤에 스며드는 편지"


# ── 유해 판별 ──


def test_is_harmful():
    assert is_harmful("이런 씨발 문구")
    assert is_harmful("FUCK this")
    assert not is_harmful("잔잔한 위로")


@pytest.mark.parametrize(
    "benign",
    ["고양이 새끼", "촛불이 꺼져 간다", "시발점에서 출발", "죽어라 사랑했다", "자살골"],
)
def test_benign_phrases_not_flagged(benign):
    # 부분 문자열 충돌(새끼/꺼져/시발/죽어라/자살) — benign은 통과해야 함.
    assert not is_harmful(benign)
    assert sanitize_taglines([benign]) == [benign]


# ── 리스트/무드 정제 ──


def test_sanitize_taglines_removes_harmful_and_masks_pii():
    out = sanitize_taglines(["잔잔한 밤", "씨발 최고", "메일 a@b.com 봐"])
    assert "씨발 최고" not in out  # 유해 제거
    assert out[0] == "잔잔한 밤"
    assert any("▇" in t for t in out)  # PII 마스킹됨
    assert len(out) == 2


def test_sanitize_mood_blank_when_harmful():
    assert sanitize_mood("병신") == ""
    assert sanitize_mood("잔잔함") == "잔잔함"


# ── parse_result 통합 ──


def test_parse_result_masks_pii():
    r = parse_result('{"taglines": ["문의 test@x.com 로"], "mood": "잔잔"}')
    assert "test@x.com" not in r.taglines[0] and "▇" in r.taglines[0]


def test_parse_result_all_harmful_raises():
    with pytest.raises(LLMError):
        parse_result('{"taglines": ["씨발", "병신"], "mood": "x"}')
