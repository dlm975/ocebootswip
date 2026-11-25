#!/usr/bin/env python3
"""Repost new posts from a source Instagram account (used with its owner's
permission) to your own Instagram Business/Creator account, crediting the source.

Uses only the official Instagram Graph API:
  * Business Discovery to read the source account's public posts
  * Content Publishing to post them to your account

Standard library only. Run `python3 repost.py --help` for options.
"""

import argparse
import json
import os
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

GRAPH = "https://graph.facebook.com/" + os.environ.get("GRAPH_VERSION", "v21.0")
CAPTION_MAX = 2200
HASHTAG_MAX = 30
HERE = Path(__file__).resolve().parent


class ApiError(RuntimeError):
    pass


def api(method, path, params=None):
    """Call the Graph API. Adds ACCESS_TOKEN if set (otherwise relies on a proxy that injects it)."""
    params = dict(params or {})
    token = os.environ.get("ACCESS_TOKEN")
    if token:
        params["access_token"] = token
    url = f"{GRAPH}/{path.lstrip('/')}"
    data = None
    if method == "GET":
        url += "?" + urllib.parse.urlencode(params)
    else:
        data = urllib.parse.urlencode(params).encode()
    req = urllib.request.Request(url, data=data, method=method)
    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            return json.load(resp)
    except urllib.error.HTTPError as e:
        body = e.read().decode(errors="replace")
        try:
            msg = json.loads(body)["error"]["message"]
        except (ValueError, KeyError):
            msg = body
        raise ApiError(f"{method} {path}: HTTP {e.code}: {msg}") from None


# ---------- reading the source account ----------

MEDIA_FIELDS = (
    "id,caption,media_type,media_product_type,media_url,permalink,timestamp,"
    "children{media_type,media_url}"
)


def fetch_source_posts(ig_user_id, source, limit):
    fields = f"business_discovery.username({source}){{username,media.limit({limit}){{{MEDIA_FIELDS}}}}}"
    data = api("GET", ig_user_id, {"fields": fields})
    posts = data["business_discovery"].get("media", {}).get("data", [])
    return sorted(posts, key=lambda p: p["timestamp"])  # oldest first


# ---------- caption ----------

def build_caption(original, source, template):
    credit = template.format(source=source)
    text = (original or "").strip()
    # Instagram rejects captions with more than 30 hashtags: drop extras from the original.
    if text.count("#") + credit.count("#") > HASHTAG_MAX:
        allowed = HASHTAG_MAX - credit.count("#")
        words, kept = [], 0
        for w in text.split(" "):
            if w.startswith("#"):
                if kept >= allowed:
                    continue
                kept += 1
            words.append(w)
        text = " ".join(words)
    room = CAPTION_MAX - len(credit) - 2
    if len(text) > room:
        text = text[: max(room - 1, 0)].rstrip() + "…"
    return f"{text}\n\n{credit}" if text else credit


# ---------- publishing ----------

def wait_ready(container_id, timeout=600):
    """Videos are processed asynchronously; poll until the container is ready."""
    deadline = time.time() + timeout
    while True:
        status = api("GET", container_id, {"fields": "status_code,status"})
        code = status.get("status_code")
        if code in ("FINISHED", "PUBLISHED"):
            return
        if code in ("ERROR", "EXPIRED"):
            raise ApiError(f"container {container_id} {code}: {status.get('status')}")
        if time.time() > deadline:
            raise ApiError(f"container {container_id} still {code} after {timeout}s")
        time.sleep(10)


def create_container(ig_user_id, post, caption):
    mtype = post.get("media_type")
    if mtype == "IMAGE":
        return api("POST", f"{ig_user_id}/media", {"image_url": post["media_url"], "caption": caption})["id"]
    if mtype == "VIDEO":
        cid = api("POST", f"{ig_user_id}/media",
                  {"media_type": "REELS", "video_url": post["media_url"], "caption": caption})["id"]
        wait_ready(cid)
        return cid
    if mtype == "CAROUSEL_ALBUM":
        children = []
        for child in post["children"]["data"][:10]:
            if child.get("media_type") == "VIDEO":
                cid = api("POST", f"{ig_user_id}/media", {
                    "media_type": "VIDEO", "video_url": child["media_url"], "is_carousel_item": "true"})["id"]
                wait_ready(cid)
            else:
                cid = api("POST", f"{ig_user_id}/media",
                          {"image_url": child["media_url"], "is_carousel_item": "true"})["id"]
            children.append(cid)
        cid = api("POST", f"{ig_user_id}/media",
                  {"media_type": "CAROUSEL", "children": ",".join(children), "caption": caption})["id"]
        wait_ready(cid)
        return cid
    raise ApiError(f"unsupported media_type {mtype}")


