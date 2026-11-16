"""Reads Nevin's most recent YouTube Music song and saves it for Aissata's site.

Runs in GitHub Actions. Needs the repository secret YTMUSIC_HEADERS: the request
headers copied from music.youtube.com while signed in (see Aissata HQ > Setup).
Uses the unofficial ytmusicapi library, so Google changes can break it.
"""
import json
import os
import sys
import urllib.request
from datetime import datetime, timezone

SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_KEY = os.environ["SUPABASE_KEY"]
RAW_HEADERS = os.environ.get("YTMUSIC_HEADERS", "").strip()


def supabase(method, path, body=None, extra_headers=None):
    req = urllib.request.Request(
        f"{SUPABASE_URL}/rest/v1/{path}",
        method=method,
        data=json.dumps(body).encode() if body is not None else None,
        headers={
            "apikey": SUPABASE_KEY,
            "Authorization": f"Bearer {SUPABASE_KEY}",
            "Content-Type": "application/json",
            **(extra_headers or {}),
        },
    )
    with urllib.request.urlopen(req, timeout=20) as res:
        text = res.read().decode()
        return json.loads(text) if text else None


def main():
    if not RAW_HEADERS:
        print("YTMUSIC_HEADERS secret isn't set yet - nothing to do. See Aissata HQ > Setup.")
        return

    if "SAPISIDHASH" not in RAW_HEADERS:
        raise RuntimeError(
            "The saved headers have no 'authorization: SAPISIDHASH ...' line. "
            "Copy the request headers from a 'browse' request on music.youtube.com (see Aissata HQ > Setup)."
        )

    from ytmusicapi import YTMusic
    try:  # newer versions
        from ytmusicapi import setup_browser as setup
    except ImportError:  # older versions
        from ytmusicapi import setup

    auth = setup(filepath=None, headers_raw=RAW_HEADERS)
    yt = YTMusic(auth)
    history = yt.get_history()
    if not history:
        print("History is empty.")
        return

    song = history[0]
    video_id = song.get("videoId")
    if not video_id:
        print("Latest history item has no video id; skipping.")
        return

    thumbs = song.get("thumbnails") or []
    row = {
        "id": 1,
        "video_id": video_id,
        "title": song.get("title"),
        "artist": ", ".join(a.get("name", "") for a in (song.get("artists") or []) if a.get("name")),
        "album": (song.get("album") or {}).get("name"),
        "thumbnail": thumbs[-1]["url"] if thumbs else f"https://i.ytimg.com/vi/{video_id}/hqdefault.jpg",
        "checked_at": datetime.now(timezone.utc).isoformat(),
    }

    current = supabase("GET", "now_playing?id=eq.1&select=video_id") or []
    if current and current[0]["video_id"] == video_id:
        # same song as last time: just record that we checked
        supabase("PATCH", "now_playing?id=eq.1", {"checked_at": row["checked_at"]})
        print(f"Still: {row['title']} - {row['artist']}")
        return

    row["changed_at"] = row["checked_at"]
    supabase("POST", "now_playing", row, {"Prefer": "resolution=merge-duplicates,return=minimal"})
    print(f"New last song: {row['title']} - {row['artist']} ({video_id})")


if __name__ == "__main__":
    try:
        main()
    except Exception as e:  # make the run fail so GitHub emails Nevin
        print(f"Couldn't read YouTube Music history: {e}", file=sys.stderr)
        print("If this keeps failing, the YouTube Music cookie probably expired - redo the setup steps.", file=sys.stderr)
        sys.exit(1)
