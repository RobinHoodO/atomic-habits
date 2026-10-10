# Repeat rules and the Today / upcoming view in simple apps

Question (issue #5): how do Todoist, Tody, Sweepy, OurHome and Apple Reminders let people set repeat rules (after done vs fixed calendar day) and show Today plus the next N days? Which patterns need the fewest taps?

Researched 2026-10-10. Each claim names its source. Where a vendor page did not say something, that is marked **not stated**. I did not use an app myself, so tap counts are inferred from the documented controls, not measured.

## 1. Repeat rule kinds

| App | "X after done" | Fixed calendar | Source |
|---|---|---|---|
| Todoist | `every! 3 months`: next date counts from the day you complete it (done 20 Jan, next 20 Apr) | `every 3 months`: next date counts from the original date, even if done late (10 Jan, 10 Apr, 10 Jul). `every other fri`, `every 2, 15, 27` (days of month) | [Todoist: recurring dates](https://www.todoist.com/help/articles/introduction-to-recurring-dates-YUYVJJAV) |
| Tody | Yes, this is the only model: each task has an interval (days, weeks, months) and completing it restarts the countdown | No fixed weekday or date rules found | [todyapp.com](https://www.todyapp.com/) |
| Sweepy | Not stated on the official site. Reviews say there is a frequency per task (e.g. sheets every 3 weeks) plus a cleanliness slider | Not stated | [sweepy.com](https://sweepy.com/); review: [Apartment Therapy](https://www.apartmenttherapy.com/sweepy-cleaning-app-review-37027260) (secondary) |
| OurHome (ourhomeapp.com) | Not stated | Site mentions "due dates, repeating schedules, reminders" without detail. No help centre found | [ourhomeapp.com](http://ourhomeapp.com/) via search snippet; the site fetch failed |
| OurHome by Elusios (a different app with the same name) | "After last done" repeat; on an overdue task you choose to reschedule from completed time or from the next occurrence | Repeat on specific weekdays | [Google Play listing](https://play.google.com/store/apps/details?id=com.elusios.ourhome&hl=en-US), [App Store](https://apps.apple.com/us/app/ourhome-by-elusios/id6753957205) |
| Apple Reminders | **Not stated.** Apple's pages describe fixed repeats only | Repeat menu plus Custom: every N days; every N weeks on chosen weekdays; monthly on chosen days of month or a pattern such as last weekday; yearly with chosen months | [Apple: dates and repeats (Mac guide)](https://support.apple.com/guide/reminders/add-dates-or-locations-to-reminders-remnd4b206fb/mac) |

Notes:
- "Every second Sunday" has no exact example in Todoist's article. The closest documented form is `every other fri`, which starts from the second upcoming Friday (same Todoist article).
- "1st of the month" and "seasonal" have no exact example in any source found. Todoist's `every 2, 15, 27` suggests day-of-month lists work; that is an inference, not stated.
- Two apps are called OurHome. The chores-and-rewards one (ourhomeapp.com) has no repeat details I could verify. Treat both OurHome rows as weak evidence.

## 2. Taps and choices to set a rule

- **Todoist:** one typed phrase in the date field (`every sunday`, `every! 2 weeks`). Zero taps beyond typing, but the user must know the grammar. The `!` is the whole difference between fixed and after-done. Source: Todoist article above.
- **Tody:** per task, pick an interval number and a unit (days, weeks, months). The app also suggests a default interval per task (secondary source: [Macworld](https://www.macworld.com/article/223326/six-helpful-apps-for-keeping-house.html) summary, via search; vendor site says each task has "its own realistic frequency"). Fewest choices of all: one number plus one unit, no calendar logic.
- **Sweepy:** pick tasks from preset lists per room; frequency is adjustable and pre-suggested (reviews only). The user mostly accepts defaults.
- **Apple Reminders:** date, then Repeat menu; for anything unusual, Custom opens frequency, interval, then weekday or day-of-month pickers. That is 3 to 5 choices for "every second Sunday". Source: Apple Mac guide above. (I could not confirm the exact iPhone steps; the iPhone pages fetched did not include them.)
- **Elusios OurHome:** repeat on chosen weekdays; reschedule choice only appears on overdue tasks (Google Play listing).

Pattern: apps with a calendar model (Todoist, Apple) cost more choices per rule. Apps with only an interval model (Tody) cost two.

## 3. How Today and "next N days" are shown

- **Todoist Today:** every task scheduled for today across projects; only dated tasks appear; priority 1 pinned to the top. Overdue tasks are meant to be postponed, not left to pile up; postponing an overdue recurring task always moves it to tomorrow. Source: [Todoist: Today view](https://www.todoist.com/help/articles/plan-your-day-with-the-today-view-UVUXaiSs).
- **Todoist Upcoming:** "every task scheduled for the next 7 days (and beyond)", list, board or calendar layout; mobile uses a list with a week picker; mobile has a Reschedule button for overdue tasks. Source: [Todoist: Upcoming view](https://www.todoist.com/help/articles/plan-your-week-with-the-upcoming-view-OKOg1mR8). A "14 days" search shows a longer window (secondary, search snippet).
- **Tody:** a to-do list of what is due, "stays short: just what's due". Tiles show "Due in 8 days", "5 days overdue", "Due today", with a green (can wait) to red (overdue) colour. Source: [todyapp.com](https://www.todyapp.com/). The whole list can be sorted by due date or area (secondary: reviews).
- **Sweepy:** a generated daily checklist sized to the effort the user sets (premium); finished tasks are in a history. Source: [sweepy.com](https://sweepy.com/).
- **Apple Reminders:** a Today smart list exists; for a repeating reminder, future instances are dimmed and can be completed only after the current one. Source: [Apple: reminders in Calendar](https://support.apple.com/guide/iphone/use-reminders-iph14f1d32a5/ios) (via search snippet). Details of the Today list were **not stated** in pages I could read.

## 4. What happens to a done item

- **Todoist:** a recurring task jumps to its next date and is logged; it is not left in a completed list. Future occurrences are hidden unless you turn on the calendar layout's "Future occurrences"; completed occurrences show only if you turn on "Completed tasks" in Display. Todoist only schedules future dates: finishing an overdue `every day` task due yesterday moves it to tomorrow, not today. Undo is a pop-up lasting a few seconds. Sources: [Todoist: complete a recurring task](https://www.todoist.com/help/todoist/features/complete-a-task-with-a-recurring-date-dmI6SVqdP) and the recurring dates article.
- **Tody:** completing restarts the countdown, so the task drops out of "what is due" until it is due again. Source: [todyapp.com](https://www.todyapp.com/).
- **Sweepy:** the site does not say whether a done task resets; it keeps a history. Source: [sweepy.com](https://sweepy.com/).
- **Apple:** next instance only becomes completable after the current one (above).

## 5. Gaps and caveats

- Todoist's two help articles on Today and Upcoming did not say how overdue items sort inside Today beyond the postpone advice.
- No official Tody help page was reachable; the site's marketing and FAQ text was used.
- No OurHome (ourhomeapp.com) help centre could be fetched.
- Apple's iPhone steps for Repeat and End Repeat were not retrievable; Mac guide used.
- No "clearly simpler couple app" beyond Tody was fully documented; I treated Tody as the simple benchmark. A fuller check of a household app such as Flatastic or Sweepy premium would need hands-on use.

## 6. Fewest taps recommendation for a two-person household app

1. Offer exactly two rule kinds, chosen with one toggle: "Every N days/weeks/months after done" (Tody model, default) and "Fixed days" (weekday chips like Sun, or "every other week"). Skip free text and a full calendar grammar.
2. Default to "after done" for chores (vacuum, sheets); use fixed only for things tied to a day (bins on Tuesday). Make the choice a single segmented control, not a menu tree.
3. Pre-fill a sensible interval per template task so most rules cost zero taps; changing it is one number plus one unit.
4. Today shows only what is due or overdue, each with "due today / 3 days overdue"; add one "Next 7 days" list below it, collapsed by default. No board or calendar.
5. Tapping done hides the item until it is next due and shows a few-second Undo; an overdue item completes from today (next date counts from done day for "after done", from the next fixed slot for "fixed days").
