# Sound

How the calls and the music bed in `public/sound/` were made. Who recorded what, and under which licence, is in `src/lib/sounds.ts`; the page lists it under "Sound credits".

## The edit

`master.py` holds every decision per cat: which seconds of the source recording are used, the band-pass, mains-hum notches (the Berlin archive tapes carry 50 Hz), the strength of the noise reduction and the stretch of room tone it learns from, the target loudness and the fades. Each call is then encoded twice: AAC in `.m4a`, which almost every browser plays, and Opus in `.webm` for the few that cannot (Chromium builds without proprietary codecs, some Linux browsers). The page asks the browser whether it plays AAC and loads the other otherwise.

The leopard is the one built call: Freesound has a single recorded cough, so `saw_from_cough` repeats it nine times with alternating in- and out-breaths, slight pitch shifts and a fading level, the way a leopard saws.

The music bed is 0:22 to 12:48 of Chris Zabriskie's "The Dark Glow of the Mountains", with 4 s fades, normalised to -20 LUFS.

## Run

The source recordings are not in the repository. To redo an edit, download the recording from its `source` in `src/lib/sounds.ts`, convert it to WAV, and save it in `scripts/audio/raw/` under the name in the cat's `src` field in `master.py`:

```bash
ffmpeg -i ~/Downloads/647637__druulian__caracal07.mp3 scripts/audio/raw/647637__druulian__caracal07.wav
pip install numpy scipy soundfile librosa noisereduce pyloudnorm   # and ffmpeg with libopus
python3 scripts/audio/master.py caracal
```

With no ids it does every call and the music. Same sources in, same `.wav` and `.m4a` out; the `.webm` differs only in container metadata.

## The walk

`beats.py` writes the walk's beat, "a slow way down": 88 BPM in D minor, 96 bars, every sound synthesised (band-limited saw pads, FM electric piano, an additive felt piano, a mallet arpeggio, kick, rim, hats, shaker and sub), mixed and mastered to -16.5 LUFS. It opens and closes on pad and piano alone, so its loop point is quiet. Run it with no input: `python3 scripts/audio/beats.py`.

`walk.py` turns Voicebox takes of the narration into the lines the page plays. Voicebox speaks at a natural, brisk pace and ignores style instructions for a cloned voice, so the calm is made here: the take is trimmed to its words, slowed by about 10% with WSOLA (pitch kept), every pause between phrases is stretched by half, the voice is warmed and de-essed, and each line is levelled to -19 LUFS. Put one WAV per line in a folder, named after the line ids in `src/lib/walkthrough.ts`, then `python3 scripts/audio/walk.py that-folder`.

The takes come from a Voicebox profile, "Vismay - Walk", made from the same Patherle announcement as "Vismay - Patherle" but trimmed to end on a full sentence. The original reference stops mid-word ("a multi-level..."), and the model would open each take by finishing it.

## Licences to keep in mind

The site is non-commercial, and some of its sound only allows that: the three BBC recordings (clouded leopard, serval, sand cat) under the BBC RemArc licence, the margay (CC BY-NC-SA 4.0) and the music (CC BY-NC 3.0). The four Berlin archive edits are CC BY-SA 3.0 DE, so these edits are shared under the same licence. Three cats have no recording at all: the Andean mountain cat, the rusty-spotted cat and the black-footed cat stay silent rather than borrow another species' voice.