def missing_media(post):
    """Instagram leaves out media_url on some posts (e.g. reels with licensed music)."""
    if post.get("media_type") == "CAROUSEL_ALBUM":
        kids = post.get("children", {}).get("data", [])
        return not kids or any(not c.get("media_url") for c in kids)
    return not post.get("media_url")


# ---------- state ----------

def load_state(path):
    try:
        return json.loads(path.read_text())
    except FileNotFoundError:
        return {"reposted": {}, "skipped": {}}


def save_state(path, state):
    tmp = path.with_suffix(".tmp")
    tmp.write_text(json.dumps(state, indent=2, sort_keys=True))
    tmp.replace(path)


# ---------- main ----------

def main(argv=None):
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--ig-user-id", default=os.environ.get("IG_USER_ID"),
                   help="your Instagram Business/Creator account ID (or env IG_USER_ID)")
    p.add_argument("--source", default=os.environ.get("SOURCE_USERNAME", "cleats"),
                   help="username to repost from, without @ (default: cleats)")
    p.add_argument("--expect-account", default=os.environ.get("EXPECT_ACCOUNT", "ftblpov"),
                   help="refuse to post unless --ig-user-id is this username (default: ftblpov)")
    p.add_argument("--max-posts", type=int, default=1, help="most posts to publish this run (default 1)")
    p.add_argument("--lookback", type=int, default=25, help="how many recent source posts to check (default 25)")
    p.add_argument("--credit", default=os.environ.get("CREDIT_TEMPLATE", "📸 @{source}"),
                   help="credit line appended to captions; {source} = username")
    p.add_argument("--state", type=Path, default=HERE / "state.json", help="file tracking reposted posts")
    p.add_argument("--seed", action="store_true",
                   help="mark every current source post as already handled, post nothing "
                        "(run once first so only NEW posts get reposted)")
    p.add_argument("--dry-run", action="store_true", help="show what would be posted, post nothing")
    args = p.parse_args(argv)

    if not args.ig_user_id:
        p.error("set --ig-user-id or IG_USER_ID")
    source = args.source.lstrip("@")

    me = api("GET", args.ig_user_id, {"fields": "username"}).get("username")
    if args.expect_account and me != args.expect_account.lstrip("@"):
        p.error(f"account {args.ig_user_id} is @{me}, not @{args.expect_account.lstrip('@')}; refusing to post")
    print(f"posting to @{me}")

    state = load_state(args.state)
    done = set(state["reposted"]) | set(state["skipped"])
    posts = fetch_source_posts(args.ig_user_id, source, args.lookback)
    new = [x for x in posts if x["id"] not in done]
    print(f"@{source}: {len(posts)} recent posts, {len(new)} not yet handled")

    if args.seed:
        for x in new:
            state["skipped"][x["id"]] = {"permalink": x.get("permalink"), "reason": "seed"}
        save_state(args.state, state)
        print(f"Seeded {len(new)} posts; future runs repost only posts newer than these.")
        return 0

    published = 0
    for post in new:
        if published >= args.max_posts:
            break
        link = post.get("permalink")
        if missing_media(post):
            print(f"skip {link}: Instagram doesn't share this post's media (often licensed music)")
            if not args.dry_run:
                state["skipped"][post["id"]] = {"permalink": link, "reason": "no media_url"}
                save_state(args.state, state)
            continue
        caption = build_caption(post.get("caption"), source, args.credit)
        if args.dry_run:
            print(f"\n[dry run] would repost {post['media_type']} {link}\n--- caption ---\n{caption}\n")
            published += 1
            continue
        try:
            cid = create_container(args.ig_user_id, post, caption)
            res = api("POST", f"{args.ig_user_id}/media_publish", {"creation_id": cid})
        except ApiError as e:
            print(f"FAILED {link}: {e}", file=sys.stderr)
            return 1
        state["reposted"][post["id"]] = {"permalink": link, "new_media_id": res["id"],
                                         "at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())}
        save_state(args.state, state)
        published += 1
        print(f"reposted {link} -> media {res['id']}")

    if not published:
        print("nothing new to repost")
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except ApiError as e:
        print(f"error: {e}", file=sys.stderr)
        sys.exit(1)
