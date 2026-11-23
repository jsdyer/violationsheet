# Violation Sheet

[Open Violation Sheet](https://coolcode.ca/violationsheet/) to compare police-reported crime rates for a B.C. police service with the previous published year and with the provincial rate.

<!-- coolcode:guide -->
Pick any police service in the extract, not only the buttons. A year StatCan left blank is shown as not published and is not counted as zero. The rate is incidents per 100,000 population.
<!-- /coolcode:guide -->

## Reading the extract

The page keeps twelve offence groups from Statistics Canada table 35-10-0184: all violations, violent crime, assault, robbery, property crime, break and enter, vehicle theft, theft under $5,000, mischief, Criminal Code traffic, impaired driving and drug violations. For each it keeps the incident count and the rate. Other statistics in the full table, such as clearance and unfounded counts, are not in this extract.

The newest year with either a count or a rate is compared with the previous year that has a rate. A gap in the middle does not become a zero, and it does not become the comparison year.

This is not a map of offences and not a list of calls for service.

## Source

[Incident-based crime statistics, police services in British Columbia, table 35-10-0184](https://www150.statcan.gc.ca/t1/tbl1/en/tv.action?pid=3510018401). The English CSV is [35100184-eng.zip](https://www150.statcan.gc.ca/n1/tbl/csv/35100184-eng.zip). Open Government Licence – Canada. No API key. The release used for the first extract is 22 July 2026, covering 1998 to 2025. The page shows the date this extract was saved separately from that release date.

## Expand or customize

Defaults live in [web/config.json](web/config.json). `services` are buttons. `violation` is the offence id the page opens on (`64` is property crime). The offence list and the police-service list both come from the extract. Typing Kitimat works even if Kitimat is not a button.

To keep another offence group, add its coordinate id and the labels in `scripts/refresh.py`, then refresh. Do not put the whole CSV in the repository. The download is about 325 MB and the page only needs the slim extract.

```sh
python3 scripts/refresh.py
```

If the download is too small or the extract keeps too few cells, `web/data/sheet.json` is left untouched. On GitHub, run **Refresh crime extract**. It is not on a frequent schedule. The table is annual. Pushing ordinary code does not download it again.

Publish by enabling **Settings → Pages → GitHub Actions** and pushing to `main`. Check `https://coolcode.ca/violationsheet/`. After it is up, copy `tool.json` into `data/tools.json` in [jsdyer/jsdyer.github.io](https://github.com/jsdyer/jsdyer.github.io) and run `scripts/sync_guides.py --tool violationsheet` there before regenerating the hub README.

```sh
node --test tests/*.test.mjs
python3 -m unittest discover -s tests -v
python3 scripts/build.py
```
