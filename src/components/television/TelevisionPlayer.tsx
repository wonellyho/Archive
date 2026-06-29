import type { TasteContent } from "../../types/content";
import { youtubeEmbedUrl } from "../../utils/youtube";

interface TelevisionPlayerProps {
  content: TasteContent;
}

/**
 * The iframe only mounts once a video is selected (no pre-loading). The
 * `key` forces a fresh iframe per video, which stops the previous one.
 */
export function TelevisionPlayer({ content }: TelevisionPlayerProps) {
  return (
    <iframe
      key={content.id}
      className="absolute inset-0 h-full w-full"
      src={youtubeEmbedUrl(content.youtubeVideoId, { autoplay: 1 })}
      title={content.title || content.sourceTitle}
      allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
      allowFullScreen
    />
  );
}
