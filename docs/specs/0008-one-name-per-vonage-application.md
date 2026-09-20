# 0008 — One name per Vonage application

| | |
|---|---|
| **Status** | Draft |
| **Area** | devops |
| **Issue** | #NN |
| **Date** | 2026-09-20 |

---

## Problem

There is more than one Vonage application in this project and only one of them has a name that says so. Verification is `VONAGE_VERIFY_*`. Video is `VONAGE_APPLICATION_ID` and `VONAGE_PRIVATE_KEY_PATH=./private.key`, with no qualifier at all.

That asymmetry is an accident of ordering, and spec 0001 records it in its own words: *"Separate variables because `VONAGE_APPLICATION_ID` is already taken by the video application."* Verify qualified itself because it arrived second. The result is that video reads as "the Vonage application", which only parses correctly if you already know there are several.

The cost is not theoretical. The applications have separate ids and separate private keys, and the keys are not interchangeable: a video token signed with Verify's key fails with an error that names neither. `private.key` on disk says nothing about which application it belongs to, sitting next to a `verify.key` that does.

Two things the same confusion has already produced:

- `docs/guides/deployment.md` says the key in `VONAGE_PRIVATE_KEY` is written to disk at start-up because the SDK wants a path. That is true of Verify's key and false of video's, which `tokenGenerate` signs with directly. One section, two applications, one variable name.
- Production is missing the video key entirely. `VONAGE_APPLICATION_ID` is set on Railway and `VONAGE_PRIVATE_KEY` is not, so the video call fails there with the "not in .env" message.

---

## Acceptance criteria

- [ ] No Vonage variable reads as the default one: every name says which application it belongs to
- [ ] The key file on disk names its application too
- [ ] The error raised when the video credentials are missing says which application in the panel they come from
- [ ] The deployment guide says which of the two keys is written to disk and which is not
- [ ] Nothing about the voice side is renamed or folded into video
- [ ] Production and local are both updated, so the rename does not land in code alone

---

## Scope

`VONAGE_APPLICATION_ID` → `VONAGE_VIDEO_APPLICATION_ID`, `VONAGE_PRIVATE_KEY_PATH` → `VONAGE_VIDEO_PRIVATE_KEY_PATH`, `VONAGE_PRIVATE_KEY` → `VONAGE_VIDEO_PRIVATE_KEY`. The file becomes `video.key`, still covered by `*.key` in `.gitignore`.

`.env.example` gets one block per application, each headed by the application's name.

The deployment guide separates the two keys and says which one is materialised.

Railway's variables are renamed in the same sitting, because a rename that lands in code alone is a video call that dies on the next deploy.

---

## Out of scope

**Anything on the voice side.** `VONAGE_NUMBER` keeps its name and moves to a block of its own. Nothing reads it yet, and when the SIP bridge is built it gets its own `VONAGE_VOICE_*` pair rather than borrowing video's. The `SLNG_*` variables, which are what Mia actually speaks with, are not Vonage and are not touched.

**`VONAGE_API_BASE` and `VONAGE_BRAND_NAME`.** Both are Verify's, and both are already unambiguous in practice. Renaming them widens the change for no confusion anybody has had.

**`VONAGE_API_KEY` and `VONAGE_API_SECRET` on Railway.** The code declares neither. They are leftovers from an auth model this project does not use, and deleting them is a separate call to make with the panel open.

**Accepting the old names as a fallback.** It would make the rename impossible to get wrong and would also be debt with no date on it. The rename is done in one sitting instead, production included.

---

## Decisions

| Decision | Alternative rejected | Why |
|---|---|---|
| Qualify video rather than unqualify Verify | Dropping Verify's prefix so video stays the default | There is no default. Two applications with equal standing, and one of them silently owning the short name is what caused this |
| `video.key` rather than `private.key` | Leaving the filename | Both keys are private. The name has to say whose, which is the question that was being asked |
| No transitional fallback | Reading the new name and falling back to the old | Both names live means neither is the name. The risk it protects against — Railway not updated — is removed by updating Railway in the same change |
| The error names the application | Listing the variables only | The variable names now say it, and the error is read by whoever has the panel open with several applications in front of them |

---

## Verification

```bash
npm run typecheck && npm run lint && npm run build
grep -rn "VONAGE_APPLICATION_ID\|VONAGE_PRIVATE_KEY" src/ .env.example          # no hits
railway variables --service offload --kv | cut -d= -f1 | grep VONAGE            # only qualified names
```

1. With the video variables unset, open `/call`: the notice names `VONAGE_VIDEO_*` and says the credentials come from the video application, not Verify's.
2. Point `VONAGE_VIDEO_PRIVATE_KEY_PATH` at a file that does not exist: the message says so, and says a regenerated key invalidates the previous one.
3. Set both properly and join the room: the call opens.
4. Deploy, and open `/call` in production: it opens there too.

---

## Notes

**The video key was never saved.** Only `verify.key` is on disk, and Railway has no `VONAGE_PRIVATE_KEY`. Vonage offers a private key for download once, when the application is created; a new one has to be generated in the panel, and that invalidates the previous one. The rename does not fix this, it only makes the error say which key is meant.

**`docs/guides/deployment.md` is in Spanish** while the project's rule is English throughout. It was edited here for the variable names and not translated: a half-translated guide is worse than a Spanish one, and the translation is its own task.
