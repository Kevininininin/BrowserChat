---
id: youtube-analytics
name: "YouTube Analytics"
description: "Navigate from YouTube to a user-specified video's Analytics page in YouTube Studio using lightweight, label-targeted browser actions."
---

# Goal

Open the Analytics page for the YouTube video named by the user, then stop. Do not read, summarize, or change analytics data unless the user separately asks.

# Required tool strategy

- Start with `get_current_website`.
- For known controls, call `find_and_click` with the exact label. This searches and clicks the live DOM without a page capture. If it fails, use any suggested labels in the error instead of repeating the same query.
- Do not call `observe_page` to find **View your channel**, **Manage videos**, or **Analytics**. Their labels are already known.
- After entering YouTube Studio, verify `get_current_website` reports `studio.youtube.com` before reading the video list. `Manage videos` may open a new tab; do not inspect or act on the old channel tab.
- Perform one `observe_page` after the Studio video list is visible. Use its returned controls directly. Do not call `scroll_page`; Studio uses a long virtualized list and scrolling performs another expensive observation.
- Video requests are commonly shorthand, misspelled, or conceptual rather than exact titles. Infer the intended video from strong semantic overlap in subject, place, and format. For example, `UF dorm tour` or `UF form tour` is a strong match for `Life at UF: Honors Village Tour, Dining Halls & Fav Spots on Campus | University of Florida`. If exactly one title is clearly plausible, click it without asking for an exact-title confirmation.
- If that title is absent from the compact observation, call `find_and_click` with `match: "contains"` and the shortest distinctive literal phrase likely present in the title, such as `UF`. This searches the live DOM beyond the compact observation without another full read. Use the tool's suggested labels if the first phrase is not unique.
- Do not type a title directly into Studio's `Filter` field: it opens a filter-builder menu rather than immediately searching video titles. If direct title location still fails, use `find_and_click` to choose `Title` from that filter menu, fill the resulting value field, then call `press_key` with `Enter` on that same field. Consume `postKeyObservation`; do not add a separate observation.
- Click the requested video with `click_element`.
- Avoid screenshots, repeated observations, `search_captured_page_text`, and broad DOM reads. Never repeat the same failed `find_and_click` call. Use a recovery observation only if its suggested labels and `get_current_website` cannot resolve the failure.
- Ask the user only when two or more titles are comparably plausible. Do not require a verbatim title match when one semantic match is substantially stronger than all alternatives.

# Navigation

1. If the current page is the YouTube homepage, call `find_and_click` with exact query `Account menu`. This is the profile-picture button in the top-right header.
2. Call `find_and_click` with exact query `View your channel`.
3. On the channel page, call `find_and_click` with exact query `Manage videos`. If a popup was blocked, wait for the user to allow it, then call `get_current_website`; retry `Manage videos` only when still on the public channel page.
4. Confirm the active URL is on `studio.youtube.com`, then call `observe_page` once.
5. Match the user request semantically against video-title links whose destinations look like `/video/<id>/edit`. Treat a unique topical match as sufficient even when the words differ. Ignore the channel-level sidebar `Analytics` item.
6. If no likely title is present because the compact result was truncated, try the lightweight `find_and_click` contains strategy before using Studio's filter-builder fallback.
7. Call `click_element` with the unique matching video-title link's element reference.
8. On that video's details page, call `find_and_click` with exact query `Analytics`.
9. Confirm the URL identifies the selected video's Analytics page, then stop.

If starting later in the flow, continue from the applicable step instead of navigating backward.
