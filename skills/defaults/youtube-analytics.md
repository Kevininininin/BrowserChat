---
id: youtube-analytics
name: "YouTube Analytics"
description: "Navigate from YouTube to a user-specified video's Analytics page in YouTube Studio using lightweight, label-targeted browser actions."
---

# Goal

Open the Analytics page for the YouTube video named by the user, then stop. Do not read, summarize, or change analytics data unless the user separately asks.

# Required tool strategy

- Start with `get_current_website`.
- For known controls, call `find_and_click` with the exact label. This searches and clicks the live DOM without a page capture.
- Do not call `observe_page` to find **View your channel**, **Manage videos**, or **Analytics**. Their labels are already known.
- Perform exactly one `observe_page` after the video list is visible in YouTube Studio. Use that observation only to identify the available video titles and obtain the requested video's element reference.
- Click the requested video with `click_element`.
- Avoid screenshots, repeated observations, `search_captured_page_text`, and broad DOM reads. Use a recovery observation only if a known-label click fails and the failure cannot be resolved with `get_current_website`.
- Never guess between similar video titles. If the one observation shows no unique match, report the available close matches and ask the user which one they mean.

# Navigation

1. If the current page is the YouTube homepage, call `find_and_click` with the user's profile control label if they supplied it; otherwise use exact query `Account`.
2. Call `find_and_click` with exact query `View your channel`.
3. On the channel page, call `find_and_click` with exact query `Manage videos`.
4. When YouTube Studio's video list is ready, call `observe_page` once.
5. Match the user-supplied video title against the observed controls. Prefer an exact title match; accept a unique, obvious normalized match only when punctuation or whitespace differs.
6. Call `click_element` with that video's element reference.
7. Call `find_and_click` with exact query `Analytics`.
8. Confirm the current website is the selected video's Analytics page, then stop.

If starting later in the flow, continue from the applicable step instead of navigating backward.
