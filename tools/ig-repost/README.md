# ig-repost

Reposts new posts from **@cleats** (with their permission) to **@ftblpov**, with a
`📸 @cleats` credit line at the end of each caption. Uses only the official Instagram Graph API.

Only @ftblpov's API access is needed. @cleats' posts are read through Business Discovery,
which reads any public Business/Creator account, so nothing from @cleats is shared.

## Requirements

- @ftblpov is an Instagram **Business or Creator** account linked to a Facebook Page.
- An access token for @ftblpov with `instagram_basic`, `instagram_content_publish` and
  `pages_read_engagement` (Business Discovery needs it to read @cleats).
- @cleats is a Business or Creator account (Business Discovery can't read personal accounts).
- Python 3.8+ — no packages to install.

## Setup

1. Find @ftblpov's Instagram account ID: Meta Business Suite → Settings → Accounts →
   Instagram accounts → @ftblpov (a long number like `17841400000000000`).
2. Export settings:
   ```bash
   export IG_USER_ID=17841400000000000
   export ACCESS_TOKEN=...   # not needed if a proxy injects it
   ```
3. Mark @cleats' existing posts as already handled, so only posts made from now on get reposted:
   ```bash
   python3 repost.py --seed
   ```
   (Skip this if you also want to backfill older posts.)
4. Preview without posting:
   ```bash
   python3 repost.py --dry-run
   ```
5. Post for real. Either repost specific posts by link:
   ```bash
   python3 repost.py https://www.instagram.com/p/XXXXXXXX/ https://www.instagram.com/reel/YYYYYYY/
   ```
   or repost the newest @cleats posts that haven't been reposted yet (one per run by default):
   ```bash
   python3 repost.py
   ```
   Links must be @cleats posts from roughly the last 100; use `--lookback 300` for older ones.

## Running it automatically

Run it every couple of hours with cron (keep `state.json`: it's how the tool remembers what it posted):
```
0 */2 * * * cd /path/to/tools/ig-repost && IG_USER_ID=... ACCESS_TOKEN=... python3 repost.py >> repost.log 2>&1
```

## Options

| Flag | Default | |
|---|---|---|
| `--source` | `cleats` | account to repost from |
| `--expect-account` | `ftblpov` | refuses to post if `IG_USER_ID` belongs to another account |
| `--max-posts` | `1` | most posts per run |
| `--lookback` | `25` | how many recent source posts to check |
| `--credit` | `📸 @{source}` | credit line added to captions |
| `--seed` / `--dry-run` | | see above |

## Notes

- Instagram doesn't give out the video file for some reels (usually ones with licensed music).
  Those get skipped and logged.
- Videos are posted as Reels. Carousels keep their first 10 items.
- Instagram limits publishing to about 100 posts per 24 hours per account.
