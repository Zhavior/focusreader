"use client";

import { useCallback, useEffect, useState } from "react";
import { Download, Library, Loader2, Music, Trash2, ExternalLink } from "lucide-react";
import { estimateLabel, estimateSeconds, formatDuration } from "@/lib/duration";
import KaraokePlayer from "@/components/KaraokePlayer";

const POSITION_KEY = "focusreader:pos:";

function savePosition(trackId: string, seconds: number) {
  try {
    localStorage.setItem(POSITION_KEY + trackId, String(Math.floor(seconds)));
  } catch {
    /* storage full/blocked — resume is best-effort */
  }
}

function loadPosition(trackId: string): number {
  try {
    return Number(localStorage.getItem(POSITION_KEY + trackId)) || 0;
  } catch {
    return 0;
  }
}

function clearPosition(trackId: string) {
  try {
    localStorage.removeItem(POSITION_KEY + trackId);
  } catch {
    /* ignore */
  }
}

interface Track {
  id: string;
  title: string;
  chars: number;
  speed: number;
  background: string;
  status: "processing" | "ready" | "failed";
  size_bytes: number;
  created_at: string;
  source_url?: string | null;
}

const BACKGROUND_LABELS: Record<string, string> = {
  silence: "No background",
  brown_noise: "Brown noise",
  binaural: "Binaural",
};

export default function TrackLibrary({
  refreshSignal,
}: {
  /** Bump this value (e.g. after a generation completes) to reload the list. */
  refreshSignal: number;
}) {
  const [tracks, setTracks] = useState<Track[] | null>(null);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [playingText, setPlayingText] = useState<string>("");

  const load = useCallback(() => {
    fetch("/api/tracks")
      .then((r) => r.json())
      .then((data) => setTracks(data.tracks || []))
      .catch((err) => {
        console.error("Failed to load tracks:", err);
        setTracks([]);
      });
  }, []);

  useEffect(() => {
    load();
  }, [load, refreshSignal]);

  const openPlayer = async (id: string) => {
    try {
      const res = await fetch(`/api/tracks/${id}`);
      const data = await res.json();
      setPlayingText(data.track?.text || "");
      setPlayingId(id);
    } catch {
      /* ignore */
    }
  };

  const handleDelete = async (id: string) => {
    if (playingId === id) setPlayingId(null);
    clearPosition(id);
    await fetch(`/api/tracks/${id}`, { method: "DELETE" }).catch(() => load());
    load();
  };

  if (tracks === null) {
    return (
      <div className="flex h-32 items-center justify-center text-neutral-500">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  if (tracks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-white/10 bg-[#131619] p-10 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/5 text-neutral-500">
          <Library className="h-6 w-6" />
        </div>
        <div>
          <p className="text-sm font-medium text-neutral-300">
            Your library is empty
          </p>
          <p className="text-xs text-neutral-500">
            Paste text above and hit Generate to create your first track.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between px-1">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-neutral-400">
          Your Library
        </h2>
        <span className="text-xs text-neutral-500">
          ({tracks.length} ·{" "}
          {formatDuration(
            tracks.reduce((s, t) => s + estimateSeconds(t.chars, t.speed), 0)
          )}{" "}
          total)
        </span>
      </div>

      <ul className="space-y-2">
        {tracks.map((track) => (
          <li
            key={track.id}
            className="rounded-xl border border-white/10 bg-[#131619] p-4"
          >
            <div className="flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-indigo-500/15 text-indigo-400">
                  <Music className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-medium text-neutral-200">
                      {track.title || "Untitled track"}
                    </p>
                    {track.source_url && (
                      <a
                        href={track.source_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 rounded bg-purple-500/20 px-1.5 py-0.5 text-[10px] font-bold text-purple-300 border border-purple-500/40 hover:bg-purple-500/30 transition-colors shrink-0"
                        title={track.source_url}
                      >
                        <ExternalLink className="w-2.5 h-2.5" /> Source
                      </a>
                    )}
                  </div>
                  <p className="text-xs text-neutral-500 mt-0.5">
                    ≈ {estimateLabel(track.chars, track.speed)} · {track.speed}x ·{" "}
                    {BACKGROUND_LABELS[track.background] ?? track.background} ·{" "}
                    {new Date(track.created_at).toLocaleDateString()}
                  </p>
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-2">
                {track.status === "ready" ? (
                  <>
                    <button
                      onClick={() =>
                        playingId === track.id
                          ? setPlayingId(null)
                          : openPlayer(track.id)
                      }
                      className="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-neutral-300 transition hover:border-indigo-500/50 hover:text-indigo-300"
                    >
                      {playingId === track.id
                        ? "Close"
                        : loadPosition(track.id) > 0
                          ? "Resume"
                          : "Play"}
                    </button>
                    <a
                      href={`/api/tracks/${track.id}/audio`}
                      download={`${track.title || "track"}.mp3`}
                      aria-label="Download MP3"
                      className="rounded-lg p-1.5 text-neutral-600 transition hover:text-indigo-300"
                    >
                      <Download className="h-4 w-4" />
                    </a>
                  </>
                ) : (
                  <span className="text-xs text-neutral-600">
                    {track.status === "processing" ? "Saving..." : "Failed"}
                  </span>
                )}
                <button
                  onClick={() => handleDelete(track.id)}
                  aria-label="Delete track"
                  className="rounded-lg p-1.5 text-neutral-600 transition hover:text-red-400"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>

            {playingId === track.id && (
              <div className="mt-3">
                <KaraokePlayer
                  src={`/api/tracks/${track.id}/audio`}
                  text={playingText}
                  autoPlay
                  initialTime={loadPosition(track.id)}
                  onTime={(s) => savePosition(track.id, s)}
                  onEnded={() => clearPosition(track.id)}
                />
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
