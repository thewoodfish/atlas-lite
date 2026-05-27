# Atlas Lite — Demo Video Script

**Target length:** Under 90 seconds  
**Format:** Screen recording with voice-over  
**Flow:** Home → Confirm → Result → Explorer

---

## Talking Points by Timestamp

```
00:00  Show the home screen of Atlas Lite.
       Say: "This is Atlas Lite — a natural language intent layer for Portaldot.
             Instead of constructing raw extrinsics, you just type what you want to do."

00:06  Click the example pill: "Stake 20 POT to the safest validator"
       Enter your wallet address in the address field.
       Say: "I'll type my goal — stake 20 POT to the safest validator —
             and provide my Portaldot address so Atlas can check my balance."

00:12  Click "Parse Intent →"
       Loading spinner appears.
       Say: "The backend is now querying live validator data from the Portaldot chain
             and sending it to GPT-4o to resolve the best match."

00:18  Confirmation card appears.
       Highlight: validator name, commission %, reasoning paragraph, gas estimate.
       Say: "GPT-4o picked [ValidatorName] — it has the lowest commission at [X]%
             and the highest safety score. The reasoning is shown right here.
             Gas is estimated at ~0.001 POT."

00:26  Click "Confirm & Execute"
       Loading spinner: "Submitting to chain…"
       Say: "On confirm, two things happen on-chain: a staking.nominate extrinsic
             is submitted, and the intent is logged in our deployed ink! contract —
             both transactions pay POT gas."

00:33  Result screen appears.
       Highlight: green success banner, extrinsic hash, "Intent logged on-chain ✅"
       Say: "Done. The nomination is confirmed. We have an extrinsic hash,
             a block hash, and our IntentLog contract on Portaldot Mainnet
             has recorded the intent."

00:42  Click "View on Portaldot Explorer ↗"
       Paste extrinsic hash into the explorer search.
       Show the confirmed block and the extrinsic details.
       Say: "Here it is on the Portaldot explorer — a real, confirmed staking
             nomination on mainnet, submitted from a single sentence."

00:55  Return to the Atlas Lite result screen.
       Say: "One sentence. Zero manual transaction construction. Live on Portaldot Mainnet.
             That's Atlas Lite."

01:00  [Cut]
```

---

## Checklist Before Recording

- [ ] Backend running on `localhost:8000` with valid `.env`
- [ ] Contract deployed and `CONTRACT_ADDRESS` set
- [ ] Demo wallet has enough POT for gas + is bonded (staking.nominate requires bond)
- [ ] Frontend running on `localhost:3000`
- [ ] Screen recording software ready (1080p+, no cursor lag)
- [ ] Portaldot explorer tab open and ready to paste hash

## Tips

- Record at 1280×800 or 1920×1080 for clarity
- Use a silent screen recorder; add voice-over in post if needed
- Keep the loading states visible — they show real chain interaction
- After recording, add the video link to `README.md` Demo section
