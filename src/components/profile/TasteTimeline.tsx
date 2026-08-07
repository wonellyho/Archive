import { useEffect, useState } from "react";
import { getTimeline } from "../../services/timelineService";
import type { TimelineBucket } from "../../services/timelineService";
import { ApiError } from "../../services/apiClient";

/**
 * 취향의 축적 — 월별로 담은 콘텐츠(음악/영상)를 누적 스택 막대로 보여준다.
 * GET /api/timeline/{username}(공개). 차트는 dataviz 절차대로:
 * 카테고리 2색(블루=음악, 아쿠아=영상, CVD ΔE 73.6 검증) + 직접 값 라벨/범례/표(relief).
 */

// 검증된 카테고리 슬롯 1·2 (블루/아쿠아). 텍스트는 잉크 토큰, 색은 마크만 담당.
const MUSIC = "#2a78d6";
const VIDEO = "#1baf7a";

const COL_W = 44; // 막대 폭
const GAP = 28; // 막대 간격
const PLOT_H = 200; // 플롯 높이
const PAD_TOP = 24; // 상단 값 라벨 여유
const SEG_GAP = 2; // 스택 세그먼트 사이 표면 간격

/** 상단만 둥근(반경 r) 막대 경로. 하단은 baseline에 각지게 붙는다. */
function topRoundedBar(x: number, top: number, w: number, h: number, r: number): string {
  const rr = Math.min(r, h, w / 2);
  const bottom = top + h;
  return `M${x},${bottom} L${x},${top + rr} Q${x},${top} ${x + rr},${top} L${
    x + w - rr
  },${top} Q${x + w},${top} ${x + w},${top + rr} L${x + w},${bottom} Z`;
}

function monthLabel(period: string): string {
  // "2026-06" → "26.6"
  const [y, m] = period.split("-");
  return `${y.slice(2)}.${Number(m)}`;
}

interface ChartProps {
  buckets: TimelineBucket[];
}

function TimelineChart({ buckets }: ChartProps) {
  const [hover, setHover] = useState<number | null>(null);

  const maxTotal = Math.max(1, ...buckets.map((b) => b.total));
  const scale = PLOT_H / maxTotal;
  const width = buckets.length * COL_W + (buckets.length - 1) * GAP;
  const svgH = PAD_TOP + PLOT_H + 28; // + 월 라벨 영역
  const baseline = PAD_TOP + PLOT_H;

  return (
    <div className="relative overflow-x-auto pb-2">
      <svg
        width={width}
        height={svgH}
        role="img"
        aria-label="월별 취향 축적 차트"
        className="mx-auto block"
      >
        {/* baseline */}
        <line
          x1={0}
          y1={baseline}
          x2={width}
          y2={baseline}
          stroke="var(--color-line)"
          strokeWidth={1}
        />
        {buckets.map((b, i) => {
          const x = i * (COL_W + GAP);
          const musicH = b.music * scale;
          const videoH = b.video * scale;
          const musicTop = baseline - musicH;
          // 영상이 위에 쌓임(음악 위로 2px 간격)
          const videoTop = musicTop - SEG_GAP - videoH;
          const musicIsTop = b.video === 0;
          const active = hover === i;
          return (
            <g
              key={b.period}
              opacity={hover === null || active ? 1 : 0.5}
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
            >
              {/* 음악(아래) */}
              {b.music > 0 ? (
                musicIsTop ? (
                  <path d={topRoundedBar(x, musicTop, COL_W, musicH, 4)} fill={MUSIC} />
                ) : (
                  <rect x={x} y={musicTop} width={COL_W} height={musicH} fill={MUSIC} />
                )
              ) : null}
              {/* 영상(위, 상단 둥금) */}
              {b.video > 0 ? (
                <path d={topRoundedBar(x, videoTop, COL_W, videoH, 4)} fill={VIDEO} />
              ) : null}
              {/* 합계 직접 라벨(relief) */}
              <text
                x={x + COL_W / 2}
                y={(b.total > 0 ? Math.min(musicTop, videoTop) : baseline) - 8}
                textAnchor="middle"
                fontSize={13}
                fontWeight={600}
                fill="var(--color-ink)"
              >
                {b.total}
              </text>
              {/* 월 라벨 */}
              <text
                x={x + COL_W / 2}
                y={baseline + 18}
                textAnchor="middle"
                fontSize={12}
                fill="var(--color-ink-faint)"
              >
                {monthLabel(b.period)}
              </text>
              {/* 히트 타깃(전체 높이) */}
              <rect
                x={x - GAP / 2}
                y={PAD_TOP}
                width={COL_W + GAP}
                height={PLOT_H}
                fill="transparent"
              />
            </g>
          );
        })}
      </svg>

      {/* 호버 툴팁 */}
      {hover !== null ? (
        <div
          className="pointer-events-none absolute top-0 -translate-x-1/2 rounded-xl border border-line bg-paper px-3 py-2 text-sm shadow-md"
          style={{ left: hover * (COL_W + GAP) + COL_W / 2 }}
        >
          <div className="mb-1 font-medium text-ink">{buckets[hover].period}</div>
          <div className="flex items-center gap-1.5 text-ink-soft">
            <span className="inline-block size-2.5 rounded-full" style={{ background: MUSIC }} />
            음악 {buckets[hover].music}
          </div>
          <div className="flex items-center gap-1.5 text-ink-soft">
            <span className="inline-block size-2.5 rounded-full" style={{ background: VIDEO }} />
            영상 {buckets[hover].video}
          </div>
          <div className="mt-0.5 text-ink-faint">합계 {buckets[hover].total}</div>
        </div>
      ) : null}
    </div>
  );
}

