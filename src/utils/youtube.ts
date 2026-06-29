/** Build a YouTube thumbnail URL from a video id. */
export function youtubeThumbnail(
  videoId: string,
  quality: "default" | "mq" | "hq" | "sd" | "max" = "hq",
): string {
  const file =
    quality === "default"
      ? "default"
      : quality === "max"
        ? "maxresdefault"
        : `${quality}default`;
  return `https://i.ytimg.com/vi/${videoId}/${file}.jpg`;
}

/** Build the privacy-enhanced embed URL used by the TV/vinyl players. */
export function youtubeEmbedUrl(
  videoId: string,
  params: Record<string, string | number> = {},
): string {
  const search = new URLSearchParams({
    rel: "0",
    modestbranding: "1",
    playsinline: "1",
    ...Object.fromEntries(
      Object.entries(params).map(([k, v]) => [k, String(v)]),
    ),
  });
  return `https://www.youtube-nocookie.com/embed/${videoId}?${search.toString()}`;
}
