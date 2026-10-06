# Demo script

Vertical walkthrough (1080 × 1920, about 90 seconds) recorded from the app running locally with `demo/record.mjs`. No background music. Narration is in British English.

| # | On screen | Narration |
| --- | --- | --- |
| 1 | Welcome screen with the persistent disclosure bar and the three roles. | This is an independent prototype using synthetic data. It explores one idea for Circles: getting support without sharing anything private about your health. |
| 2 | Participant → Keep it private → Take a short walk → Check in → Did it. Home shows the private card. | Sam starts privately. That's a complete path, not a lesser one. Pick something small, check in once a week, and nobody else sees it. |
| 3 | Invite one person → Practical company → title/note/name options → Preview. Review screen and the Never shared list. | If Sam wants company, they can invite one person. They choose the intention, the kind of support, and a neutral title. Then they see exactly what Alex will see, and what is never shared. |
| 4 | Create demo invitation without ticking → error. Tick → Waiting for Alex, demo link card. | Nothing goes out until Sam ticks the box. And the link is a demo link that only works inside this prototype. |
| 5 | Open as Alex → only reviewed fields → Yes, I'm in → preset note → Write my own message → unsupported state → health-question link. | Alex sees only those reviewed fields. Saying no would be fine. Here, Alex accepts and picks a preset note. Writing your own advice isn't possible, and health questions go to the care team. |
| 6 | Switch to participant → Helpful → Remove Alex's access → Check the old link → no longer active. | Back with Sam, the note can be marked helpful. If it stops feeling right, one tap removes access, and Alex's old link shows nothing at all. |
| 7 | Analyst view, Fixture B. Verdict card, metrics with numerators/denominators, cohort table. | The analyst view asks whether circles actually helped people come back in week two, counting households, not clicks. In this misleading fixture, the pooled number looks like a win. |
| 8 | Cohort filter → Existing app customers → treatment behind. Back to pooled → Hold for more evidence. | But the arms enrolled different people, and a few heavy users dominate. Filter by cohort and every group favours control. So the decision is hold for more evidence, not launch. |
| 9 | Decision card and reasons. | Privacy first, and an honest answer about what the data can and can't say. |

## Reproduce

```bash
npm run serve            # in one shell
node demo/record.mjs     # in another; needs ffmpeg
```

The script drives the real UI, logs when each scene starts, and places each narration clip at that time. Outputs: `demo/support-on-your-terms-walkthrough.mp4`, `.srt` captions and `demo/timeline.json`.
