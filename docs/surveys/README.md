# Staff questionnaires

One survey per role, built from the shared question bank in `site/data/surveys.json`
(76 questions). Every survey shares a common core (tenure, satisfaction, likelihood to recommend,
pain points, one thing to change, willingness to help) so answers can be compared across roles, plus questions
specific to the role.

**The project site is display-only.** It shows the questions as part of the project plan. Microsoft Forms collects
the answers. Loading the answers back into the site is optional (see the last section).

| Survey | Role ID | Questions | Minutes |
| --- | --- | --- | --- |
| [Credit Analysts](credit-analyst.md) | `credit-analyst` | 39 | 19 |
| [Credit Review](credit-review.md) | `credit-review` | 30 | 15 |
| [Credit Management](credit-mgmt.md) | `credit-mgmt` | 39 | 19 |
| [Lending Officers](lending-officer.md) | `lending-officer` | 40 | 19 |
| [Portfolio Managers](portfolio-mgr.md) | `portfolio-mgr` | 39 | 19 |
| [Lending Management](lending-mgmt.md) | `lending-mgmt` | 39 | 20 |
| [Commercial Lending Assistants](cla.md) | `cla` | 36 | 18 |
| [Commercial Lending Assistant Management](cla-mgmt.md) | `cla-mgmt` | 36 | 19 |

These files are generated. To change a question, edit `site/data/surveys.json`, then run:

```sh
python3 scripts/export_forms.py
python3 scripts/validate.py
```

## Building a form in Microsoft Forms

1. Go to forms.office.com and choose **New Form**. Use the title, description and thank-you message from the
   top of the role's sheet.
2. Add a **section** for each "Section:" heading in the sheet, with the subtitle if one is given.
3. Add each question in order. **Copy the title exactly, including the `[Q##]` prefix.** The prefix is how answers are
   matched back to the question bank; changing it breaks the import.
4. Use the Forms type listed under each question:
   - **Choice**: one answer, or turn on **Multiple answers** for "select all" and "pick up to" questions.
   - **Text** with **Restrictions > Number** (or **Between**) for number questions. Put the unit in the subtitle.
   - **Text** with **Long answer** for open comments.
   - **Rating**: 5 levels, Number symbol, with the end labels given.
   - **Likert**: enter the scale labels as options (columns) and the statements as rows.
   - **Ranking**: enter the options; people drag them into order.
   - **Net Promoter Score**: keep the 0-10 defaults.
5. Turn **Required** on where the sheet says yes.
6. Preview on a phone as well as a desktop before sending.

A quick way to make the eight forms: build one survey completely, then use **Duplicate** in Forms and delete or add
questions for the next role. Check each duplicate against its sheet.

### Recommended settings

- **Who can fill out this form:** Only people in my organization.
- **Record name:** off, so responses are anonymous. Say so in the description (it already does).
- **One response per person:** optional. It needs sign-in and prevents duplicates; with Record name off, names
  are still not stored.
- **Start date / End date:** set an end date about two weeks after sending.
- **Shuffle questions:** off. The order matters.
- The last question asks whether people want to help. Send a separate sign-up link (or ask managers) to collect
  names, so survey answers stay anonymous.

## Getting the answers out

In Forms, open **Responses > Open results in Excel** (or **Download a copy**). Each form gives one workbook.
Forms writes one column per question titled with the full question text (so the `[Q##]` prefix is kept),
multiple-choice and ranking answers as text separated by semicolons, and one column per row for Likert questions.

## Optional: loading answers into the site

`scripts/import_responses.py` reads one export and appends its rows to `site/data/survey-responses.json`
for analysis. It is not needed to run the survey.

```sh
# .xlsx needs openpyxl (pip install openpyxl); otherwise save the sheet as CSV (UTF-8) from Excel first
python3 scripts/import_responses.py --role credit-analyst "Credit Analysts survey.xlsx"
python3 scripts/import_responses.py --role cla cla-responses.csv --dry-run   # check without writing
python3 scripts/validate.py
```

- `--role` must be one of the role IDs in the table above; use the file for that role's form.
- Columns without a `[Q##]` prefix are ignored, except the Forms **ID** and **Completion time** columns.
- Re-importing the same file is safe: rows already imported (same role and Forms response ID) are skipped.
- Answers become: numbers for rating, NPS and number questions; text for single choice and open questions;
  lists for multiple choice and ranking (in ranked order); and `{statement: score}` for Likert questions.
  Likert labels such as "Agree" are converted to their score on the scale.
- Anything that cannot be matched is reported as a warning and left out, not guessed.