/** 접근성용 데이터 표(relief) — 스크린리더 및 색 구분 불가 상황 대비. */
function TimelineTable({ buckets }: ChartProps) {
  return (
    <table className="sr-only">
      <caption>월별 취향 축적</caption>
      <thead>
        <tr>
          <th>기간</th>
          <th>음악</th>
          <th>영상</th>
          <th>합계</th>
        </tr>
      </thead>
      <tbody>
        {buckets.map((b) => (
          <tr key={b.period}>
            <td>{b.period}</td>
            <td>{b.music}</td>
            <td>{b.video}</td>
            <td>{b.total}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function Legend() {
  return (
    <div className="flex items-center justify-center gap-5 text-sm text-ink-soft">
      <span className="flex items-center gap-1.5">
        <span className="inline-block size-3 rounded-full" style={{ background: MUSIC }} />
        음악
      </span>
      <span className="flex items-center gap-1.5">
        <span className="inline-block size-3 rounded-full" style={{ background: VIDEO }} />
        영상
      </span>
    </div>
  );
}

export function TasteTimeline({ username }: { username?: string }) {
  const [buckets, setBuckets] = useState<TimelineBucket[] | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "error">("loading");

  useEffect(() => {
    if (!username) {
      setStatus("idle");
      return;
    }
    let cancelled = false;
    setStatus("loading");
    getTimeline(username)
      .then((res) => {
        if (cancelled) return;
        setBuckets(res.buckets);
        setStatus("idle");
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        // 404(사용자 없음)는 빈 상태처럼 취급
        if (err instanceof ApiError && err.status === 404) {
          setBuckets([]);
          setStatus("idle");
        } else {
          setStatus("error");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [username]);

  const total = buckets?.reduce((sum, b) => sum + b.total, 0) ?? 0;

  return (
    <section
      aria-label="취향의 축적"
      className="mx-auto flex w-full max-w-3xl flex-col gap-6 rounded-3xl border border-line bg-paper px-6 py-10 shadow-sm sm:px-10"
    >
      <div className="flex flex-col items-center gap-1 text-center">
        <span className="text-sm uppercase tracking-[0.25em] text-ink-faint">
          Timeline
        </span>
        <h2 className="font-serif text-3xl text-ink">취향의 축적</h2>
        <p className="text-base text-ink-soft">
          담아온 콘텐츠가 시간과 함께 쌓인 기록
        </p>
      </div>

      {!username ? (
        <p className="py-8 text-center text-base text-ink-faint">
          공개 주소(username)를 설정하면 취향 타임라인이 만들어져요.
        </p>
      ) : status === "loading" ? (
        <p className="py-8 text-center text-base text-ink-faint">불러오는 중…</p>
      ) : status === "error" ? (
        <p className="py-8 text-center text-base text-ink-faint">
          타임라인을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.
        </p>
      ) : !buckets || buckets.length === 0 ? (
        <p className="py-8 text-center text-base text-ink-faint">
          아직 담은 콘텐츠가 없어요. 콘텐츠를 담으면 이곳에 쌓입니다.
        </p>
      ) : (
        <>
          <TimelineChart buckets={buckets} />
          <Legend />
          <TimelineTable buckets={buckets} />
          <p className="text-center text-sm text-ink-faint">
            지금까지 총 {total}개의 취향을 담았어요.
          </p>
        </>
      )}
    </section>
  );
}
